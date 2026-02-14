-- ============================================================
-- Fix Vault helpers: use vault.create_secret() instead of
-- direct INSERT (which lacks pgsodium permissions on hosted)
-- ============================================================

-- Recreate: use vault.create_secret() which has proper pgsodium grants
-- Also handles duplicate names by deleting the old secret first (upsert)
CREATE OR REPLACE FUNCTION public.create_secret(secret_value TEXT, secret_name TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- Remove any existing secret with the same name to avoid unique constraint violation
  IF secret_name IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE name = secret_name;
  END IF;
  SELECT vault.create_secret(secret_value, secret_name) INTO new_id;
  RETURN new_id;
END;
$$;

-- Recreate read_secret to use vault.decrypted_secrets view
CREATE OR REPLACE FUNCTION public.read_secret(secret_id UUID)
RETURNS TABLE(decrypted_secret TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  RETURN QUERY
  SELECT ds.decrypted_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.id = secret_id;
END;
$$;

-- Recreate update_secret using vault.update_secret()
CREATE OR REPLACE FUNCTION public.update_secret(secret_id UUID, new_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  PERFORM vault.update_secret(secret_id, new_value);
END;
$$;

-- Delete helper stays the same (direct DELETE is fine)
CREATE OR REPLACE FUNCTION public.delete_secret(secret_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = secret_id;
END;
$$;
