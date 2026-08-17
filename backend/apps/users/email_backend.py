from django.core.mail.backends.base import BaseEmailBackend


class CeleryEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        from apps.users.tasks import send_email_messages

        payloads = [self._serialize(message) for message in email_messages]
        send_email_messages.delay(payloads)
        return len(email_messages)

    @staticmethod
    def _serialize(message):
        return {
            "subject": message.subject,
            "body": message.body,
            "from_email": message.from_email,
            "to": list(message.to or []),
            "cc": list(message.cc or []),
            "bcc": list(message.bcc or []),
            "reply_to": list(getattr(message, "reply_to", None) or []),
            "alternatives": list(getattr(message, "alternatives", None) or []),
        }
