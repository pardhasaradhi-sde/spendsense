package com.spendsense.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Persisted AI spending insights per user.
 *
 * Strategy:
 * 1. Check Redis (48h TTL) → hit: return immediately
 * 2. Miss → check this table (expiresAt > now) → hit: populate Redis, return
 * 3. Both miss → generate via Gemini, persist here, populate Redis, return
 *
 * Lists (recommendations, patterns, topCategories) are stored as JSONB arrays
 * in Postgres.
 * Use String fields here; Jackson handles serialization/deserialization in the
 * service.
 */
@Entity
@Table(name = "ai_insights")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiInsight {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** One row per user — UNIQUE enforced by DB constraint. */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(columnDefinition = "TEXT")
    private String summary;

    /** JSON array string, e.g. ["tip1","tip2"] */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recommendations", columnDefinition = "JSONB")
    private String recommendations;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "patterns", columnDefinition = "JSONB")
    private String patterns;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "top_categories", columnDefinition = "JSONB")
    private String topCategories;

    @CreationTimestamp
    @Column(name = "generated_at", nullable = false, updatable = false)
    private LocalDateTime generatedAt;

    /**
     * After this timestamp the row is considered stale — service will regenerate.
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
}
