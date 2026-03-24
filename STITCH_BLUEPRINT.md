# Stitch Design Blueprint: Hotel Rate Sentinel

This document defines the professional page format and branding rules for **Stitch with Google**, ensuring high-fidelity screen generation that aligns with our enterprise aesthetic.

## 1. Visual Theme (Atmosphere)

**Vibe:** Professional, Enterprise-Grade, Stable, High-Fidelity.
**Color Mode:** Dark Mode (Oled-Deep).

## 2. Global Color Palette

| Token               | Hex       | Role                                 |
| ------------------- | --------- | ------------------------------------ |
| **Deep Ocean**      | `#0B1F3B` | Primary Background / Foundation      |
| **Ocean Card**      | `#15294A` | Secondary Background / Card Surfaces |
| **Ocean Accent**    | `#1E3A5F` | Borders / Subtle Highlights          |
| **Soft Gold**       | `#D4AF37` | Primary Action / Sentinel Accents    |
| **Soft Gold Hover** | `#E5C55D` | Hover states for gold elements       |
| **Sentinel White**  | `#FFFFFF` | Primary Content / Headlines          |
| **Slate Metadata**  | `#94A3B8` | Secondary Text / Metadata            |

## 3. Brand Block Layout (Header)

- **Height**: 96px (`h-24`) for a stable, professional baseline.
- **Logo Integration**:
  - **Asset**: `public/logo.png`
  - **Scale**: Height of 80px (`h-20`) to fill the header space.
  - **Position**: Left-aligned with 24px padding.
- **Typography**:
  - **Title**: Montserrat 700, 20px (`text-xl`), White/Gold.
  - **Tagline**: "Autonomous Intelligence", Inter 600, 10px, uppercase, wide tracking.

## 4. Component Standards

- **Cards**: Surface `#15294A`, 1px border `#ffffff0d`, 12px border-radius.
- **Buttons**: Gradient from `#D4AF37` to `#B49020`, rounded corner (8px).
- **Glassmorphism**: Backdrop blur 16px, background `rgba(21, 41, 74, 0.95)`.

## 5. Screen Map (What to Design)

1. **Dashboard (Bento Grid)**: The main monitoring hub. High-level KPIs, target hotel card, and competitor rate comparison grid.
2. **Market Analysis Page**: Detailed trend charts, parity analysis tables, and agent reasoning logs for a selected hotel.
3. **Admin Scans Panel**: The view you shared. A table of scan history and the "Upcoming Queue" with Trigger actions.
4. **Admin Key Management**: Visibility into SerpApi quota and key health.
5. **User Settings**: Plan management and scan frequency configuration.

## 6. Page Structure Instruction

"Generate a dashboard page with a Glassmorphism sidebar (280px) and a fixed top Header (96px). Use the 'Deep Ocean' theme. The main content area should utilize a Bento Grid layout for market monitoring widgets. All interactive elements should maintain the 'Soft Gold' accent color for professional branding."
