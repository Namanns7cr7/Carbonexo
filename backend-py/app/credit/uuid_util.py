"""Byte-for-byte port of java.util.UUID.nameUUIDFromBytes(byte[]).

Java's nameUUIDFromBytes does NOT prepend any namespace UUID (unlike the
"classic" RFC 4122 v3 process, and unlike Python's uuid.uuid3 which always
mixes in a namespace) — it MD5-hashes ONLY the raw input bytes, then forces
the version (3) and variant (RFC 4122) bits onto that 16-byte digest. This
must be used instead of uuid.uuid3() to get identical UUIDs for identical
input strings (needed so POST /api/credits/action?actionKey=X is idempotent
across repeated calls with the same actionKey, matching CreditController.java).
"""
from __future__ import annotations

import hashlib
import uuid


def name_uuid_from_bytes(data: bytes) -> uuid.UUID:
    digest = bytearray(hashlib.md5(data).digest())
    digest[6] = (digest[6] & 0x0F) | 0x30  # version 3
    digest[8] = (digest[8] & 0x3F) | 0x80  # variant RFC 4122
    return uuid.UUID(bytes=bytes(digest))
