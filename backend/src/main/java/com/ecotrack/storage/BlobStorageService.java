package com.ecotrack.storage;

/** Abstraction for binary blob storage. Implementations must NOT leak provider-specific types. */
public interface BlobStorageService {

    /** Upload bytes and return the public/signed URL. */
    String upload(byte[] data, String path, String contentType);

    /** Get a URL for an existing blob. */
    String getUrl(String path);

    /** Delete a blob. */
    void delete(String path);
}
