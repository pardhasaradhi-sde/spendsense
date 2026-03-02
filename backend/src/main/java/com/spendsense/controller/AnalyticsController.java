package com.spendsense.controller;

import com.spendsense.dto.response.AnalyticsResponse;
import com.spendsense.model.User;
import com.spendsense.security.UserPrincipal;
import com.spendsense.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "Advanced analytics and reporting APIs")
public class AnalyticsController {

        private final AnalyticsService analyticsService;
        private final UserPrincipal userPrincipal;

        @GetMapping
        @Operation(summary = "Get comprehensive analytics", description = "Get detailed financial analytics including income, expense, savings, and trends")
        public ResponseEntity<AnalyticsResponse> getAnalytics(
                        @Parameter(hidden = true) Authentication authentication,
                        @RequestParam(defaultValue = "6") int months,
                        @RequestParam(defaultValue = "false") boolean refresh) {

                User user = userPrincipal.getCurrentUser(authentication);
                AnalyticsResponse analytics = refresh
                                ? analyticsService.refreshAnalytics(user.getId(), months)
                                : analyticsService.getAnalytics(user.getId(), months);

                return ResponseEntity.ok(analytics);
        }

        @GetMapping("/trends")
        @Operation(summary = "Get monthly spending trends", description = "Get month-by-month spending trends for the specified period")
        public ResponseEntity<Map<String, BigDecimal>> getMonthlyTrends(
                        @Parameter(hidden = true) Authentication authentication,
                        @RequestParam(defaultValue = "12") int months) {

                User user = userPrincipal.getCurrentUser(authentication);
                Map<String, BigDecimal> trends = analyticsService.getMonthlyTrends(user.getId(), months);

                return ResponseEntity.ok(trends);
        }

        @GetMapping("/categories")
        @Operation(summary = "Get category-wise analysis", description = "Get spending breakdown by category for the specified period")
        public ResponseEntity<Map<String, BigDecimal>> getCategoryAnalysis(
                        @Parameter(hidden = true) Authentication authentication,
                        @RequestParam(defaultValue = "6") int months) {

                User user = userPrincipal.getCurrentUser(authentication);
                Map<String, BigDecimal> categoryData = analyticsService.getCategoryAnalysis(user.getId(), months);

                return ResponseEntity.ok(categoryData);
        }

        @GetMapping("/comparison")
        @Operation(summary = "Get spending comparison", description = "Compare current month spending vs last month")
        public ResponseEntity<Map<String, Object>> getSpendingComparison(
                        @Parameter(hidden = true) Authentication authentication) {

                User user = userPrincipal.getCurrentUser(authentication);
                Map<String, Object> comparison = analyticsService.getSpendingComparison(user.getId());

                return ResponseEntity.ok(comparison);
        }
}
