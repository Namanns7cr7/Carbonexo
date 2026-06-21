package com.ecotrack.upload;

import com.ecotrack.config.AppProperties;
import com.ecotrack.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FileValidationServiceTest {

    private FileValidationService service;

    @BeforeEach
    void setUp() {
        AppProperties props = mock(AppProperties.class);
        when(props.upload()).thenReturn(new AppProperties.Upload(
                1024, List.of("application/pdf", "image/png", "image/jpeg")));
        service = new FileValidationService(props);
    }

    private static byte[] pdf() {
        return new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31 }; // %PDF-1
    }

    @Test
    void acceptsValidPdf() {
        assertDoesNotThrow(() -> service.validate(pdf(), "application/pdf", "bill.pdf"));
    }

    @Test
    void acceptsValidPng() {
        byte[] png = { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A };
        assertDoesNotThrow(() -> service.validate(png, "image/png", "bill.png"));
    }

    @Test
    void acceptsValidJpeg() {
        byte[] jpeg = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0 };
        assertDoesNotThrow(() -> service.validate(jpeg, "image/jpeg", "bill.jpg"));
    }

    @Test
    void rejectsUnsupportedContentType() {
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.validate(pdf(), "application/zip", "bill.zip"));
        assertTrue(ex.getMessage().contains("Unsupported file type"));
    }

    @Test
    void rejectsNullContentType() {
        assertThrows(BadRequestException.class,
                () -> service.validate(pdf(), null, "bill"));
    }

    @Test
    void rejectsFileExceedingMaxBytes() {
        byte[] big = new byte[2048]; // > 1024 limit
        big[0] = 0x25; big[1] = 0x50; big[2] = 0x44; big[3] = 0x46;
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.validate(big, "application/pdf", "big.pdf"));
        assertTrue(ex.getMessage().contains("File too large"));
    }

    @Test
    void rejectsEmptyFile() {
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.validate(new byte[0], "application/pdf", "empty.pdf"));
        assertTrue(ex.getMessage().contains("empty"));
    }

    @Test
    void rejectsSpoofedContentType() {
        byte[] notReallyPdf = { 0x00, 0x01, 0x02, 0x03 };
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.validate(notReallyPdf, "application/pdf", "fake.pdf"));
        assertTrue(ex.getMessage().contains("does not match PDF"));
    }

    @Test
    void sha256IsStableAndHex() {
        String h1 = service.sha256(pdf());
        String h2 = service.sha256(pdf());
        assertEquals(h1, h2);
        assertEquals(64, h1.length()); // SHA-256 hex digest length
        assertTrue(h1.matches("[0-9a-f]{64}"));
    }
}
