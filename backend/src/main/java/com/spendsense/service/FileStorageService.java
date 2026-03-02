package com.spendsense.service;

import com.spendsense.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Service for secure file storage operations using Spring's MultipartFile
 */
@Service
@Slf4j
public class FileStorageService {

    private final Path receiptStorageLocation;
    private final Path exportStorageLocation;
    private final List<String> allowedMimeTypes;
    private final long maxFileSizeBytes;
    private final Tika tika;

    public FileStorageService(
            @Value("${file.storage.receipts-dir}") String receiptsDir,
            @Value("${file.storage.exports-dir}") String exportsDir,
            @Value("${file.upload.max-size-mb:10}") long maxSizeMb) {

        this.receiptStorageLocation = Paths.get(receiptsDir).toAbsolutePath().normalize();
        this.exportStorageLocation = Paths.get(exportsDir).toAbsolutePath().normalize();
        this.allowedMimeTypes = Arrays.asList(
                "image/jpeg", "image/png", "image/jpg",
                "image/heic", "image/webp", "application/pdf"
        );
        this.maxFileSizeBytes = maxSizeMb * 1024 * 1024;
        this.tika = new Tika();

        try {
            Files.createDirectories(this.receiptStorageLocation);
            Files.createDirectories(this.exportStorageLocation);
            log.info("File storage initialized - Receipts: {}, Exports: {}",
                    receiptStorageLocation, exportStorageLocation);
        } catch (Exception ex) {
            log.error("Could not create storage directories!", ex);
            throw new RuntimeException("Could not create storage directories!", ex);
        }
    }

    /**
     * Store receipt file with validation
     */
    public String storeReceipt(MultipartFile file, UUID userId) {
        validateFile(file);

        String extension = getFileExtension(file.getOriginalFilename());
        String newFilename = String.format("%s_%d_%s.%s",
                userId.toString(),
                System.currentTimeMillis(),
                UUID.randomUUID().toString().substring(0, 8),
                extension
        );

        try {
            // Verify MIME type
            String detectedMimeType = tika.detect(file.getInputStream());
            if (!allowedMimeTypes.contains(detectedMimeType)) {
                throw new BadRequestException("File type not allowed: " + detectedMimeType);
            }

            // Store file
            Path targetLocation = receiptStorageLocation.resolve(newFilename);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            log.info("Receipt stored: {}", newFilename);
            return newFilename;

        } catch (IOException ex) {
            log.error("Could not store receipt file", ex);
            throw new RuntimeException("Could not store receipt file", ex);
        }
    }

    /**
     * Get receipt file as byte array for AI processing
     */
    public byte[] getReceiptBytes(String filename) {
        try {
            Path filePath = receiptStorageLocation.resolve(filename).normalize();

            if (!filePath.startsWith(receiptStorageLocation)) {
                throw new BadRequestException("Invalid file path");
            }

            if (!Files.exists(filePath)) {
                throw new BadRequestException("File not found: " + filename);
            }

            return Files.readAllBytes(filePath);

        } catch (IOException ex) {
            log.error("Could not read receipt file: {}", filename, ex);
            throw new RuntimeException("Could not read receipt file", ex);
        }
    }

    /**
     * Get MIME type of stored file
     */
    public String getFileMimeType(String filename) {
        try {
            Path filePath = receiptStorageLocation.resolve(filename).normalize();
            if (!filePath.startsWith(receiptStorageLocation)) {
                throw new BadRequestException("Invalid file path");
            }
            byte[] fileBytes = Files.readAllBytes(filePath);
            return tika.detect(fileBytes);
        } catch (IOException ex) {
            log.error("Could not detect MIME type for file: {}", filename, ex);
            return "application/octet-stream";
        }
    }

    /**
     * Delete receipt file
     */
    public void deleteReceipt(String filename) {
        try {
            Path filePath = receiptStorageLocation.resolve(filename).normalize();
            if (!filePath.startsWith(receiptStorageLocation)) {
                throw new BadRequestException("Invalid file path");
            }
            Files.deleteIfExists(filePath);
            log.info("Receipt deleted: {}", filename);
        } catch (IOException ex) {
            log.error("Could not delete receipt: {}", filename, ex);
        }
    }

    /**
     * Store export file (CSV/PDF)
     */
    public String storeExport(byte[] data, String filename) {
        try {
            Path targetLocation = exportStorageLocation.resolve(filename).normalize();
            if (!targetLocation.startsWith(exportStorageLocation)) {
                throw new BadRequestException("Invalid export filename");
            }
            Files.write(targetLocation, data);
            log.info("Export file stored: {}", filename);
            return filename;
        } catch (IOException ex) {
            log.error("Could not store export file", ex);
            throw new RuntimeException("Could not store export file", ex);
        }
    }

    /**
     * Delete export files older than {@code retentionHours} hours.
     * Called by CleanupScheduler weekly (configurable).
     *
     * @return number of files deleted
     */
    public int deleteOldExports(int retentionHours) {
        int deleted = 0;
        try {
            long cutoffMillis = System.currentTimeMillis() - (long) retentionHours * 3600 * 1000;
            try (var stream = Files.list(exportStorageLocation)) {
                for (Path file : stream.toList()) {
                    try {
                        if (Files.isRegularFile(file) &&
                                Files.getLastModifiedTime(file).toMillis() < cutoffMillis) {
                            Files.delete(file);
                            deleted++;
                            log.debug("Deleted expired export file: {}", file.getFileName());
                        }
                    } catch (IOException e) {
                        log.warn("Could not delete export file {}: {}", file.getFileName(), e.getMessage());
                    }
                }
            }
        } catch (IOException e) {
            log.error("Error listing exports directory for cleanup", e);
        }
        log.info("Export cleanup complete. Deleted {} expired file(s).", deleted);
        return deleted;
    }

    /**
     * Get export file
     */
    public byte[] getExportBytes(String filename) {
        try {
            Path filePath = exportStorageLocation.resolve(filename).normalize();

            if (!filePath.startsWith(exportStorageLocation)) {
                throw new BadRequestException("Invalid file path");
            }

            return Files.readAllBytes(filePath);

        } catch (IOException ex) {
            log.error("Could not read export file: {}", filename, ex);
            throw new RuntimeException("Could not read export file", ex);
        }
    }

    // ==================== Validation Methods ====================

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }

        if (file.getSize() > maxFileSizeBytes) {
            throw new BadRequestException(
                    String.format("File size exceeds maximum limit of %d MB",
                            maxFileSizeBytes / 1024 / 1024)
            );
        }

        String filename = file.getOriginalFilename();
        if (filename == null || filename.contains("\0") || filename.contains("..")) {
            throw new BadRequestException("Invalid filename");
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null) {
            return "";
        }
        String cleanedFilename = StringUtils.cleanPath(filename);
        int lastDot = cleanedFilename.lastIndexOf('.');
        return (lastDot == -1) ? "" : cleanedFilename.substring(lastDot + 1).toLowerCase();
    }
}