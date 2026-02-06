# Design System: Hotel Rate Sentinel

**Project Identity:** Autonomous Market Intelligence Engine

## 1. Visual Theme & Atmosphere

The design system embodies a **Sophisticated, Enterprise-Grade** atmosphere. It uses a "Deep Ocean" base to convey stability and depth, contrasted by "Soft Gold" accents representing premium value and intelligence. The mood is **Precise, Reliable, and Future-Forward**.

## 2. Color Palette & Roles

| Name                | Hex       | Role                                                |
| ------------------- | --------- | --------------------------------------------------- |
| **Deep Ocean**      | `#0B1F3B` | Main background and base foundation.                |
| **Ocean Card**      | `#15294A` | Surface color for cards and secondary containers.   |
| **Ocean Accent**    | `#1E3A5F` | Tertiary surfaces and subtle borders.               |
| **Soft Gold**       | `#D4AF37` | Primary accent for CTAs, Sentinels, and highlights. |
| **Soft Gold Hover** | `#E5C55D` | Hover states for gold elements.                     |
| **Sentinel White**  | `#FFFFFF` | Primary text and high-contrast elements.            |
| **Slate Metadata**  | `#94A3B8` | Secondary labels and descriptive text.              |

## 3. Typography Rules

- **Headings:** **Montserrat** (700). Used for titles and KPI headers to provide a strong, authoritative feel.
- **Body:** **Inter** (400-600). Used for all data points, descriptions, and functional UI for maximum legibility.
- **Character:** Tracking is wide for headers (`tracking-wide`) and tight for data points to emphasize precision.

## 4. Component Stylings

- **Buttons:** Subtly rounded (10px). The `btn-gold` uses a linear gradient from `#D4AF37` to `#B49020` with a subtle elevation shadow.
- **Cards (Glass-Card):** High-density cards with a `16px` blur, 1px white/5 border, and a subtle lift on hover.
- **Glassmorphism:** Navigation and overlays use `rgba(21, 41, 74, 0.95)` with a `16px` backdrop blur.

## 5. Layout Principles

- **Grid:** Data-dense layouts with max-width containers (`max-w-7xl`).
- **Whitespace:** Balanced but efficient. Priority is given to data visibility without clutter.
- **Animations:** Smooth transitions (0.3s cubic-bezier) and subtle fade-ins for a "living" dashboard feel.
