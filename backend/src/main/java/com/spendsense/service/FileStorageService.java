package com.spendsense.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.spendsense.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Service for file storage operations backed by Appwrite Storage.
 * Receipts and exports are stored in separate Appwrite buckets, eliminating
 * the dependency on local disk (which is ephemeral on Render free tier).
 *
 * <p>The "filename" stored in the database uses the format {@code {fileId}.{ext}}.
 * The fileId is a UUID that maps directly to the Appwrite file ID in the bucket.
 * Strip the extension to derive the fileId when making Appwrite API calls.</p>
 */
@Service
@Slf4j
public class FileStorageService {

    private final String appwriteEndpoint;
    private final String receiptsBucketId;
    private final String exportsBucketId;
    private final List<String> allowedMimeTypes;
    private final long maxFileSizeBytes;
    private final Tika tika;
    private final RestTemplate appwriteRestTemplate;
    private final ObjectMapper objectMapper;

    public FileStorageService(
            @Value("${appwrite.endpoint}") String appwriteEndpoint,
            @Value("${appwrite.receipts-bucket-id}") String receiptsBucketId,
            @Value("${appwrite.exports-bucket-id}") String exportsBucketId,
            @Value("${file.upload.max-size-mb:10}") long maxSizeMb,
            @Qualifier("appwriteRestTemplate") RestTemplate appwriteRestTemplate,
            ObjectMapper objectMapper) {

        this.appwriteEndpoint = appwriteEndpoint;
        this.receiptsBucketId = receiptsBucketId;
        this.exportsBucketId = exportsBucketId;
        this.allowedMimeTypes = Arrays.asList(
                "image/jpeg", "image/png", "image/jpg",
                "image/heic", "image/webp", "application/pdf"
        );
        this.maxFileSizeBytes = maxSizeMb * 1024 * 1024;
        this.tika = new Tika();
        this.appwriteRestTemplate = appwriteRestTemplate;
        this.objectMapper = objectMapper;

        log.info("FileStorageService initialized with Appwrite endpoint: {}", appwriteEndpoint);
    }

    // ==================== Receipt Methods ====================

    /**
     * Store a receipt in the Appwrite receipts bucket.
     *
     * @return stored filename in format "{uuid}.{ext}" â€” use this as the file reference
     */
    public String storeReceipt(MultipartFile file, UUID userId) {
        validateFile(file);

        String detectedMimeType = detectMimeType(file);
        validateMimeType(detectedMimeType);

        String ext = getFileExtension(Objects.requireNonNull(file.getOriginalFilename()));
        String fileId = UUID.randomUUID().toString();

        try {
            uploadToAppwrite(receiptsBucketId, fileId, file.getBytes(),
                    file.getOriginalFilename(), detectedMimeType);
            String storedFilename = ext.isEmpty() ? fileId : fileId + "." + ext;
            log.info("Receipt stored in Appwrite. fileId={}, user={}", fileId, userId);
            return storedFilename;
        } catch (IOException e) {
            log.error("Could not read file bytes for receipt upload", e);
            throw new RuntimeException("Could not store receipt file", e);
        }
    }

    /**
     * Retrieve receipt bytes from the Appwrite receipts bucket.
     */
    public byte[] getReceiptBytes(String filename) {
        String fileId = extractFileId(filename);
        return downloadFromAppwrite(receiptsBucketId, fileId);
    }

    /**
     * Detect MIME type of a stored receipt by fetching it and running Tika.
     */
    public String getFileMimeType(String filename) {
        try {
            byte[] bytes = getReceiptBytes(filename);
            return tika.detect(bytes);
        } catch (Exception e) {
            log.warn("Could not detect MIME type for {}: {}", filename, e.getMessage());
            return "application/octet-stream";
        }
    }

    /**
     * Delete a receipt from the Appwrite receipts bucket.
     */
    public void deleteReceipt(String filename) {
        String fileId = extractFileId(filename);
        deleteFromAppwrite(receiptsBucketId, fileId);
        log.info("Receipt deleted from Appwrite: {}", filename);
    }

    // ==================== Export Methods ====================

    /**
     * Store an export file (CSV/PDF) in the Appwrite exports bucket.
     *
     * <p>The filename without its extension is used as the Appwrite fileId.
     * For example, {@code transactions_20260227_145206.csv} â†’ fileId {@code transactions_20260227_145206}.</p>
     *
     * @return original filename (unchanged), which callers use to retrieve the file
     */
    public String storeExport(byte[] data, String filename) {
        String fileId = stripExtension(filename);
        String mimeType = filename.endsWith(".pdf") ? "application/pdf" : "text/csv";

        uploadToAppwrite(exportsBucketId, fileId, data, filename, mimeType);
        log.info("Export stored in Appwrite. filename={}", filename);
        return filename;
    }

