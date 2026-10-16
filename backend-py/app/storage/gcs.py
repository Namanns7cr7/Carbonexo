"""Google Cloud Storage provider — STUB.

Implement when cloud creds available: use `google-cloud-storage`'s Client,
GCP_PROJECT_ID + GCS_BUCKET from settings, uploading to
`gs://{bucket}/{path}` and returning either a public URL or a signed URL
depending on bucket ACLs (mirrors storage/GoogleCloudStorageService.java).
"""
from __future__ import annotations

from app.storage.base import BlobStorageService


class GoogleCloudStorageService(BlobStorageService):
    def __init__(self, *args, **kwargs) -> None:
        raise NotImplementedError(
            "GoogleCloudStorageService is not implemented yet — requires GCP_PROJECT_ID + "
            "GCS_BUCKET + Application Default Credentials. Use STORAGE_PROVIDER=local_stub for local dev."
        )

    def upload(self, data: bytes, path: str, content_type: str) -> str:  # pragma: no cover
        raise NotImplementedError

    def get_url(self, path: str) -> str:  # pragma: no cover
        raise NotImplementedError

    def delete(self, path: str) -> None:  # pragma: no cover
        raise NotImplementedError
