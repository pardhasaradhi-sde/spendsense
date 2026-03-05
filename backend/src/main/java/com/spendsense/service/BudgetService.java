package com.spendsense.service;

import com.spendsense.dto.request.CreateBudgetRequest;
import com.spendsense.dto.request.UpdateBudgetRequest;
import com.spendsense.dto.response.BudgetResponse;
import com.spendsense.exception.BadRequestException;
import com.spendsense.exception.ResourceNotFoundException;
import com.spendsense.model.Budget;
import com.spendsense.model.Transaction;
import com.spendsense.model.User;
import com.spendsense.model.enums.TransactionType;
import com.spendsense.repository.BudgetRepository;
import com.spendsense.repository.TransactionRepository;
import com.spendsense.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class BudgetService {
    private final BudgetRepository budgetRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    public BudgetResponse createBudget(UUID userId, CreateBudgetRequest request) {
        if (budgetRepository.existsByUserId(userId)) {
            throw new BadRequestException("User Already has a Budget. Use Update instead");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User Not Found"));
        Budget budget = new Budget();
        budget.setAmount(request.getAmount());
        budget.setUser(user);
        budgetRepository.save(budget);
        return toResponse(budget, userId);
    }

    public BudgetResponse getUserBudget(UUID userId) {
        Budget budget = budgetRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Budget Not Found"));
        return toResponse(budget, userId);
    }

    public BudgetResponse updateBudget(UUID userId, UpdateBudgetRequest request) {
        Budget budget = budgetRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Budget Not Found"));
        if (request.getAmount() != null) {
            budget.setAmount(request.getAmount());
        }
        Budget updated = budgetRepository.save(budget);
        return toResponse(updated, userId);
    }

    public void deleteBudget(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (user.getBudget() == null) {
            throw new ResourceNotFoundException("Budget Not Found");
        }
        // Clear the owning-side reference so Hibernate orphanRemoval deletes the row
        user.setBudget(null);
    }

    /**
     * Build BudgetResponse enriched with current calendar-month spending (IST).
     */
    private BudgetResponse toResponse(Budget budget, UUID userId) {
        BigDecimal spent = getMonthlyExpenses(userId);
        double pct = budget.getAmount().compareTo(BigDecimal.ZERO) > 0
                ? spent.divide(budget.getAmount(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).doubleValue()
                : 0.0;
        return BudgetResponse.builder()
                .id(budget.getId())
                .amount(budget.getAmount())
                .spentThisMonth(spent)
                .percentUsed(pct)
                .lastAlertSent(budget.getLastAlertSent())
                .createdAt(budget.getCreatedAt())
                .updatedAt(budget.getUpdatedAt())
                .build();
    }

    /** Sum of EXPENSE transactions since the 1st of the current calendar month (IST). */
    private BigDecimal getMonthlyExpenses(UUID userId) {
        LocalDateTime startOfMonth = LocalDateTime.now(ZoneId.of("Asia/Kolkata"))
                .withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        return transactionRepository
                .findByUserIdAndDateAfterOrderByDateDesc(userId, startOfMonth)
                .stream()
                .filter(t -> t.getType() == TransactionType.EXPENSE)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
