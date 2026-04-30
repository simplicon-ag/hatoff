UPDATE public.product_import_log
SET status='sync_pending', updated_at=now()
WHERE brand='venti' AND status='syncing' AND updated_at < now() - interval '10 minutes';