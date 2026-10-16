"""Mirrors auth/GoogleTokenVerifierTest.java."""
from __future__ import annotations

import pytest

from app.auth.google_verifier import GoogleTokenVerifier


def test_not_configured_when_client_id_missing():
    assert GoogleTokenVerifier(None).is_configured() is False
    assert GoogleTokenVerifier("").is_configured() is False
    assert GoogleTokenVerifier("   ").is_configured() is False


def test_configured_when_client_id_present():
    assert GoogleTokenVerifier("abc123.apps.googleusercontent.com").is_configured() is True


def test_verify_raises_when_not_configured():
    verifier = GoogleTokenVerifier(None)
    with pytest.raises(RuntimeError):
        verifier.verify("any-token")


def test_verify_returns_none_for_a_garbage_token_when_configured():
    # configured but the token is not a real Google ID token -> None (a clean
    # 401), not a crash
    verifier = GoogleTokenVerifier("abc123.apps.googleusercontent.com")
    assert verifier.verify("not.a.real.token") is None
