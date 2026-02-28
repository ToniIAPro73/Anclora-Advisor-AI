ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS series VARCHAR(20),
  ADD COLUMN IF NOT EXISTS invoice_number INTEGER,
  ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

UPDATE invoices
SET series = COALESCE(series, TO_CHAR(issue_date, 'YYYY'))
WHERE series IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, series
      ORDER BY issue_date ASC, created_at ASC, id ASC
    ) AS next_invoice_number
  FROM invoices
)
UPDATE invoices AS target
SET invoice_number = ranked.next_invoice_number
FROM ranked
WHERE target.id = ranked.id
  AND target.invoice_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_user_series ON invoices(user_id, series);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_series_number
  ON invoices(user_id, series, invoice_number)
  WHERE invoice_number IS NOT NULL;
