"""Contract test for the RFC-7807 error shape, written FIRST per the plan —
every other feature depends on the error handler matching
com.ecotrack.exception.GlobalExceptionHandler byte-for-byte in field names.

Builds a tiny standalone FastAPI app wired with only the exception handlers
under test (not the full app) so this test has no dependency on the DB/auth
being built yet.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.common.errors import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    ResourceNotFoundException,
    UnauthorizedException,
)
from app.common.problem_details import register_exception_handlers


class _ValidateBody(BaseModel):
    email: str
    password: str


def make_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom/bad-request")
    def boom_bad_request():
        raise BadRequestException("bad input")

    @app.get("/boom/conflict")
    def boom_conflict():
        raise ConflictException("Email already registered")

    @app.get("/boom/not-found")
    def boom_not_found():
        raise ResourceNotFoundException.of("User", "123")

    @app.get("/boom/unauthorized")
    def boom_unauthorized():
        raise UnauthorizedException("Invalid email or password")

    @app.get("/boom/forbidden")
    def boom_forbidden():
        raise ForbiddenException()

    @app.get("/boom/generic")
    def boom_generic():
        raise RuntimeError("db password leaked: hunter2")

    @app.post("/validate")
    def validate(body: _ValidateBody):
        return {"ok": True}

    return app


client = TestClient(make_app(), raise_server_exceptions=False)


def _assert_shape(payload: dict, status: int) -> None:
    assert payload["status"] == status
    assert payload["type"] == f"https://ecotrack.app/problems/{payload['type'].rsplit('/', 1)[-1]}"
    assert payload["type"].startswith("https://ecotrack.app/problems/")
    assert "title" in payload
    assert "detail" in payload
    assert payload["instance"]
    assert "timestamp" in payload
    # ISO-ish timestamp, parseable
    assert "T" in payload["timestamp"]


def test_api_exception_shape_and_status():
    resp = client.get("/boom/bad-request")
    assert resp.status_code == 400
    body = resp.json()
    _assert_shape(body, 400)
    assert body["detail"] == "bad input"
    assert body["instance"] == "/boom/bad-request"
    assert body["type"] == "https://ecotrack.app/problems/bad-request"


def test_conflict_exception():
    resp = client.get("/boom/conflict")
    assert resp.status_code == 409
    body = resp.json()
    _assert_shape(body, 409)
    assert body["detail"] == "Email already registered"
    assert body["type"] == "https://ecotrack.app/problems/conflict"


def test_not_found_exception():
    resp = client.get("/boom/not-found")
    assert resp.status_code == 404
    body = resp.json()
    _assert_shape(body, 404)
    assert "User not found" in body["detail"]


def test_validation_error_produces_field_errors_dict():
    resp = client.post("/validate", json={"email": "x@example.com"})  # missing password
    assert resp.status_code == 400
    body = resp.json()
    _assert_shape(body, 400)
    assert body["detail"] == "Validation failed"
    assert body["type"] == "https://ecotrack.app/problems/validation"
    assert "errors" in body
    assert "password" in body["errors"]


def test_unauthorized_401():
    resp = client.get("/boom/unauthorized")
    assert resp.status_code == 401
    body = resp.json()
    _assert_shape(body, 401)
    assert body["type"] == "https://ecotrack.app/problems/unauthorized"


def test_forbidden_403():
    resp = client.get("/boom/forbidden")
    assert resp.status_code == 403
    body = resp.json()
    _assert_shape(body, 403)
    assert body["type"] == "https://ecotrack.app/problems/forbidden"


def test_generic_500_never_leaks_internal_message():
    resp = client.get("/boom/generic")
    assert resp.status_code == 500
    body = resp.json()
    _assert_shape(body, 500)
    assert body["detail"] == "An unexpected error occurred"
    assert "password" not in body["detail"]
    assert "hunter2" not in body["detail"]
    assert body["type"] == "https://ecotrack.app/problems/internal-error"
