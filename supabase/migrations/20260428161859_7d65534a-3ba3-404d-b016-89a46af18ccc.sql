UPDATE public.product_import_log
SET status = 'sync_pending',
    error_message = NULL,
    updated_at = now()
WHERE brand IN ('casa-moda','venti')
  AND status = 'sync_error'
  AND shopify_product_id IS NOT NULL
  AND source_url IS NOT NULL;