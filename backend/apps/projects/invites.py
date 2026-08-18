import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.projects.models import Invite, Membership
from apps.users.tasks import send_email_messages

User = get_user_model()


def _send_mail(subject, body, to_email):
    send_email_messages.delay(
        [
            {
                "subject": subject,
                "body": body,
                "from_email": settings.DEFAULT_FROM_EMAIL,
                "to": [to_email],
                "cc": [],
                "bcc": [],
                "reply_to": [],
                "alternatives": [],
            }
        ]
    )


def _new_token():
    return secrets.token_urlsafe(32)


def _expires_at():
    return timezone.now() + timedelta(days=7)


def create_share_invite(*, project, role, invited_by, kind):
    return Invite.objects.create(
        project=project,
        email="",
        kind=kind,
        role=role,
        token=_new_token(),
        invited_by=invited_by,
        expires_at=_expires_at(),
    )


def create_or_refresh_invite(*, project, email, role, invited_by):
    email = email.lower().strip()
    if Membership.objects.filter(project=project, user__email__iexact=email).exists():
        raise ValidationError({"email": "Пользователь уже в проекте."})

    existing_user = User.objects.filter(email__iexact=email).first()
    if existing_user:
        Membership.objects.create(project=project, user=existing_user, role=role)
        if existing_user.is_active:
            body = (
                f"Вас добавили в проект «{project.name}» с ролью {role}.\n"
                f"{settings.FRONTEND_URL}/projects/{project.id}\n"
            )
        else:
            body = (
                f"Вас добавили в проект «{project.name}» с ролью {role}.\n"
                "Сначала активируйте аккаунт по ссылке из письма регистрации.\n"
                f"{settings.FRONTEND_URL}/login\n"
            )
        _send_mail(f"Вас добавили в проект {project.name}", body, existing_user.email)
        return None

    token = _new_token()
    expires_at = _expires_at()
    invite = Invite.objects.filter(
        project=project, email__iexact=email, accepted_at__isnull=True, kind=Invite.Kind.EMAIL
    ).first()
    if invite:
        invite.token = token
        invite.role = role
        invite.invited_by = invited_by
        invite.expires_at = expires_at
        invite.save(update_fields=["token", "role", "invited_by", "expires_at"])
    else:
        invite = Invite.objects.create(
            project=project,
            email=email,
            kind=Invite.Kind.EMAIL,
            role=role,
            token=token,
            invited_by=invited_by,
            expires_at=expires_at,
        )
    link = f"{settings.FRONTEND_URL}/invite/{invite.token}"
    body = (
        f"Вас пригласили в проект «{project.name}» с ролью {role}.\n"
        f"Принять приглашение: {link}\n"
        "Ссылка действует 7 дней.\n"
    )
    _send_mail(f"Приглашение в проект {project.name}", body, email)
    return invite


def _bind_membership(*, invite, user):
    membership = Membership.objects.filter(project=invite.project, user=user).first()
    if membership is None:
        membership = Membership.objects.create(project=invite.project, user=user, role=invite.role)
    invite.accepted_at = timezone.now()
    invite.save(update_fields=["accepted_at"])
    return membership


@transaction.atomic
def accept_invite(*, invite, password=None, current_user=None, email=None):
    if invite.accepted_at:
        raise ValidationError("Приглашение уже принято.")
    if invite.expires_at < timezone.now():
        raise ValidationError("Срок приглашения истёк.")
    if invite.role == Membership.Role.OWNER:
        raise ValidationError("Нельзя принять роль владельца.")

    authenticated = current_user is not None and current_user.is_authenticated

    if invite.kind == Invite.Kind.TOKEN:
        if not authenticated:
            raise ValidationError("Войдите в аккаунт, чтобы использовать токен.")
        return _bind_membership(invite=invite, user=current_user)

    if invite.kind == Invite.Kind.LINK:
        if authenticated:
            return _bind_membership(invite=invite, user=current_user)
        email = (email or "").lower().strip()
        if not email:
            raise ValidationError({"email": "Укажите email."})
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("Войдите в аккаунт, чтобы принять приглашение.")
        if not password:
            raise ValidationError({"password": "Задайте пароль для нового аккаунта."})
        user = User.objects.create_user(email=email, password=password, is_active=True)
        return _bind_membership(invite=invite, user=user)

    if Membership.objects.filter(project=invite.project, user__email__iexact=invite.email).exists():
        invite.accepted_at = timezone.now()
        invite.save(update_fields=["accepted_at"])
        return Membership.objects.get(project=invite.project, user__email__iexact=invite.email)

    if authenticated:
        if current_user.email.lower() != invite.email.lower():
            raise ValidationError("Это приглашение для другого email.")
        return _bind_membership(invite=invite, user=current_user)

    existing = User.objects.filter(email__iexact=invite.email).first()
    if existing:
        raise ValidationError("Войдите в аккаунт, чтобы принять приглашение.")
    if not password:
        raise ValidationError({"password": "Задайте пароль для нового аккаунта."})
    user = User.objects.create_user(
        email=invite.email,
        password=password,
        is_active=True,
    )
    return _bind_membership(invite=invite, user=user)
