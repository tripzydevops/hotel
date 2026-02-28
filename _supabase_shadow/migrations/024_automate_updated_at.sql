-- Migration: 024_automate_updated_at.sql
-- Description: Adds a generic function and triggers to automate the updated_at column.
-- 1. Create a generic function to set updated_at to NOW()
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';
-- 2. Apply triggers to core tables
-- Hotels table
DROP TRIGGER IF EXISTS set_hotels_updated_at ON public.hotels;
CREATE TRIGGER set_hotels_updated_at BEFORE
UPDATE ON public.hotels FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
-- Settings table
DROP TRIGGER IF EXISTS set_settings_updated_at ON public.settings;
CREATE TRIGGER set_settings_updated_at BEFORE
UPDATE ON public.settings FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
-- Admin Settings table
DROP TRIGGER IF EXISTS set_admin_settings_updated_at ON public.admin_settings;
CREATE TRIGGER set_admin_settings_updated_at BEFORE
UPDATE ON public.admin_settings FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
-- Location Registry table
DROP TRIGGER IF EXISTS set_location_registry_updated_at ON public.location_registry;
CREATE TRIGGER set_location_registry_updated_at BEFORE
UPDATE ON public.location_registry FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();