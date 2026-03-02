package com.spendsense.service;

import com.spendsense.dto.request.CreateTransactionRequest;
import com.spendsense.dto.request.UpdateTransactionRequest;
import com.spendsense.dto.response.TransactionResponse;
import com.spendsense.exception.InvalidRecurringTransactionException;
import com.spendsense.exception.ResourceNotFoundException;
import com.spendsense.mapper.TransactionMapper;
import com.spendsense.model.Account;
import com.spendsense.model.Transaction;
import com.spendsense.model.User;
import com.spendsense.model.enums.RecurringInterval;
import com.spendsense.model.enums.TransactionType;
import com.spendsense.repository.AccountRepository;
import com.spendsense.repository.TransactionRepository;
import com.spendsense.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TransactionService {
    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final TransactionMapper transactionMapper;

    public TransactionResponse createTransaction(UUID userId, CreateTransactionRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Account account = accountRepository.findByIdAndUserId(request.getAccountId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        Transaction transaction = transactionMapper.toEntity(request);
        transaction.setUser(user);
        transaction.setAccount(account);
        if (Boolean.TRUE.equals(request.getIsRecurring())) {
            if (request.getDate() == null || request.getRecurringInterval() == null) {
                throw new InvalidRecurringTransactionException(
                        "Recurring transaction requires date and recurringInterval");
            }
            transaction.setNextRecurringDate(calculateNextRecurringDate(
                    request.getDate(), request.getRecurringInterval()));
        }
        updateAccountBalance(account, transaction);
        Transaction saved = transactionRepository.save(transaction);
        return transactionMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<TransactionResponse> getUserTransactions(UUID userId, Pageable pageable) {
        return transactionRepository.findByUserId(userId, pageable)
                .map(transactionMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<TransactionResponse> getAccountTransactions(UUID userId, UUID accountId, Pageable pageable) {
        // Verify account exists and belongs to user
        accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        return transactionRepository.findByAccountIdAndUserId(accountId, userId, pageable)
                .map(transactionMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public TransactionResponse getTransaction(UUID userId, UUID transactionId) {
        Transaction transaction = transactionRepository.findByIdAndUserId(transactionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        return transactionMapper.toResponse(transaction);
    }

    public TransactionResponse updateTransaction(UUID userId, UUID transactionId, UpdateTransactionRequest request) {
        Transaction transaction = transactionRepository.findByIdAndUserId(transactionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        revertAccountBalance(transaction.getAccount(), transaction);
        if (request.getType() != null) {
            transaction.setType(request.getType());
        }
        if (request.getAmount() != null) {
            transaction.setAmount(request.getAmount());
        }
        if (request.getDescription() != null) {
            transaction.setDescription(request.getDescription());
        }
        if (request.getDate() != null) {
            transaction.setDate(request.getDate());
        }
        if (request.getCategory() != null) {
            transaction.setCategory(request.getCategory());
        }
        if (request.getReceiptUrl() != null) {
            transaction.setReceiptUrl(request.getReceiptUrl());
        }
        if (Boolean.TRUE.equals(request.getIsRecurring())) {
            if (request.getDate() == null || request.getRecurringInterval() == null) {
                throw new InvalidRecurringTransactionException(
                        "Recurring transaction requires date and recurringInterval");
            }
            transaction.setNextRecurringDate(calculateNextRecurringDate(
                    request.getDate(), request.getRecurringInterval()));
        }
        updateAccountBalance(transaction.getAccount(), transaction);
        Transaction saved = transactionRepository.save(transaction);
        return transactionMapper.toResponse(saved);
    }

    public void deleteTransaction(UUID userId, UUID transactionId) {
        Transaction transaction = transactionRepository.findByIdAndUserId(transactionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        revertAccountBalance(transaction.getAccount(), transaction);
        transactionRepository.delete(transaction);
    }

    private void revertAccountBalance(Account account, Transaction transaction) {
        BigDecimal currentBalance = account.getBalance();
        BigDecimal newBalance;
        if (transaction.getType() == TransactionType.INCOME) {
            newBalance = currentBalance.subtract(transaction.getAmount());
        } else {
            newBalance = currentBalance.add(transaction.getAmount());
        }
        account.setBalance(newBalance);
        accountRepository.save(account);
    }

    private void updateAccountBalance(Account account, Transaction transaction) {
        BigDecimal currentBalance = account.getBalance();
        BigDecimal newBalance;
        if (transaction.getType() == TransactionType.INCOME) {
            newBalance = currentBalance.add(transaction.getAmount());
        } else {
            newBalance = currentBalance.subtract(transaction.getAmount());
        }
        account.setBalance(newBalance);
        accountRepository.save(account);
    }

    private LocalDateTime calculateNextRecurringDate(LocalDateTime date, RecurringInterval recurringInterval) {
        LocalDate d = date.toLocalDate();
        return switch (recurringInterval) {
            case DAILY -> d.plusDays(1).atStartOfDay();
            case WEEKLY -> d.plusWeeks(1).atStartOfDay();
            case MONTHLY -> d.plusMonths(1).atStartOfDay();
            case YEARLY -> d.plusYears(1).atStartOfDay();
        };
    }

}
