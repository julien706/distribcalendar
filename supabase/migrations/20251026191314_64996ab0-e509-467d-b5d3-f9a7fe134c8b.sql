-- Add 'no_answer' status to the distribution_status enum
ALTER TYPE distribution_status ADD VALUE IF NOT EXISTS 'no_answer';