"""RFC-7807 `application/problem+json` error responses — byte-shape-compatible
port of com.ecotrack.exception.GlobalExceptionHandler.

Shape (matches Spring's ProblemDetail + the two custom properties the Java
handler adds):
    {
        "type": "https://ecotrack.app/problems/<slug>",
        "title": "<HTTP reason phrase>",
        "status": <int>,
        "detail": "<message>",
        "instance": "<request path>",
        "timestamp": "<ISO-8601 instant>",
        "errors": {"<field>": "<message>", ...}   # validation errors only
    }

Never leaks internals/stack traces in `detail` for unexpected (5xx) errors —
mirrors server.error.include-message=never / include-stacktrace=never in
application.yml.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.common.errors import ApiException

log = logging.getLogger(__name__)

TYPE_BASE = "https://ecotrack.app/problems/"


def _slug(status_code: int) -> str:
    try:
        name = HTTPStatus(status_code).name
    except ValueError:
        name = "error"
    return name.lower().replace("_", "-")


def _title(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Error"


def build_problem(
    status_code: int,
    detail: str,
    request: Request,
    slug: str | None = None,
    errors: dict[str, str] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": TYPE_BASE + (slug or _slug(status_code)),
        "title": _title(status_code),
        "status": status_code,
        "detail": detail,
        "instance": request.url.path,
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    if errors is not None:
        body["errors"] = errors
    return body


def _response(status_code: int, detail: str, request: Request, slug: str | None = None,
              errors: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=build_problem(status_code, detail, request, slug, errors),
        media_type="application/problem+json",
    )


async def handle_api_exception(request: Request, exc: ApiException) -> JSONResponse:
    return _response(exc.status_code, exc.message, request)


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: dict[str, str] = {}
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path", "header")]
        field = loc[-1] if loc else "_"
        errors[field] = err.get("msg", "Invalid value")
    return _response(status.HTTP_400_BAD_REQUEST, "Validation failed", request, slug="validation", errors=errors)


async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Covers 401/403/404/etc raised via Starlette/FastAPI's own HTTPException
    # (e.g. routing 404s) rather than our ApiException hierarchy.
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    slug_map = {401: "unauthorized", 403: "forbidden"}
    return _response(exc.status_code, detail, request, slug=slug_map.get(exc.status_code))


async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    log.error("Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return _response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "An unexpected error occurred",
        request,
        slug="internal-error",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiException, handle_api_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unexpected)
