package com.spendsense.scheduler;

import com.spendsense.dto.response.SpendingInsightResponse;
import com.spendsense.model.User;
import com.spendsense.repository.UserRepository;
import com.spendsense.service.EmailService;
import com.spendsense.service.ai.AiInsightsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Scheduler that sends personalized AI spending insights to all users
 * on the 1st of every month at 8:00 AM.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class MonthlyInsightsScheduler {

    private final UserRepository userRepository;
    private final AiInsightsService aiInsightsService;
    private final EmailService emailService;

    /**
     * Runs at 8:00 AM on the 1st of every month.
     * Generates AI insights for each user and sends them via email.
     */
    @Scheduled(cron = "0 0 8 1 * ?", zone = "Asia/Kolkata")
    public void sendMonthlyInsightEmails() {
        log.info("Starting monthly AI insights email job...");

        List<User> users = userRepository.findAll();
        int success = 0, failed = 0;

        for (User user : users) {
            try {
                SpendingInsightResponse insights = aiInsightsService.generateSpendingInsights(user.getId());
                emailService.sendMonthlyInsightsEmail(
                        user.getEmail(),
                        user.getName() != null ? user.getName() : "there",
                        insights);
                success++;
                log.debug("Monthly insights sent to: {}", user.getEmail());
            } catch (Exception e) {
                failed++;
                log.error("Failed to send monthly insights to user {}: {}", user.getId(), e.getMessage());
            }
        }

        log.info("Monthly insights job complete. Sent: {}, Failed: {}", success, failed);
    }
}
