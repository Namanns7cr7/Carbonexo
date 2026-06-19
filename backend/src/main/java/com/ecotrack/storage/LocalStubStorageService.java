package com.ecotrack.storage;

import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Local filesystem stub for development — writes to a directory on disk so the
 * app works without GCP credentials. NEVER use in production.
 */
public class LocalStubStorageService implements BlobStorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStubStorageService.class);
    private final Path baseDir;

    public LocalStubStorageService(AppProperties props) {
        this.baseDir = Path.of(props.storage().localStubDir());
        try {
            Files.createDirectories(baseDir);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create local-stub dir: " + baseDir, e);
        }
        log.info("LocalStubStorageService initialized — dir={}", baseDir.toAbsolutePath());
    }

    @Override
    public String upload(byte[] data, String path, String contentType) {
        try {
            Path target = baseDir.resolve(path);
            Files.createDirectories(target.getParent());
            Files.write(target, data);
            log.debug("Local stub: wrote {} bytes to {}", data.length, target);
            return "file://" + target.toAbsolutePath();
        } catch (IOException e) {
            throw new RuntimeException("Local stub upload failed", e);
        }
    }

    @Override
    public String getUrl(String path) {
        return "file://" + baseDir.resolve(path).toAbsolutePath();
    }

    @Override
    public void delete(String path) {
        try {
            Files.deleteIfExists(baseDir.resolve(path));
        } catch (IOException e) {
            log.warn("Local stub delete failed for {}", path, e);
        }
    }
}
