"""Mirrors auth/JwtServiceTest.java."""
from __future__ import annotations

import uuid

from app.auth.jwt_service import JwtService

SECRET = "0123456789012345678901234567890123456789"  # >= 256 bits


def make_service(secret: str) -> JwtService:
    return JwtService(secret=secret, access_ttl_seconds=900, issuer="ecotrack")


def test_generates_and_parses_a_valid_token():
    svc = make_service(SECRET)
    user_id = uuid.uuid4()

    token = svc.generate_access_token(user_id, "user@example.com", "USER")
    claims = svc.parse(token)

    assert claims is not None
    assert claims["sub"] == str(user_id)
    assert claims["email"] == "user@example.com"
    assert claims["role"] == "USER"


def test_rejects_a_tampered_token():
    svc = make_service(SECRET)
    token = svc.generate_access_token(uuid.uuid4(), "user@example.com", "USER")

    assert svc.parse(token + "tampered") is None


def test_rejects_a_token_signed_with_a_different_secret():
    signer = make_service("a" * 40)
    verifier = make_service("b" * 40)

    token = signer.generate_access_token(uuid.uuid4(), "user@example.com", "USER")

    assert verifier.parse(token) is None
