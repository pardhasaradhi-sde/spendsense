package com.spendsense.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.spendsense.dto.response.SpendingInsightResponse;
import com.spendsense.model.AiInsight;
import com.spendsense.model.Budget;
import com.spendsense.model.Transaction;
import com.spendsense.model.User;
import com.spendsense.model.enums.TransactionType;
import com.spendsense.repository.AiInsightRepository;
import com.spendsense.repository.BudgetRepository;
import com.spendsense.repository.TransactionRepository;
import com.spendsense.repository.UserRepository;
import com.spendsense.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AI-powered spending insights service using Gemini.
 *
 * Persistence strategy (3-layer):
 * 1. @Cacheable("aiInsights") → Redis 48h TTL
 * 2. DB (ai_insights table) → checked on Redis miss, valid for 48h after
 * generation
 * 3. Gemini API call → only on DB miss or expired row
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiInsightsService {

    private final GeminiClientService geminiClient;
    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final AiInsightRepository aiInsightRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private static final int INSIGHTS_TTL_HOURS = 48;

    // ==================== Main Insights ====================

    /**
     * Get spending insights for a user.
     * Lookup order: Redis (48h TTL) → DB (expiresAt check) → Gemini API
     */
    @Cacheable(value = "aiInsights", key = "#userId.toString()")
    @Transactional
    public SpendingInsightResponse generateSpendingInsights(UUID userId) {
        log.info("[CACHE LAYER] ❌ Redis MISS for user: {}. Checking Database...", userId);

        // DB check: valid (non-expired) row?
        Optional<AiInsight> existing = aiInsightRepository.findByUserId(userId);
        if (existing.isPresent() && existing.get().getExpiresAt().isAfter(LocalDateTime.now())) {
            log.info("[CACHE LAYER] ✅ Database HIT for user: {} (expires: {})", userId, existing.get().getExpiresAt());
            return toResponse(existing.get());
        }

        log.info("[CACHE LAYER] ❌ Database MISS/EXPIRED. Calling Gemini API... \uD83E\uDD16");
        // Both miss — call Gemini
        return generateAndPersist(userId, existing);
    }

    /**
     * Force-refresh insights: evict Redis, delete DB row, regenerate via Gemini.
     * Called by POST /ai/insights/refresh
     */
    @CacheEvict(value = "aiInsights", key = "#userId.toString()")
    @Transactional
    public SpendingInsightResponse refreshSpendingInsights(UUID userId) {
        log.info("Force refreshing AI insights for user: {}", userId);
        aiInsightRepository.deleteByUserId(userId);
        return generateAndPersist(userId, Optional.empty());
    }

    // ==================== Anomaly Detection & Budget Recommendations
    // ====================

    public List<String> detectAnomalies(UUID userId) {
        log.info("Detecting spending anomalies for user: {}", userId);
        try {
            LocalDateTime startDate = LocalDateTime.now().minusDays(30);
            List<Transaction> transactions = transactionRepository
                    .findByUserIdAndDateAfterOrderByDateDesc(userId, startDate);
            if (transactions.size() < 10) {
                return List.of("Need more transaction data to detect anomalies (at least 10 transactions)");
            }
            String ctx = buildCompactContext(transactions, budgetRepository.findByUserId(userId).orElse(null));
            String prompt = "Financial advisor. Analyze this user data and return JSON array ONLY (no markdown):\n"
                    + ctx +
                    "\nReturn a JSON array of 2-4 anomaly description strings: [\"anomaly1\",\"anomaly2\"]";
            return parseJsonArray(geminiClient.generateContent(prompt));
        } catch (Exception e) {
            log.error("Error detecting anomalies for user: {}", userId, e);
            return List.of("Unable to detect anomalies at this time");
        }
    }

    public List<String> generateBudgetRecommendations(UUID userId) {
        log.info("Generating budget recommendations for user: {}", userId);
        try {
            LocalDateTime startDate = LocalDateTime.now().minusDays(90);
            List<Transaction> transactions = transactionRepository
                    .findByUserIdAndDateAfterOrderByDateDesc(userId, startDate);
            Budget budget = budgetRepository.findByUserId(userId).orElse(null);
            String ctx = buildCompactContext(transactions, budget);
            String prompt = "Give 3-5 specific budget recommendations. Data:\n" + ctx +
                    "\nReturn JSON array only (no markdown): [\"tip1\",\"tip2\"]";
            return parseJsonArray(geminiClient.generateContent(prompt));
        } catch (Exception e) {
            log.error("Error generating budget recommendations for user: {}", userId, e);
            return List.of("Unable to generate recommendations at this time");
        }
    }

    // ==================== Private: Generate & Persist ====================

    private SpendingInsightResponse generateAndPersist(UUID userId, Optional<AiInsight> existing) {
        try {
            LocalDateTime startDate = LocalDateTime.now().minusDays(90);
            List<Transaction> transactions = transactionRepository
                    .findByUserIdAndDateAfterOrderByDateDesc(userId, startDate);

            if (transactions.isEmpty()) {
                return SpendingInsightResponse.builder()
                        .summary("No transaction data available yet. Start tracking your expenses!")
                        .recommendations(List.of("Add your first transaction to get personalized insights"))
                        .build();
            }

            Budget budget = budgetRepository.findByUserId(userId).orElse(null);
            String ctx = buildCompactContext(transactions, budget);
            String prompt = buildInsightsPrompt(ctx);

            SpendingInsightResponse response = parseInsightsResponse(geminiClient.generateContent(prompt));

            // Persist to DB (upsert: update existing row or create new)
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            AiInsight insight = existing.orElse(AiInsight.builder().user(user).build());
            insight.setSummary(response.getSummary());
            insight.setRecommendations(toJson(response.getRecommendations()));
            insight.setPatterns(toJson(response.getPatterns()));
            insight.setTopCategories(toJson(response.getTopCategories()));
            insight.setExpiresAt(LocalDateTime.now().plusHours(INSIGHTS_TTL_HOURS));
            aiInsightRepository.save(insight);

            log.info("AI insights persisted to DB for user: {} (expires in {}h)", userId, INSIGHTS_TTL_HOURS);
            return response;

        } catch (Exception e) {
            log.error("Error generating AI insights for user: {}", userId, e);
            return SpendingInsightResponse.builder()
                    .summary("Unable to generate insights at this time. Please try again later.")
                    .build();
        }
    }

    // ==================== Mapping ====================

    private SpendingInsightResponse toResponse(AiInsight insight) {
        return SpendingInsightResponse.builder()
                .summary(insight.getSummary())
                .recommendations(fromJson(insight.getRecommendations()))
                .patterns(fromJson(insight.getPatterns()))
                .topCategories(fromJson(insight.getTopCategories()))
                .build();
    }

    private String toJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list != null ? list : List.of());
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank())
            return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    // ==================== Helpers ====================

    private String buildCompactContext(List<Transaction> transactions, Budget budget) {
        Map<String, BigDecimal> expenseByCategory = transactions.stream()
                .filter(t -> t.getType() == TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() != null ? t.getCategory() : "Other",
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));

        BigDecimal totalExpense = calculateTotalByType(transactions, TransactionType.EXPENSE);
        BigDecimal totalIncome = calculateTotalByType(transactions, TransactionType.INCOME);

        StringBuilder sb = new StringBuilder();
        sb.append("{\"income\":").append(totalIncome.setScale(2, RoundingMode.HALF_UP))
                .append(",\"expense\":").append(totalExpense.setScale(2, RoundingMode.HALF_UP))
                .append(",\"txCount\":").append(transactions.size());

        if (budget != null) {
            sb.append(",\"budget\":").append(budget.getAmount().setScale(2, RoundingMode.HALF_UP));
        }

        sb.append(",\"categories\":{");
        boolean first = true;
        for (Map.Entry<String, BigDecimal> e : expenseByCategory.entrySet()) {
            if (!first)
                sb.append(",");
            sb.append("\"").append(e.getKey()).append("\":").append(e.getValue().setScale(2, RoundingMode.HALF_UP));
            first = false;
        }
        sb.append("}}");
        return sb.toString();
    }

    private BigDecimal calculateTotalByType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
                .filter(t -> t.getType() == type)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String buildInsightsPrompt(String ctx) {
        return "Financial advisor. Analyze this user data and return JSON ONLY (no markdown):\n" + ctx +
                "\nReturn: {\"summary\":\"2 sentences\",\"recommendations\":[\"3-5 specific tips\"]," +
                "\"patterns\":[\"2-3 key patterns\"],\"topCategories\":[\"Cat: $amt\"]}";
    }

    private SpendingInsightResponse parseInsightsResponse(String aiResponse) {
        try {
            String jsonContent = extractJsonObject(aiResponse);
            Map<String, Object> responseMap = objectMapper.readValue(jsonContent, Map.class);
            return SpendingInsightResponse.builder()
                    .summary((String) responseMap.get("summary"))
                    .recommendations((List<String>) responseMap.getOrDefault("recommendations", List.of()))
                    .patterns((List<String>) responseMap.getOrDefault("patterns", List.of()))
                    .topCategories((List<String>) responseMap.getOrDefault("topCategories", List.of()))
                    .build();
        } catch (JsonProcessingException e) {
            log.error("Error parsing AI insights response: {}", e.getMessage());
            return SpendingInsightResponse.builder()
                    .summary(aiResponse.length() > 500 ? aiResponse.substring(0, 500) + "..." : aiResponse)
                    .recommendations(List.of("Unable to parse detailed insights"))
                    .build();
        }
    }

    private List<String> parseJsonArray(String aiResponse) {
        try {
            return objectMapper.readValue(extractJsonArray(aiResponse), new TypeReference<>() {
            });
        } catch (JsonProcessingException e) {
            log.error("Error parsing JSON array from AI response: {}", e.getMessage());
            return List.of(aiResponse.length() > 200 ? aiResponse.substring(0, 200) : aiResponse);
        }
    }

    private String extractJsonObject(String text) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("\\{[\\s\\S]*\\}", java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher m = p.matcher(text);
        return m.find() ? m.group() : text.replaceAll("(?s)```json\\s*", "").replaceAll("```", "").trim();
    }

    private String extractJsonArray(String text) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("\\[[\\s\\S]*\\]", java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher m = p.matcher(text);
        return m.find() ? m.group() : text.replaceAll("(?s)```json\\s*", "").replaceAll("```", "").trim();
    }
}