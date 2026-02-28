-- Add new notification channel columns to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT FALSE;

-- Comment on columns
COMMENT ON COLUMN settings.whatsapp_number IS 'User WhatsApp number for alerts';
COMMENT ON COLUMN settings.push_enabled IS 'Master toggle for browser push notifications';
