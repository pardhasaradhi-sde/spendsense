package com.spendsense.repository;

import com.spendsense.model.AiInsight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiInsightRepository extends JpaRepository<AiInsight, UUID> {

    /**
     * Load existing insights for a user (valid or stale — caller checks expiresAt).
     */
    @Query("SELECT a FROM AiInsight a WHERE a.user.id = :userId")
    Optional<AiInsight> findByUserId(@Param("userId") UUID userId);

    /** Check if a non-expired row exists without loading the full entity. */
    @Query("SELECT COUNT(a) > 0 FROM AiInsight a WHERE a.user.id = :userId AND a.expiresAt > :now")
    boolean existsValidInsightForUser(@Param("userId") UUID userId, @Param("now") LocalDateTime now);

    /** Delete stale row before regenerating; used by the refresh flow. */
    @Modifying
    @Query("DELETE FROM AiInsight a WHERE a.user.id = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
