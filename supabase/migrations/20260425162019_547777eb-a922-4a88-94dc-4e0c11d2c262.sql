update public.product_import_log
set status = 'pending', scraped_data = null, error_message = null, updated_at = now()
where status in ('scraped', 'error', 'scraping', 'creating');

update public.product_import_job
set state = 'idle', processed = 0, created_count = 0, error_count = 0,
    message = 'Reset für verbesserten Extractor', updated_at = now()
where id = 'singleton';