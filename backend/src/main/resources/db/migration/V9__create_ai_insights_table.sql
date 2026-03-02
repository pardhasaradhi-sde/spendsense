CREATE TABLE ai_insights
(
    id              UUID PRIMARY KEY,
    user_id         UUID        NOT NULL UNIQUE,
    summary         TEXT,
    recommendations JSONB       NOT NULL DEFAULT '[]',
    patterns        JSONB       NOT NULL DEFAULT '[]',
    top_categories  JSONB       NOT NULL DEFAULT '[]',
    generated_at    TIMESTAMP   NOT NULL,
    expires_at      TIMESTAMP   NOT NULL,
    CONSTRAINT fk_ai_insights_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_insights_user_id ON ai_insights (user_id);
CREATE INDEX idx_ai_insights_expires_at ON ai_insights (expires_at);
