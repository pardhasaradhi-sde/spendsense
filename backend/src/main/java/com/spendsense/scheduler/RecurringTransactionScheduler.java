package com.spendsense.scheduler;

import com.spendsense.model.Account;
import com.spendsense.model.Transaction;
import com.spendsense.model.enums.RecurringInterval;
import com.spendsense.model.enums.TransactionStatus;
import com.spendsense.model.enums.TransactionType;
import com.spendsense.repository.AccountRepository;
import com.spendsense.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduled job that processes due recurring transactions.
 * - Runs every 6 hours so it catches missed runs on dev restarts / deployments.
 * - Also fires once on ApplicationReadyEvent as a catch-up for any overdue
 * transactions that built up while the server was offline.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class RecurringTransactionScheduler {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;

    /**
     * Startup catch-up: processes any recurring transactions that became due
     * while the server was down (dev restarts, overnight downtime, deployments).
     */
    @EventListener(ApplicationReadyEvent.class)
    public void runCatchUpOnStartup() {
        log.info("Running recurring transaction catch-up on application startup");
        processRecurringTransactions();
    }

    /**
     * Scheduled job — runs every 6 hours (configurable via application.yml).
     * Running 4× per day ensures daily transactions are never missed due to
     * timing, and weekly/monthly ones are caught promptly.
     */
    @Scheduled(cron = "${scheduling.recurring-transactions.cron}", zone = "Asia/Kolkata")
    @Transactional
    public void processRecurringTransactions() {
        log.info("Starting recurring transaction processing job");

        LocalDateTime now = LocalDateTime.now();
        List<Transaction> dueTransactions = transactionRepository.findByIsRecurringTrueAndNextRecurringDateBefore(now);

        log.info("Found {} recurring transactions to process", dueTransactions.size());

        int successCount = 0, failureCount = 0;

        for (Transaction template : dueTransactions) {
            try {
                processRecurringTransaction(template);
                successCount++;
            } catch (Exception e) {
                log.error("Failed to process recurring transaction {}: {}",
                        template.getId(), e.getMessage(), e);
                failureCount++;
            }
        }

        log.info("Recurring transaction processing complete. Success: {}, Failed: {}",
                successCount, failureCount);
    }

    private void processRecurringTransaction(Transaction template) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime nextDate = template.getNextRecurringDate();

        // Loop to catch up all missed intervals if the server was down for a long time
        int catchUpCount = 0;
        final int MAX_CATCHUP = 30; // Safety limit to prevent infinite loops

        while (nextDate != null && nextDate.isBefore(now) && catchUpCount < MAX_CATCHUP) {
            Transaction newTx = new Transaction();
            newTx.setType(template.getType());
            newTx.setAmount(template.getAmount());
            newTx.setDescription(template.getDescription());
            // Use the target date for the transaction, not 'now', so historical records are
            // accurate
            newTx.setDate(nextDate);
            newTx.setCategory(template.getCategory());
            newTx.setUser(template.getUser());
            newTx.setAccount(template.getAccount());
            newTx.setStatus(TransactionStatus.COMPLETED);
            newTx.setIsRecurring(false);
            newTx.setRecurringInterval(null);
            newTx.setNextRecurringDate(null);

            updateAccountBalance(template.getAccount(), newTx);
            transactionRepository.save(newTx);

            log.debug("Generated missed recurring transaction for date: {}", nextDate);

            // Advance to the next interval
            nextDate = calculateNextDate(nextDate, template.getRecurringInterval());
            catchUpCount++;
        }

        template.setNextRecurringDate(nextDate);
        template.setLastProcessed(LocalDateTime.now());
        transactionRepository.save(template);

        log.info("Recurring template {} processed (caught up {} missed dates). Next occurrence: {}",
                template.getId(), catchUpCount, nextDate);
    }

    private void updateAccountBalance(Account account, Transaction tx) {
        BigDecimal current = account.getBalance();
        BigDecimal updated = tx.getType() == TransactionType.INCOME
                ? current.add(tx.getAmount())
                : current.subtract(tx.getAmount());
        account.setBalance(updated);
        accountRepository.save(account);
    }

    /**
     * Calculates the next due date anchored to midnight (00:00) of the next
     * interval boundary. This guarantees the scheduler (which runs every 6h)
     * always catches the transaction on the correct day, regardless of the
     * time the original transaction was created.
     *
     * e.g. DAILY transaction created at 15:44 → nextRecurringDate = 00:00 next day.
     * The 06:00 AM scheduler run catches it perfectly.
     */
    private LocalDateTime calculateNextDate(LocalDateTime current, RecurringInterval interval) {
        LocalDate currentDate = current.toLocalDate();
        return switch (interval) {
            case DAILY -> currentDate.plusDays(1).atStartOfDay();
            case WEEKLY -> currentDate.plusWeeks(1).atStartOfDay();
            case MONTHLY -> currentDate.plusMonths(1).atStartOfDay();
            case YEARLY -> currentDate.plusYears(1).atStartOfDay();
        };
    }
}
