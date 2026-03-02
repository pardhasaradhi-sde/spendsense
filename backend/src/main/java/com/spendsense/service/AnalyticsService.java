package com.spendsense.service;

import com.spendsense.dto.response.AnalyticsResponse;
import com.spendsense.model.Transaction;
import com.spendsense.model.enums.TransactionType;
import com.spendsense.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Advanced analytics service for financial data analysis
 * Provides spending trends, category breakdowns, and insights
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AnalyticsService {

    private final TransactionRepository transactionRepository;

    /**
     * Get comprehensive analytics dashboard data (cached for 24h)
     */
    @Cacheable(value = "analyticsCache", key = "#userId.toString() + '-' + #months")
    public AnalyticsResponse getAnalytics(UUID userId, int months) {
        log.info("[CACHE LAYER] ❌ Redis MISS for analytics ({} months). Calculating from DB...", months);
        log.info("Generating analytics for user: {} for last {} months", userId, months);

        LocalDateTime startDate = LocalDateTime.now().minusMonths(months);
        List<Transaction> transactions = transactionRepository
                .findByUserIdAndDateAfterOrderByDateDesc(userId, startDate);

        return AnalyticsResponse.builder()
                .totalIncome(calculateTotalByType(transactions, TransactionType.INCOME))
                .totalExpense(calculateTotalByType(transactions, TransactionType.EXPENSE))
                .netSavings(calculateNetSavings(transactions))
                .categoryBreakdown(getCategoryBreakdown(transactions))
                .monthlyTrends(getMonthlyTrends(transactions))
                .topSpendingCategories(getTopSpendingCategories(transactions, 5))
                .averageMonthlyExpense(calculateAverageMonthlyExpense(transactions, months))
                .transactionCount(transactions.size())
                .savingsRate(calculateSavingsRate(transactions))
                .periodStart(startDate)
                .periodEnd(LocalDateTime.now())
                .build();
    }

    /**
     * Force refresh analytics by evicting the cache and regenerating
     */
    @CacheEvict(value = "analyticsCache", key = "#userId.toString() + '-' + #months")
    public AnalyticsResponse refreshAnalytics(UUID userId, int months) {
        log.info("Force refreshing analytics cache for user: {} ({} months)", userId, months);
        return getAnalytics(userId, months);
    }

    /**
     * Get monthly spending trends
     */
    public Map<String, BigDecimal> getMonthlyTrends(UUID userId, int months) {
        LocalDateTime startDate = LocalDateTime.now().minusMonths(months);
        List<Transaction> transactions = transactionRepository
                .findByUserIdAndDateAfterOrderByDateDesc(userId, startDate);

        return getMonthlyTrends(transactions);
    }

    /**
     * Get category-wise spending analysis
     */
    public Map<String, BigDecimal> getCategoryAnalysis(UUID userId, int months) {
        LocalDateTime startDate = LocalDateTime.now().minusMonths(months);
        List<Transaction> transactions = transactionRepository
                .findByUserIdAndDateAfterOrderByDateDesc(userId, startDate);

        return getCategoryBreakdown(transactions);
    }

    /**
     * Get spending comparison between time periods
     */
    public Map<String, Object> getSpendingComparison(UUID userId) {
        // Current month
        LocalDateTime currentMonthStart = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);
        List<Transaction> currentMonthTransactions = transactionRepository
                .findByUserIdAndDateAfterOrderByDateDesc(userId, currentMonthStart);

        // Last month
        LocalDateTime lastMonthStart = currentMonthStart.minusMonths(1);
        LocalDateTime lastMonthEnd = currentMonthStart.minusSeconds(1);
        List<Transaction> lastMonthTransactions = transactionRepository
                .findByUserIdAndDateBetweenOrderByDateDesc(userId, lastMonthStart, lastMonthEnd);

        BigDecimal currentSpending = calculateTotalByType(currentMonthTransactions, TransactionType.EXPENSE);
        BigDecimal lastSpending = calculateTotalByType(lastMonthTransactions, TransactionType.EXPENSE);

        BigDecimal difference = currentSpending.subtract(lastSpending);
        double percentChange = 0.0;
        if (lastSpending.compareTo(BigDecimal.ZERO) > 0) {
            percentChange = difference.divide(lastSpending, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .doubleValue();
        }

        Map<String, Object> comparison = new HashMap<>();
        comparison.put("currentMonth", currentSpending);
        comparison.put("lastMonth", lastSpending);
        comparison.put("difference", difference);
        comparison.put("percentChange", percentChange);
        comparison.put("trend", difference.compareTo(BigDecimal.ZERO) > 0 ? "INCREASED" : "DECREASED");

        return comparison;
    }

    // ==================== Helper Methods ====================

    private BigDecimal calculateTotalByType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
                .filter(t -> t.getType() == type)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal calculateNetSavings(List<Transaction> transactions) {
        BigDecimal income = calculateTotalByType(transactions, TransactionType.INCOME);
        BigDecimal expense = calculateTotalByType(transactions, TransactionType.EXPENSE);
        return income.subtract(expense);
    }

    private Map<String, BigDecimal> getCategoryBreakdown(List<Transaction> transactions) {
        return transactions.stream()
                .filter(t -> t.getType() == TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() != null ? t.getCategory() : "Uncategorized",
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));
    }

    private Map<String, BigDecimal> getMonthlyTrends(List<Transaction> transactions) {
        Map<String, BigDecimal> trends = new TreeMap<>();

        Map<YearMonth, BigDecimal> monthlyExpenses = transactions.stream()
                .filter(t -> t.getType() == TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(
                        t -> YearMonth.from(t.getDate()),
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));

        monthlyExpenses.forEach((yearMonth, amount) -> trends.put(yearMonth.toString(), amount));

        return trends;
    }

    private List<Map<String, Object>> getTopSpendingCategories(List<Transaction> transactions, int limit) {
        Map<String, BigDecimal> categoryTotals = getCategoryBreakdown(transactions);

        return categoryTotals.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(limit)
                .map(entry -> {
                    Map<String, Object> categoryData = new HashMap<>();
                    categoryData.put("category", entry.getKey());
                    categoryData.put("amount", entry.getValue());
                    return categoryData;
                })
                .collect(Collectors.toList());
    }

    private BigDecimal calculateAverageMonthlyExpense(List<Transaction> transactions, int months) {
        BigDecimal totalExpense = calculateTotalByType(transactions, TransactionType.EXPENSE);

        if (months == 0) {
            return BigDecimal.ZERO;
        }

        return totalExpense.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
    }

    private Double calculateSavingsRate(List<Transaction> transactions) {
        BigDecimal income = calculateTotalByType(transactions, TransactionType.INCOME);
        BigDecimal expense = calculateTotalByType(transactions, TransactionType.EXPENSE);

        if (income.compareTo(BigDecimal.ZERO) == 0) {
            return 0.0;
        }

        BigDecimal savings = income.subtract(expense);
        return savings.divide(income, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .doubleValue();
    }
}
