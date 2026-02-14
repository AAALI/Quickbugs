-- Fix create_secret to handle duplicate names (upsert behavior)
-- Deletes existing secret with same name before creating new one
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
