-- Evaluation Reliability: new columns and enum value
-- Applies to: 2026-05-29 evaluation-reliability feature
-- Run BEFORE deploying the new code

ALTER TABLE interview
  MODIFY COLUMN status ENUM('ongoing', 'evaluating', 'evaluation_failed', 'passed', 'done') NOT NULL DEFAULT 'ongoing',
  ADD COLUMN evaluation_started_at DATETIME NULL AFTER created_at,
  ADD COLUMN evaluation_finished_at DATETIME NULL AFTER evaluation_started_at,
  ADD COLUMN evaluation_error TEXT NULL AFTER evaluation_finished_at,
  ADD COLUMN evaluation_attempts INT NOT NULL DEFAULT 0 AFTER evaluation_error;
