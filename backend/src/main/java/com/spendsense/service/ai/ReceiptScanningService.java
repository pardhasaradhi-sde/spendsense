package com.spendsense.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spendsense.dto.response.ReceiptScanResponse;
import com.spendsense.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * AI-powered receipt scanning service using Gemini Vision
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReceiptScanningService {

    private final GeminiClientService geminiClient;
    private final FileStorageService fileStorageService;
    private final ObjectMapper objectMapper;

    /**
     * Scan receipt and extract transaction details
     */
    public ReceiptScanResponse scanReceipt(MultipartFile file, UUID userId) {
        log.info("Scanning receipt for user: {}", userId);

        try {
            // Read bytes and MIME type directly from the uploaded file —
            // no need to upload to Appwrite and download back just for AI scanning.
            byte[] imageBytes = file.getBytes();
            String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";

            // Store the receipt in Appwrite (for later retrieval via /receipts/{filename})
            String storedFilename = fileStorageService.storeReceipt(file, userId);

            // Call Gemini Vision API
            String aiResponse = geminiClient.generateContentWithImage(
                    buildReceiptPrompt(), imageBytes, mimeType);

            // Parse response
            ReceiptScanResponse response = parseReceiptResponse(aiResponse);
            response.setReceiptUrl("/api/v1/receipts/" + storedFilename);

            log.info("Receipt scanned successfully: {}", storedFilename);
            return response;

        } catch (Exception e) {
            log.error("Error scanning receipt for user: {}", userId, e);
            throw new RuntimeException("Failed to scan receipt: " + e.getMessage(), e);
        }
    }

    private String buildReceiptPrompt() {
        return """
                Analyze this receipt image and extract the following information:
                1. Merchant/Store name
                2. Total amount (as a number)
                3. Transaction date (in ISO format: yyyy-MM-dd)
                4. Transaction time (if available, in HH:mm format)
                5. Category (e.g., Groceries, Restaurant, Gas, Shopping, etc.)
                6. Payment method (if visible)
                7. Tax amount (if visible)
                8. Individual items with their prices (if clearly visible)

                Return ONLY valid JSON with this exact structure:
                {
                  "merchantName": "Store Name",
                  "amount": 123.45,
                  "date": "2026-02-04",
                  "time": "14:30",
                  "category": "Groceries",
                  "paymentMethod": "Credit Card",
                  "taxAmount": "12.34",
                  "items": [
                    {"name": "Item 1", "quantity": 1, "price": 10.00, "total": 10.00}
                  ],
                  "confidence": 0.95
                }

                If you cannot determine a field with confidence, use null or omit it.
                The confidence score should be between 0 and 1, indicating how confident you are about the extraction.
                """;
    }

    private ReceiptScanResponse parseReceiptResponse(String aiResponse) {
        try {
            // Extract JSON object from AI response (handles markdown wrappers, preamble,
            // etc.)
            String cleanedResponse = extractJsonObject(aiResponse);

            Map<String, Object> responseMap = objectMapper.readValue(cleanedResponse, Map.class);

            // Parse amount
            BigDecimal amount = responseMap.get("amount") != null
                    ? new BigDecimal(responseMap.get("amount").toString())
                    : BigDecimal.ZERO;

            // Parse date and time
            LocalDateTime transactionDate = parseDateTime(
                    (String) responseMap.get("date"),
                    (String) responseMap.get("time"));

            // Parse confidence
            Double confidence = responseMap.get("confidence") != null
                    ? Double.parseDouble(responseMap.get("confidence").toString())
                    : 0.8;

            // Parse items
            List<ReceiptScanResponse.ReceiptItem> items = parseItems(
                    (List<Map<String, Object>>) responseMap.get("items"));

            return ReceiptScanResponse.builder()
                    .merchantName((String) responseMap.get("merchantName"))
                    .amount(amount)
                    .transactionDate(transactionDate)
                    .category((String) responseMap.get("category"))
                    .description("Receipt from " + responseMap.get("merchantName"))
                    .paymentMethod((String) responseMap.get("paymentMethod"))
                    .taxAmount((String) responseMap.get("taxAmount"))
                    .items(items)
                    .confidence(confidence)
                    .build();

        } catch (Exception e) {
            log.error("Error parsing receipt response", e);

            // Return a basic response with low confidence
            return ReceiptScanResponse.builder()
                    .merchantName("Unknown")
                    .amount(BigDecimal.ZERO)
                    .transactionDate(LocalDateTime.now())
                    .category("Uncategorized")
                    .description("Failed to parse receipt. Please enter details manually.")
                    .confidence(0.0)
                    .build();
        }
    }

    private LocalDateTime parseDateTime(String dateStr, String timeStr) {
        try {
            if (dateStr != null) {
                LocalDateTime date = LocalDateTime.parse(dateStr + "T00:00:00");

                if (timeStr != null && !timeStr.isEmpty()) {
                    String[] timeParts = timeStr.split(":");
                    if (timeParts.length >= 2) {
                        date = date.withHour(Integer.parseInt(timeParts[0]))
                                .withMinute(Integer.parseInt(timeParts[1]));
                    }
                }

                return date;
            }
        } catch (Exception e) {
            log.warn("Failed to parse date/time from receipt", e);
        }

        return LocalDateTime.now();
    }

    private List<ReceiptScanResponse.ReceiptItem> parseItems(List<Map<String, Object>> itemsData) {
        if (itemsData == null || itemsData.isEmpty()) {
            return List.of();
        }

        return itemsData.stream()
                .map(item -> ReceiptScanResponse.ReceiptItem.builder()
                        .name((String) item.get("name"))
                        .quantity(item.get("quantity") != null
                                ? Integer.parseInt(item.get("quantity").toString())
                                : 1)
                        .price(item.get("price") != null
                                ? new BigDecimal(item.get("price").toString())
                                : BigDecimal.ZERO)
                        .total(item.get("total") != null
                                ? new BigDecimal(item.get("total").toString())
                                : BigDecimal.ZERO)
                        .build())
                .toList();
    }

    /**
     * Extracts the first JSON object {...} from a string that may contain markdown
     * or other text.
     */
    private String extractJsonObject(String text) {
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\{[\\s\\S]*\\}",
                java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group();
        }
        // Fallback: strip markdown fences and return
        return text.replaceAll("(?s)```json\\s*", "").replaceAll("```", "").trim();
    }
}