CREATE OR REPLACE FUNCTION public.claim_pending_import_rows(
  _batch_size int,
  _brand text DEFAULT NULL
)
RETURNS TABLE(id uuid, brand text, source_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT l.id
    FROM public.product_import_log l
    WHERE l.status = 'sync_pending'
      AND l.brand IN ('casa-moda','venti')
      AND (_brand IS NULL OR l.brand = _brand)
    ORDER BY l.created_at ASC
    LIMIT _batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.product_import_log AS l
  SET status = 'syncing', updated_at = now()
  FROM picked
  WHERE l.id = picked.id
  RETURNING l.id, l.brand, l.source_url;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_import_rows(int, text) FROM PUBLIC, anon, authenticated;