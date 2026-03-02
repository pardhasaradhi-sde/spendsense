package com.spendsense.controller;

import com.spendsense.dto.response.SpendingInsightResponse;
import com.spendsense.model.User;
import com.spendsense.security.UserPrincipal;
import com.spendsense.service.ai.AiInsightsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/ai/insights")
@RequiredArgsConstructor
@Tag(name = "AI Insights", description = "AI-powered financial insights and recommendations")
public class AiInsightsController {

    private final AiInsightsService aiInsightsService;
    private final UserPrincipal userPrincipal;

    @GetMapping
    @Operation(summary = "Get AI spending insights", description = "Returns cached (Redis 48h → DB 48h) insights, or generates fresh from Gemini")
    public ResponseEntity<SpendingInsightResponse> getSpendingInsights(Authentication authentication) {
        User user = userPrincipal.getCurrentUser(authentication);
        SpendingInsightResponse insights = aiInsightsService.generateSpendingInsights(user.getId());
        return ResponseEntity.ok(insights);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh AI spending insights", description = "Evicts Redis cache + deletes DB row, then regenerates fresh insights from Gemini")
    public ResponseEntity<SpendingInsightResponse> refreshSpendingInsights(Authentication authentication) {
        User user = userPrincipal.getCurrentUser(authentication);
        SpendingInsightResponse insights = aiInsightsService.refreshSpendingInsights(user.getId());
        return ResponseEntity.ok(insights);
    }

    @GetMapping("/anomalies")
    @Operation(summary = "Detect spending anomalies", description = "Use AI to detect unusual spending patterns")
    public ResponseEntity<List<String>> detectAnomalies(Authentication authentication) {
        User user = userPrincipal.getCurrentUser(authentication);
        List<String> anomalies = aiInsightsService.detectAnomalies(user.getId());
        return ResponseEntity.ok(anomalies);
    }

    @GetMapping("/recommendations")
    @Operation(summary = "Get budget recommendations", description = "Get AI-generated budget recommendations based on spending patterns")
    public ResponseEntity<List<String>> getBudgetRecommendations(Authentication authentication) {
        User user = userPrincipal.getCurrentUser(authentication);
        List<String> recommendations = aiInsightsService.generateBudgetRecommendations(user.getId());
        return ResponseEntity.ok(recommendations);
    }
}