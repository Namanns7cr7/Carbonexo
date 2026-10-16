"""Domain exceptions mapping to a specific HTTP status, mirroring
com.ecotrack.exception.{ApiException,BadRequestException,ConflictException,
ResourceNotFoundException}.
"""
from __future__ import annotations

from typing import Any


class ApiException(Exception):
    """Base for domain exceptions that map to a specific HTTP status."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class BadRequestException(ApiException):
    def __init__(self, message: str) -> None:
        super().__init__(400, message)


class ConflictException(ApiException):
    def __init__(self, message: str) -> None:
        super().__init__(409, message)


class UnauthorizedException(ApiException):
    """Not part of the Java ApiException hierarchy (Java raises Spring Security's
    AuthenticationException instead), but used by security_deps.get_current_user
    and auth_service for "invalid credentials" style 401s — those need the same
    RFC-7807 shape as every other error.
    """

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(401, message)


class ForbiddenException(ApiException):
    def __init__(self, message: str = "Access denied") -> None:
        super().__init__(403, message)


class ResourceNotFoundException(ApiException):
    def __init__(self, message: str | None = None, *, entity: str | None = None,
                 field: str | None = None, value: Any = None) -> None:
        if message is None:
            if entity is not None and field is not None:
                message = f"{entity} not found: {field}={value}"
            elif entity is not None:
                message = f"{entity} not found: {value}"
            else:
                message = "Resource not found"
        super().__init__(404, message)

    @staticmethod
    def of(entity: str, id_: Any) -> ResourceNotFoundException:
        return ResourceNotFoundException(f"{entity} not found: {id_}")
