"""Verifies Google Sign-In ID tokens against Google's public keys (signature,
expiry, issuer, audience) — mirrors auth/GoogleTokenVerifier.java.

`verify()` returns the decoded payload dict (email, name, sub, email_verified...)
or None if the token is invalid, malformed, expired, or fails signature/audience
checks — treating all of these as None keeps a bad token a 401 rather than a
500, matching the Java implementation's `catch (Exception e) { return null; }`.
"""
from __future__ import annotations

from typing import Any

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import settings


class GoogleTokenVerifier:
    def __init__(self, client_id: str | None = None) -> None:
        self.client_id = client_id if client_id is not None else settings.GOOGLE_CLIENT_ID

    def is_configured(self) -> bool:
        """True when a Google OAuth client id is configured (server can do Google login)."""
        return bool(self.client_id and self.client_id.strip())

    def verify(self, id_token_string: str) -> dict[str, Any] | None:
        if not self.is_configured():
            raise RuntimeError("Google login is not configured (missing GOOGLE_CLIENT_ID)")
        try:
            return google_id_token.verify_oauth2_token(
                id_token_string, google_requests.Request(), audience=self.client_id
            )
        except Exception:  # noqa: BLE001 - mirrors Java's catch (Exception e) { return null; }
            return None


google_verifier = GoogleTokenVerifier()
