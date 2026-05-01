UPDATE public.product_import_log
SET status = 'sync_pending', error_message = NULL, updated_at = now()
WHERE status = 'syncing' AND updated_at < now() - interval '5 minutes';

UPDATE public.product_import_log
SET status = 'sync_pending', error_message = NULL, updated_at = now()
WHERE status = 'sync_error'
  AND brand IN ('casa-moda','venti')
  AND (error_message ILIKE '%401%' OR error_message ILIKE '%Invalid API key%' OR error_message = 'no shopify_product_id');