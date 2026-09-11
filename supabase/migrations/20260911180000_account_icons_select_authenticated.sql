-- Card-face files are reused across family profiles (same product, different account ids).
DROP POLICY IF EXISTS "Account icons select own or joint" ON storage.objects;
DROP POLICY IF EXISTS "Account icons select authenticated" ON storage.objects;

CREATE POLICY "Account icons select authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'account-icons');
