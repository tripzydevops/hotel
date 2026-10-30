import os
import re

def fix_types_and_i18n():
    # 1. Fix broken types from previous script
    for fname in ["components/tiles/TargetHotelTile.tsx", "components/tiles/CompetitorTile.tsx"]:
        if not os.path.exists(fname): continue
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
        content = content.replace("hotel: HotelWithPrice, GuestMention", "hotel: HotelWithPrice")
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
            
    # 2. i18n replacements in HotelTile.tsx
    hotel_tile = "components/tiles/HotelTile.tsx"
    if os.path.exists(hotel_tile):
        with open(hotel_tile, 'r', encoding='utf-8') as f:
            ht = f.read()
        
        # Ensure useI18n is imported
        if 'useI18n' not in ht:
            ht = ht.replace('import { ReactNode', 'import { useI18n } from "@/lib/i18n";\nimport { ReactNode')
            ht = ht.replace('export default function HotelTile(props: HotelTileProps) {', 'export default function HotelTile(props: HotelTileProps) {\n  const { t } = useI18n();\n')
        
        # Replace strings
        replacements = [
            (r'>\s*Scanning\s*<', '>{t("common.scanning", "Scanning")}<'),
            (r'>\s*Optimal Price\s*<', '>{t("hotelDetails.optimalPrice", "Optimal Price")}<'),
            (r'>\s*Varieties\s*<', '>{t("hotelDetails.varieties", "Varieties")}<'),
            (r'"Location Unknown"', 't("hotelDetails.locationUnknown", "Location Unknown")'),
            (r'>\s*Lead Rate\s*<', '>{t("hotelDetails.leadRate", "Lead Rate")}<'),
            (r'Market Presence \(', 't("hotelDetails.marketPresence", "Market Presence") + " (\\"'),
            (r'"Collapse"', 't("common.collapse", "Collapse")'),
            (r'"Compare"', 't("common.compare", "Compare")'),
            (r'>\s*Recency\s*<', '>{t("hotelDetails.recency", "Recency")}<'),
            (r'"Pending Sync"', 't("hotelDetails.pendingSync", "Pending Sync")'),
            (r'>\s*Shift\s*<', '>{t("hotelDetails.shift", "Shift")}<'),
            (r'>\s*Tactical Intel\s*<', '>{t("hotelDetails.tacticalIntel", "Tactical Intel")}<'),
            (r'title="Set as My Hotel"', 'title={t("hotelDetails.setAsMyHotel", "Set as My Hotel")}'),
            (r'title="Edit Intel"', 'title={t("hotelDetails.editIntel", "Edit Intel")}'),
            (r'title="Purge Intel"', 'title={t("hotelDetails.purgeIntel", "Purge Intel")}'),
        ]
        for p, r in replacements:
            ht = re.sub(p, r, ht)
            
        with open(hotel_tile, 'w', encoding='utf-8') as f:
            f.write(ht)

    # 3. i18n replacements in HotelDetailsModal.tsx
    modal = "components/modals/HotelDetailsModal.tsx"
    if os.path.exists(modal):
        with open(modal, 'r', encoding='utf-8') as f:
            mc = f.read()
            
        if 'useI18n' not in mc:
            mc = mc.replace('import { useState', 'import { useI18n } from "@/lib/i18n";\nimport { useState')
            mc = mc.replace('export default function HotelDetailsModal({', 'export default function HotelDetailsModal({\n  // @ts-ignore\n  const { t } = useI18n();\n')
            
        reps = [
            (r'>Overview<', '>{t("hotelDetails.tabs.overview", "Overview")}<'),
            (r'>Rooms<', '>{t("hotelDetails.tabs.rooms", "Rooms")}<'),
            (r'>Reviews<', '>{t("hotelDetails.tabs.reviews", "Reviews")}<'),
        ]
        for p, r in reps:
            mc = re.sub(p, r, mc)
            
        with open(modal, 'w', encoding='utf-8') as f:
            f.write(mc)

if __name__ == "__main__":
    fix_types_and_i18n()
