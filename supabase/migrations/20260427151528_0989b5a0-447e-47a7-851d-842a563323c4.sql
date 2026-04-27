-- Stop the import job and unschedule the cron tick to save credits
UPDATE public.product_import_job
SET state = 'stopped',
    message = 'Manuell gestoppt – Cron pausiert',
    updated_at = now()
WHERE id = 'singleton';

-- Reset stuck "scraping" / "creating" rows back to pending so resume works later
UPDATE public.product_import_log
SET status = 'pending'
WHERE status IN ('scraping', 'creating');

-- Unschedule the per-minute worker tick (saves Lovable AI / Firecrawl credits)
DO $$
BEGIN
  PERFORM cron.unschedule('product-import-tick');
EXCEPTION WHEN OTHERS THEN
  -- ignore if not scheduled
  NULL;
END $$;