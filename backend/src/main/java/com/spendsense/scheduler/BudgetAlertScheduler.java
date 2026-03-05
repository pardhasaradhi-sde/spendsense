package com.spendsense.scheduler;

import com.spendsense.service.BudgetAlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job that checks every user's budget daily at 8 AM
 * and fires email alerts when spending crosses the 80% threshold.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class BudgetAlertScheduler {

    private final BudgetAlertService budgetAlertService;

    @Scheduled(cron = "${scheduling.budget-alerts.cron}", zone = "Asia/Kolkata")
    public void checkBudgetsAndSendAlerts() {
        log.info("Starting daily budget alert check job");
        budgetAlertService.checkBudgetsAndSendAlerts();
    }
}
