package com.spendsense.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * Email service for sending notifications
 * All email operations are async to improve performance
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@spendsense.com}")
    private String fromEmail;

    /**
     * Send simple text email asynchronously
     */
    @Async
    public void sendSimpleEmail(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);

            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);

        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage(), e);
        }
    }

    /**
     * Send HTML email asynchronously
     */
    @Async
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);
            log.info("HTML email sent successfully to: {}", to);

        } catch (MessagingException e) {
            log.error("Failed to send HTML email to {}: {}", to, e.getMessage(), e);
        }
    }

    /**
     * Send budget alert email
     */
    @Async
    public void sendBudgetAlertEmail(String to, String userName,
            String budgetAmount, String spentAmount,
            String remainingAmount, String percentUsed) {
        String subject = "[SpendSense] Budget Alert - " + percentUsed + "% Used";

        String htmlContent = buildBudgetAlertHtml(userName, budgetAmount, spentAmount,
                remainingAmount, percentUsed);

        sendHtmlEmail(to, subject, htmlContent);
    }

    /**
     * Send transaction notification email
     */
    @Async
    public void sendTransactionNotification(String to, String userName,
            String transactionType, String amount,
            String description) {
        String subject = "[SpendSense] New " + transactionType + " - $" + amount;

        String text = String.format("""
                Hello %s,

                A new %s transaction has been recorded:

                Amount: $%s
                Description: %s

                Log in to SpendSense to view more details.

                Best regards,
                SpendSense Team
                """, userName, transactionType, amount, description);

        sendSimpleEmail(to, subject, text);
    }

    /**
     * Send export ready notification
     */
    @Async
    public void sendExportReadyEmail(String to, String userName, String exportType, String downloadUrl) {
        String subject = "[SpendSense] Your " + exportType + " Export is Ready";

        String htmlContent = buildExportReadyHtml(userName, exportType, downloadUrl);

        sendHtmlEmail(to, subject, htmlContent);
    }

    // ==================== HTML Template Builders ====================

    private String buildBudgetAlertHtml(String userName, String budgetAmount,
            String spentAmount, String remainingAmount,
            String percentUsed) {
        return String.format(
                """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background-color: #f97316; color: white; padding: 20px; text-align: center; }
                                .content { padding: 20px; background-color: #f9f9f9; }
                                .alert-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
                                .stats { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
                                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>⚠️ Budget Alert</h1>
                                </div>
                                <div class="content">
                                    <h2>Hello %s,</h2>
                                    <div class="alert-box">
                                        <strong>You have used %s%% of your monthly budget!</strong>
                                    </div>
                                    <div class="stats">
                                        <h3>Budget Summary:</h3>
                                        <p><strong>Total Budget:</strong> $%s</p>
                                        <p><strong>Amount Spent:</strong> $%s</p>
                                        <p><strong>Remaining:</strong> $%s</p>
                                        <p><strong>Percentage Used:</strong> %s%%</p>
                                    </div>
                                    <p>Consider reviewing your spending to stay within your budget.</p>
                                    <p><a href="https://yourapp.com/dashboard" style="background-color: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></p>
                                </div>
                                <div class="footer">
                                    <p>© 2026 SpendSense. All rights reserved.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """,
                userName, percentUsed, budgetAmount, spentAmount, remainingAmount, percentUsed);
    }

    private String buildExportReadyHtml(String userName, String exportType, String downloadUrl) {
        return String.format(
                """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
                                .content { padding: 20px; background-color: #f9f9f9; }
                                .success-box { background-color: #d1fae5; border-left: 4px solid: #10b981; padding: 15px; margin: 20px 0; }
                                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>✅ Export Ready</h1>
                                </div>
                                <div class="content">
                                    <h2>Hello %s,</h2>
                                    <div class="success-box">
                                        <p>Your %s export has been generated successfully!</p>
                                    </div>
                                    <p><a href="%s" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Export</a></p>
                                    <p><small>This download link will expire in 24 hours.</small></p>
                                </div>
                                <div class="footer">
                                    <p>© 2026 SpendSense. All rights reserved.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """,
                userName, exportType, downloadUrl);
    }

    /**
     * Send monthly AI spending insights email
     */
    @Async
    public void sendMonthlyInsightsEmail(String to, String userName,
            com.spendsense.dto.response.SpendingInsightResponse insights) {
        String subject = "[SpendSense] Your Monthly Spending Insights";
        sendHtmlEmail(to, subject, buildMonthlyInsightsHtml(userName, insights));
    }

    private String buildMonthlyInsightsHtml(String userName,
            com.spendsense.dto.response.SpendingInsightResponse insights) {
        // Build recommendations list HTML
        StringBuilder recHtml = new StringBuilder();
        if (insights.getRecommendations() != null) {
            insights.getRecommendations()
                    .forEach(r -> recHtml.append("<li style='margin-bottom:6px'>").append(r).append("</li>"));
        }

        // Build top categories HTML
        StringBuilder catHtml = new StringBuilder();
        if (insights.getTopCategories() != null) {
            insights.getTopCategories().forEach(c -> catHtml.append("<li>").append(c).append("</li>"));
        }

        // Build patterns HTML
        StringBuilder patHtml = new StringBuilder();
        if (insights.getPatterns() != null) {
            insights.getPatterns()
                    .forEach(p -> patHtml.append("<li style='margin-bottom:6px'>").append(p).append("</li>"));
        }

        return String.format(
                """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                                .container { max-width: 600px; margin: 0 auto; padding: 0; }
                                .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 28px 24px; text-align: center; }
                                .content { padding: 24px; background: #f9f9f9; }
                                .card { background: white; border-radius: 8px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
                                .card h3 { margin: 0 0 10px 0; color: #6366f1; font-size: 14px; text-transform: uppercase; letter-spacing: .05em; }
                                .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
                                ul { margin: 0; padding-left: 20px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1 style="margin:0;font-size:24px">📊 Monthly Spending Insights</h1>
                                    <p style="margin:6px 0 0">Hello %s! Here's your AI-powered financial digest.</p>
                                </div>
                                <div class="content">
                                    <div class="card">
                                        <h3>Summary</h3>
                                        <p style="margin:0">%s</p>
                                    </div>
                                    <div class="card">
                                        <h3>💡 Recommendations</h3>
                                        <ul>%s</ul>
                                    </div>
                                    <div class="card">
                                        <h3>🔝 Top Expense Categories</h3>
                                        <ul>%s</ul>
                                    </div>
                                    <div class="card">
                                        <h3>📈 Key Patterns</h3>
                                        <ul>%s</ul>
                                    </div>
                                </div>
                                <div class="footer">© 2026 SpendSense. All rights reserved.</div>
                            </div>
                        </body>
                        </html>
                        """,
                userName,
                insights.getSummary() != null ? insights.getSummary() : "No summary available.",
                recHtml,
                catHtml,
                patHtml);
    }
}
