package com.spendsense.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.spendsense.model.Transaction;
import com.spendsense.model.User;
import com.spendsense.repository.TransactionRepository;
import com.spendsense.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * Service for exporting transaction data to CSV and PDF formats
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ExportService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final FileStorageService fileStorageService;

    @Value("${server.servlet.context-path:/api/v1}")
    private String contextPath;

    @Value("${app.backend-url:http://localhost:8080}")
    private String backendUrl;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * Export transactions to CSV format
     */
    public byte[] exportToCsv(UUID userId, LocalDateTime startDate, LocalDateTime endDate) {
        log.info("Exporting transactions to CSV for user: {}", userId);

        try {
            List<Transaction> transactions;
            if (startDate != null && endDate != null) {
                transactions = transactionRepository.findByUserIdAndDateBetweenOrderByDateDesc(userId, startDate,
                        endDate);
            } else {
                // Get all transactions for the user
                transactions = transactionRepository.findByUserId(userId);
            }

            StringWriter writer = new StringWriter();
            try (CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                    .setHeader("Date", "Type", "Category", "Description", "Amount", "Account", "Status")
                    .build())) {

                for (Transaction transaction : transactions) {
                    csvPrinter.printRecord(
                            transaction.getDate().format(DATE_FORMATTER),
                            transaction.getType().toString(),
                            transaction.getCategory() != null ? transaction.getCategory() : "",
                            transaction.getDescription() != null ? transaction.getDescription() : "",
                            transaction.getAmount().toString(),
                            transaction.getAccount() != null ? transaction.getAccount().getName() : "",
                            transaction.getStatus() != null ? transaction.getStatus().toString() : "");
                }
            }

            log.info("CSV export completed. {} transactions exported", transactions.size());
            return writer.toString().getBytes();

        } catch (Exception e) {
            log.error("Error exporting to CSV for user: {}", userId, e);
            throw new RuntimeException("Failed to export transactions to CSV", e);
        }
    }

    /**
     * Export transactions to PDF format
     */
    public byte[] exportToPdf(UUID userId, LocalDateTime startDate, LocalDateTime endDate) {
        log.info("Exporting transactions to PDF for user: {}", userId);

        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            List<Transaction> transactions;
            if (startDate != null && endDate != null) {
                transactions = transactionRepository.findByUserIdAndDateBetweenOrderByDateDesc(userId, startDate,
                        endDate);
            } else {
                // Get all transactions for the user
                transactions = transactionRepository.findByUserId(userId);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);

            // Add title
            Paragraph title = new Paragraph("SpendSense Transaction Report")
                    .setFontSize(20)
                    .setBold()
                    .setTextAlignment(TextAlignment.CENTER);
            document.add(title);

            // Add user info
            document.add(new Paragraph("User: " + (user.getName() != null ? user.getName() : user.getEmail())));
            document.add(new Paragraph("Generated: " + LocalDateTime.now().format(DATE_FORMATTER)));

            if (startDate != null && endDate != null) {
                document.add(new Paragraph(
                        "Period: " + startDate.format(DATE_FORMATTER) + " to " + endDate.format(DATE_FORMATTER)));
            }

            document.add(new Paragraph("\n"));

            // Add summary statistics
            BigDecimal totalIncome = transactions.stream()
                    .filter(t -> t.getType().toString().equals("INCOME"))
                    .map(Transaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalExpense = transactions.stream()
                    .filter(t -> t.getType().toString().equals("EXPENSE"))
                    .map(Transaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            document.add(new Paragraph("Summary:").setBold());
            document.add(new Paragraph("Total Income: \u20B9" + totalIncome));
            document.add(new Paragraph("Total Expense: \u20B9" + totalExpense));
            document.add(new Paragraph("Net: \u20B9" + totalIncome.subtract(totalExpense)));
            document.add(new Paragraph("Total Transactions: " + transactions.size()));
            document.add(new Paragraph("\n"));

            // Add transactions table
            Table table = new Table(UnitValue.createPercentArray(new float[] { 15, 10, 12, 25, 12, 15, 11 }));
            table.setWidth(UnitValue.createPercentValue(100));

            // Table header
            addTableHeader(table, "Date");
            addTableHeader(table, "Type");
            addTableHeader(table, "Category");
            addTableHeader(table, "Description");
            addTableHeader(table, "Amount");
            addTableHeader(table, "Account");
            addTableHeader(table, "Status");

            // Table data
            for (Transaction transaction : transactions) {
                table.addCell(
                        new Cell().add(new Paragraph(transaction.getDate().format(DATE_FORMATTER)).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(transaction.getType().toString()).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(transaction.getCategory()).setFontSize(9)));
                table.addCell(new Cell()
                        .add(new Paragraph(transaction.getDescription() != null ? transaction.getDescription() : "-")
                                .setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph("\u20B9" + transaction.getAmount()).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(transaction.getAccount().getName()).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(transaction.getStatus().toString()).setFontSize(9)));
            }

            document.add(table);

            // Add footer
            document.add(new Paragraph("\n"));
            document.add(new Paragraph("Report generated by SpendSense")
                    .setFontSize(10)
                    .setTextAlignment(TextAlignment.CENTER));

            document.close();
            log.info("PDF export completed. {} transactions exported", transactions.size());

            return baos.toByteArray();

        } catch (Exception e) {
            log.error("Error exporting to PDF for user: {}", userId, e);
            throw new RuntimeException("Failed to export transactions to PDF", e);
        }
    }

    /**
     * Export and send via email
     */
    public void exportAndEmail(UUID userId, String format, LocalDateTime startDate, LocalDateTime endDate) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getEmail() == null || user.getEmail().isEmpty()) {
            throw new RuntimeException("User has no email address");
        }

        try {
            byte[] exportData;
            String fileName;

            if ("csv".equalsIgnoreCase(format)) {
                exportData = exportToCsv(userId, startDate, endDate);
                fileName = "transactions_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
                        + ".csv";
            } else if ("pdf".equalsIgnoreCase(format)) {
                exportData = exportToPdf(userId, startDate, endDate);
                fileName = "transactions_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
                        + ".pdf";
            } else {
                throw new IllegalArgumentException("Unsupported export format: " + format);
            }

            // Store the export and return a real download URL
            fileStorageService.storeExport(exportData, fileName);
            String downloadUrl = backendUrl + contextPath + "/export/download/" + fileName;

            emailService.sendExportReadyEmail(
                    user.getEmail(),
                    user.getName() != null ? user.getName() : "User",
                    format.toUpperCase(),
                    downloadUrl);

            log.info("Export email sent to user: {}", userId);

        } catch (Exception e) {
            log.error("Error exporting and emailing for user: {}", userId, e);
            throw new RuntimeException("Failed to export and email transactions", e);
        }
    }

    private void addTableHeader(Table table, String headerText) {
        Cell headerCell = new Cell()
                .add(new Paragraph(headerText).setBold())
                .setBackgroundColor(ColorConstants.LIGHT_GRAY)
                .setTextAlignment(TextAlignment.CENTER)
                .setFontSize(10);
        table.addHeaderCell(headerCell);
    }
}
