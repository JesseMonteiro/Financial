-- Account/card icons overlay + private storage for user uploads

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_account_icons jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.custom_account_icons IS
  'Per-account icon override: { [accountId]: { key?: catalogId, path?: storagePath } }';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-icons',
  'account-icons',
  false,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

DROP POLICY IF EXISTS "Account icons select own or joint" ON storage.objects;
DROP POLICY IF EXISTS "Account icons insert own" ON storage.objects;
DROP POLICY IF EXISTS "Account icons update own" ON storage.objects;
DROP POLICY IF EXISTS "Account icons delete own" ON storage.objects;

CREATE POLICY "Account icons select own or joint"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'account-icons'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.are_joint_partners(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "Account icons insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'account-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Account icons update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'account-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'account-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Account icons delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'account-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
