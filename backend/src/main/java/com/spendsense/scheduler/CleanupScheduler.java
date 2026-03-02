package com.spendsense.scheduler;

import com.spendsense.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Weekly cleanup job that removes expired export files from local storage.
 * Runs every Sunday at 3 AM (configurable via scheduling.cleanup.cron).
 * Retention period is controlled by export.temp-file-retention-hours (default 24 h).
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class CleanupScheduler {

    private final FileStorageService fileStorageService;

    @Value("${export.temp-file-retention-hours:24}")
    private int retentionHours;

    @Scheduled(cron = "${scheduling.cleanup.cron}")
    public void cleanupExpiredExports() {
        log.info("Starting export file cleanup job (retention: {} hours)", retentionHours);
        int deleted = fileStorageService.deleteOldExports(retentionHours);
        log.info("Export file cleanup complete. Deleted: {} file(s).", deleted);
    }
}