    /**
     * Delete export files older than {@code retentionHours} hours from the exports bucket.
     * Lists all files in the bucket, checks their Appwrite {@code $createdAt} timestamp,
     * and deletes those that have exceeded the retention window.
     *
     * @return number of files deleted
     */
    public int deleteOldExports(int retentionHours) {
        int deleted = 0;
        try {
            Instant cutoff = Instant.now().minusSeconds((long) retentionHours * 3600);

            String url = appwriteEndpoint + "/storage/buckets/" + exportsBucketId
                    + "/files?queries[]=limit(100)";
            String response = appwriteRestTemplate.getForObject(url, String.class);
            if (response == null) {
                log.warn("Empty response when listing exports bucket for cleanup");
                return 0;
            }

            JsonNode root = objectMapper.readTree(response);
            for (JsonNode fileNode : root.path("files")) {
                String fileId = fileNode.path("$id").asText();
                String createdAtRaw = fileNode.path("$createdAt").asText();
                try {
                    Instant created = Instant.parse(createdAtRaw);
                    if (created.isBefore(cutoff)) {
                        deleteFromAppwrite(exportsBucketId, fileId);
                        deleted++;
                        log.debug("Deleted expired export: {}", fileId);
                    }
                } catch (Exception e) {
                    log.warn("Could not parse $createdAt '{}' for file '{}': {}",
                            createdAtRaw, fileId, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error during export cleanup", e);
        }
        log.info("Export cleanup complete. Deleted {} expired file(s).", deleted);
        return deleted;
    }

    /**
     * Get export file bytes from the Appwrite exports bucket.
     */
    public byte[] getExportBytes(String filename) {
        String fileId = stripExtension(filename);
        return downloadFromAppwrite(exportsBucketId, fileId);
    }

    // ==================== Appwrite REST Helpers ====================

    private void uploadToAppwrite(String bucketId, String fileId,
                                  byte[] data, String originalFilename, String mimeType) {
        String url = appwriteEndpoint + "/storage/buckets/" + bucketId + "/files";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("fileId", fileId);
        body.add("file", new NamedByteArrayResource(data, originalFilename));

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        appwriteRestTemplate.postForObject(url, request, String.class);
    }

    private byte[] downloadFromAppwrite(String bucketId, String fileId) {
        String url = appwriteEndpoint + "/storage/buckets/" + bucketId
                + "/files/" + fileId + "/download";
        ResponseEntity<byte[]> response = appwriteRestTemplate.getForEntity(url, byte[].class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Failed to download file from Appwrite: " + fileId);
        }
        return response.getBody();
    }

    private void deleteFromAppwrite(String bucketId, String fileId) {
        try {
            String url = appwriteEndpoint + "/storage/buckets/" + bucketId + "/files/" + fileId;
            appwriteRestTemplate.delete(url);
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("File not found in Appwrite (skipping delete): {}", fileId);
        } catch (Exception e) {
            log.error("Error deleting file '{}' from Appwrite bucket '{}': {}",
                    fileId, bucketId, e.getMessage());
        }
    }

    // ==================== Inner class: named multipart resource ====================

    /**
     * ByteArrayResource that exposes a filename for multipart uploads,
     * allowing RestTemplate to set the correct Content-Disposition header.
     */
    private static class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        NamedByteArrayResource(byte[] data, String filename) {
            super(data);
            this.filename = filename != null ? filename : "file";
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Extracts the Appwrite fileId from a stored filename.
     * Format is "{fileId}.{ext}" â€” strip the last extension to get the fileId.
     */
    private String extractFileId(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new BadRequestException("Invalid filename: blank or null");
        }
        return stripExtension(filename);
    }

    private String stripExtension(String filename) {
        if (filename == null) return "";
        int lastDot = filename.lastIndexOf('.');
        return (lastDot == -1) ? filename : filename.substring(0, lastDot);
    }

    // ==================== Validation Methods ====================

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new BadRequestException(
                    String.format("File size exceeds maximum limit of %d MB",
                            maxFileSizeBytes / 1024 / 1024));
        }
        String filename = file.getOriginalFilename();
        if (filename == null || filename.contains("\0") || filename.contains("..")) {
            throw new BadRequestException("Invalid filename");
        }
    }

    private String detectMimeType(MultipartFile file) {
        try {
            return tika.detect(file.getInputStream());
        } catch (IOException e) {
            throw new RuntimeException("Failed to detect MIME type", e);
        }
    }

    private void validateMimeType(String mimeType) {
        if (!allowedMimeTypes.contains(mimeType)) {
            throw new BadRequestException(
                    "File type not allowed. Supported: " + String.join(", ", allowedMimeTypes));
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null) return "";
        String cleaned = StringUtils.cleanPath(filename);
        int lastDot = cleaned.lastIndexOf('.');
        return (lastDot == -1) ? "" : cleaned.substring(lastDot + 1).toLowerCase();
    }
}

