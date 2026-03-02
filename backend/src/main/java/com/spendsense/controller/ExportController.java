package com.spendsense.controller;

import com.spendsense.model.User;
import com.spendsense.security.UserPrincipal;
import com.spendsense.service.ExportService;
import com.spendsense.service.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/export")
@RequiredArgsConstructor
@Tag(name = "Export", description = "Data export APIs for CSV and PDF formats")
public class ExportController {

        private final ExportService exportService;
        private final FileStorageService fileStorageService;
        private final UserPrincipal userPrincipal;

        @GetMapping("/csv")
        @Operation(summary = "Export transactions to CSV", description = "Export all transactions or filtered by date range to CSV format")
        public ResponseEntity<byte[]> exportToCsv(
                        @Parameter(hidden = true) Authentication authentication,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {

                User user = userPrincipal.getCurrentUser(authentication);
                byte[] csvData = exportService.exportToCsv(user.getId(), startDate, endDate);
                String filename = "transactions_" + System.currentTimeMillis() + ".csv";

                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                                .contentType(MediaType.parseMediaType("text/csv"))
                                .body(csvData);
        }

        @GetMapping("/pdf")
        @Operation(summary = "Export transactions to PDF", description = "Export all transactions or filtered by date range to PDF format")
        public ResponseEntity<byte[]> exportToPdf(
                        @Parameter(hidden = true) Authentication authentication,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {

                User user = userPrincipal.getCurrentUser(authentication);
                byte[] pdfData = exportService.exportToPdf(user.getId(), startDate, endDate);
                String filename = "transactions_" + System.currentTimeMillis() + ".pdf";

                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(pdfData);
        }

        @PostMapping("/email")
        @Operation(summary = "Export and email", description = "Generate export, store it, and send a real download link via email")
        public ResponseEntity<String> exportAndEmail(
                        @Parameter(hidden = true) Authentication authentication,
                        @RequestParam String format,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {

                User user = userPrincipal.getCurrentUser(authentication);
                exportService.exportAndEmail(user.getId(), format, startDate, endDate);
                return ResponseEntity.ok("Export will be sent to your email shortly");
        }

        @GetMapping("/download/{filename}")
        @Operation(summary = "Download exported file", description = "Download a previously generated export file sent via email.")
        public ResponseEntity<byte[]> downloadExport(
                        @PathVariable String filename) {

                // No auth required — link is sent via email and opened in browser without a Bearer token.
                // The filename is a timestamped UUID-based name, and files expire after 24 h.
                byte[] data = fileStorageService.getExportBytes(filename);
                String contentType = filename.endsWith(".pdf") ? "application/pdf" : "text/csv";

                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                                .contentType(MediaType.parseMediaType(contentType))
                                .body(data);
        }
}
