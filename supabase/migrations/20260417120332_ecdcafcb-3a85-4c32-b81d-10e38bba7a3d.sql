
-- Replace scan_logs insert policy with a less permissive one (still allows anonymous scans, but only inserting valid product_ids)
DROP POLICY "Anyone may insert scan log" ON public.scan_logs;
CREATE POLICY "Public may log scans of existing medicines"
  ON public.scan_logs FOR INSERT
  WITH CHECK (
    product_id IS NOT NULL
    AND length(product_id) BETWEEN 4 AND 64
    AND (medicine_id IS NULL OR EXISTS (SELECT 1 FROM public.medicines m WHERE m.id = medicine_id))
  );

-- Storage: prevent broad listing by requiring an explicit object name prefix on SELECT.
-- Public read of individual files via getPublicUrl still works because that uses a direct object key, not a list.
DROP POLICY "Public read medicine images" ON storage.objects;
CREATE POLICY "Public read individual medicine images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'medicine-images' AND name IS NOT NULL AND position('/' in name) > 0);
