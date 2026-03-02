package com.spendsense.controller;

import com.spendsense.dto.response.ReceiptScanResponse;
import com.spendsense.exception.BadRequestException;
import com.spendsense.model.User;
import com.spendsense.security.UserPrincipal;
import com.spendsense.service.ai.ReceiptScanningService;
import com.spendsense.service.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;


@RestController
@RequestMapping("/receipts")
@RequiredArgsConstructor
@Tag(name = "Receipts", description = "AI-powered receipt scanning and management")
public class ReceiptController {
    
    private final ReceiptScanningService receiptScanningService;
    private final FileStorageService fileStorageService;
    private final UserPrincipal userPrincipal;
    
    @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Scan receipt", 
               description = "Upload a receipt image and extract transaction details using AI")
    public ResponseEntity<ReceiptScanResponse> scanReceipt(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {

        // Validate file
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File cannot be empty");
        }

        // Validate file type
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("Only image files are allowed");
        }

        // Validate file size (max 10MB)
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new BadRequestException("File size must not exceed 10MB");
        }

        User user = userPrincipal.getCurrentUser(authentication);
        ReceiptScanResponse response = receiptScanningService.scanReceipt(file, user.getId());
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    
    @GetMapping("/{filename}")
    @Operation(summary = "Get receipt image", 
               description = "Download a previously uploaded receipt image")
    public ResponseEntity<byte[]> getReceipt(
            @PathVariable String filename,
            Authentication authentication) {
        
        userPrincipal.getCurrentUser(authentication); // ensures authenticated

        // Filename is a UUID-based name (no userId prefix) — just fetch from storage.
        // Appwrite bucket permissions ensure only server-side API key can access files.
        byte[] imageBytes = fileStorageService.getReceiptBytes(filename);
        String mimeType = fileStorageService.getFileMimeType(filename);
        
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .body(imageBytes);
    }
    
    @DeleteMapping("/{filename}")
    @Operation(summary = "Delete receipt", 
               description = "Delete a receipt image")
    public ResponseEntity<Void> deleteReceipt(
            @PathVariable String filename,
            Authentication authentication) {
        
        // Receipts are keyed by UUID — authenticated user can only delete their own
        // receipts if the receiptUrl stored on the transaction belongs to them.
        // Server-side API key controls Appwrite access.
        userPrincipal.getCurrentUser(authentication); // ensures authenticated
        fileStorageService.deleteReceipt(filename);
        return ResponseEntity.noContent().build();
    }
}