from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection


@shared_task
def send_email_messages(payloads):
    connection = get_connection(backend=settings.EMAIL_DELIVERY_BACKEND)
    sent = 0
    for payload in payloads:
        message = EmailMultiAlternatives(
            subject=payload["subject"],
            body=payload["body"],
            from_email=payload.get("from_email") or settings.DEFAULT_FROM_EMAIL,
            to=payload.get("to") or [],
            cc=payload.get("cc") or [],
            bcc=payload.get("bcc") or [],
            reply_to=payload.get("reply_to") or [],
            connection=connection,
        )
        for content, mimetype in payload.get("alternatives") or []:
            message.attach_alternative(content, mimetype)
        message.send()
        sent += 1
    return sent
