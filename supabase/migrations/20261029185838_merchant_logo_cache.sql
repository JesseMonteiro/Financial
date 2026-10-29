-- Global cache of establishment logos resolved through logo.dev.
-- One row per company name so the Community plan is billed once per brand.

CREATE TABLE IF NOT EXISTS public.merchant_logo_cache (
  query_key     text PRIMARY KEY,
  status        text NOT NULL CHECK (status IN ('pending', 'found', 'miss')),
  brand_name    text,
  domain        text,
  etag          text,
  storage_path  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.merchant_logo_cache IS
  'Logo.dev lookup cache shared by every user. pending claims a key before the external call.';

ALTER TABLE public.merchant_logo_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read merchant logos" ON public.merchant_logo_cache;
CREATE POLICY "Authenticated read merchant logos"
  ON public.merchant_logo_cache FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-logos',
  'merchant-logos',
  true,
  1048576,
  ARRAY['image/webp', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Merchant logos are publicly readable" ON storage.objects;
CREATE POLICY "Merchant logos are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'merchant-logos');
