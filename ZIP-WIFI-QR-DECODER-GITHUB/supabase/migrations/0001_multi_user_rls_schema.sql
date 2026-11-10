-- =============================================================================
-- ZIP QR — Wi-Fi QR Decoder
-- Supabase / PostgreSQL Multi-User Schema & Row-Level Security (RLS) Migration
--
-- SECURITY & PRIVACY ARCHITECTURE:
-- 1. Zero-Plaintext-Password Policy:
--    This schema intentionally has NO column for Wi-Fi passwords (`password`)
--    and NO column for raw QR strings (`raw_payload`). Even if a user opts into
--    synchronized scan history, plaintext Wi-Fi passwords NEVER leave the device.
-- 2. Strict Multi-Tenant Data Isolation via Row Level Security (RLS):
--    Every table enforces `auth.uid() = user_id` across SELECT, INSERT, UPDATE,
--    and DELETE. User A can NEVER read, insert, update, or delete User B's rows.
-- =============================================================================

-- Enable UUID generation extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- TABLE 1: public.user_settings
-- Stores per-user UI preferences and opt-in sync configuration
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language VARCHAR(8) NOT NULL DEFAULT 'ckb' CHECK (language IN ('ckb', 'en')),
  accent_theme VARCHAR(32) NOT NULL DEFAULT 'electric-blue' CHECK (accent_theme IN ('electric-blue', 'cyber-purple', 'emerald-shield')),
  history_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_ssid_opt_in BOOLEAN NOT NULL DEFAULT false,
  auto_mask_password BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
CREATE POLICY "user_settings_select_own"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
CREATE POLICY "user_settings_insert_own"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
CREATE POLICY "user_settings_update_own"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_delete_own" ON public.user_settings;
CREATE POLICY "user_settings_delete_own"
  ON public.user_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- TABLE 2: public.scan_history_metadata
-- Stores ONLY non-sensitive scan metadata for authenticated users who opt in.
-- NEVER stores Wi-Fi passwords or raw QR credential payloads.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_history_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id VARCHAR(64) NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ssid VARCHAR(128) NULL CHECK (char_length(ssid) <= 128),
  security_type VARCHAR(32) NOT NULL CHECK (char_length(security_type) <= 32),
  hidden_network BOOLEAN NOT NULL DEFAULT false,
  qr_category VARCHAR(24) NOT NULL CHECK (qr_category IN ('WIFI', 'DPP', 'URL', 'VCARD', 'EMAIL', 'SMS', 'TEL', 'GEO', 'TEXT', 'EMPTY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scan_id)
);

-- Performance index for fast paginated user-specific history queries
CREATE INDEX IF NOT EXISTS idx_scan_history_user_scanned_at
  ON public.scan_history_metadata (user_id, scanned_at DESC);

ALTER TABLE public.scan_history_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history_metadata FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_history_select_own" ON public.scan_history_metadata;
CREATE POLICY "scan_history_select_own"
  ON public.scan_history_metadata
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "scan_history_insert_own" ON public.scan_history_metadata;
CREATE POLICY "scan_history_insert_own"
  ON public.scan_history_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scan_history_update_own" ON public.scan_history_metadata;
CREATE POLICY "scan_history_update_own"
  ON public.scan_history_metadata
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scan_history_delete_own" ON public.user_settings;
DROP POLICY IF EXISTS "scan_history_delete_own" ON public.scan_history_metadata;
CREATE POLICY "scan_history_delete_own"
  ON public.scan_history_metadata
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RPC: delete_own_user_account()
-- Allows an authenticated user to permanently delete their own account and all
-- associated user_settings and scan_history_metadata rows via ON DELETE CASCADE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_own_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid UUID;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: no authenticated user session';
  END IF;

  DELETE FROM public.scan_history_metadata WHERE user_id = caller_uid;
  DELETE FROM public.user_settings WHERE user_id = caller_uid;
  DELETE FROM auth.users WHERE id = caller_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_user_account() TO authenticated;
