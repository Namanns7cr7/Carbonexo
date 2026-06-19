package com.ecotrack.storage;

import com.ecotrack.config.AppProperties;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Google Cloud Storage implementation. Uses Application Default Credentials
 * (set GOOGLE_APPLICATION_CREDENTIALS env var) or GCP workload identity.
 */
public class GoogleCloudStorageService implements BlobStorageService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCloudStorageService.class);

    private final Storage storage;
    private final String bucket;

    public GoogleCloudStorageService(AppProperties props) {
        String projectId = props.storage().gcs().projectId();
        this.bucket = props.storage().gcs().bucket();

        StorageOptions.Builder builder = StorageOptions.newBuilder();
        if (projectId != null && !projectId.isBlank()) {
            builder.setProjectId(projectId);
        }
        this.storage = builder.build().getService();
        log.info("GoogleCloudStorageService initialized — bucket={}", bucket);
    }

    @Override
    public String upload(byte[] data, String path, String contentType) {
        BlobId blobId = BlobId.of(bucket, path);
        BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                .setContentType(contentType)
                .build();
        storage.create(blobInfo, data);
        String url = String.format("https://storage.googleapis.com/%s/%s", bucket, path);
        log.debug("Uploaded blob: {}", url);
        return url;
    }

    @Override
    public String getUrl(String path) {
        return String.format("https://storage.googleapis.com/%s/%s", bucket, path);
    }

    @Override
    public void delete(String path) {
        BlobId blobId = BlobId.of(bucket, path);
        boolean deleted = storage.delete(blobId);
        log.debug("Deleted blob path={}, success={}", path, deleted);
    }
}
