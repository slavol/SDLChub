import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from backend.config import get_settings


def _get_fernet() -> Fernet:
    digest = hashlib.sha256(get_settings().secret_key.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str | None) -> str | None:
    if not value:
        return None

    try:
        return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None
