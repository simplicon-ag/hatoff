-- 1) Handles für noch ausstehende Einträge aktualisieren (mit Article-ID-Suffix)
UPDATE public.product_import_log
SET handle = lower(
  regexp_replace(source_url, '^https?://[^/]+/de/de/', '', 'i')
),
    updated_at = now()
WHERE status = 'pending';

-- 2) Fälschliche "Duplikat-Treffer" identifizieren und korrigieren:
-- Wenn mehrere log-Einträge dieselbe shopify_product_id teilen, behält der
-- ÄLTESTE den Status 'created' (das ist der echte Importer), alle anderen
-- werden auf 'skipped' gesetzt mit einer Hinweismeldung.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY shopify_product_id
           ORDER BY created_at ASC
         ) AS rn
  FROM public.product_import_log
  WHERE status = 'created' AND shopify_product_id IS NOT NULL
)
UPDATE public.product_import_log l
SET status = 'skipped',
    error_message = 'Doppelter Handle — anderes Produkt teilte dieselbe Shopify-ID',
    updated_at = now()
FROM ranked r
WHERE l.id = r.id AND r.rn > 1;

-- 3) Job-Counter neu berechnen
UPDATE public.product_import_job
SET created_count = (
      SELECT COUNT(*) FROM public.product_import_log WHERE status = 'created'
    ),
    error_count = (
      SELECT COUNT(*) FROM public.product_import_log WHERE status = 'error'
    ),
    processed = (
      SELECT COUNT(*) FROM public.product_import_log
      WHERE status IN ('created','error','skipped','scraped')
    ),
    message = 'Handles korrigiert — Duplikate bereinigt',
    updated_at = now()
WHERE id = 'singleton';