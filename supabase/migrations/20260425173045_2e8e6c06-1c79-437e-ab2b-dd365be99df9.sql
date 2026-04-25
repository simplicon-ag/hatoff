-- Cleanup: hängende und Rate-Limit-Fehler-Einträge zurücksetzen,
-- damit der überarbeitete Worker sie erneut verarbeiten kann.

-- 1) Einträge die in 'creating' stecken (Worker abgebrochen) → zurück auf 'pending'
UPDATE public.product_import_log
SET status = 'pending',
    error_message = NULL,
    updated_at = now()
WHERE status = 'creating';

-- 2) Einträge mit 429-Rate-Limit-Fehler → zurück auf 'pending' (kein echter Fehler)
UPDATE public.product_import_log
SET status = 'pending',
    error_message = NULL,
    updated_at = now()
WHERE status = 'error'
  AND error_message LIKE '%429%';

-- 3) Job-Counter zurücksetzen, damit der Status wieder stimmt
-- (processed wird bei nächstem Batch wieder hochgezählt)
UPDATE public.product_import_job
SET error_count = (
      SELECT COUNT(*) FROM public.product_import_log WHERE status = 'error'
    ),
    processed = (
      SELECT COUNT(*) FROM public.product_import_log
      WHERE status IN ('created','error','skipped','scraped')
    ),
    created_count = (
      SELECT COUNT(*) FROM public.product_import_log WHERE status = 'created'
    ),
    message = 'Bereit für neuen Lauf — 429-Fehler zurückgesetzt',
    updated_at = now()
WHERE id = 'singleton';