# Design System: Hotel Rate Sentinel (Professional & Crisp)

> This document defines the visual language for the full UI revamp of the Hotel Rate Sentinel project.

## 1. Vision & Tone

- **Crisp**: Sharp edges, fine lines, high-definition typography.
- **Professional**: Balanced layouts, sophisticated interactions, no clutter.
- **Advanced**: Use of subtle blur effects (glassmorphism), depth via shadows, and high-performance micro-animations.

## 2. Color Palette

- **Primary (Deep Ocean)**: `#0B1F3B` (Backgrounds, dark cards)
- **Accent (Soft Gold)**: `#D4AF37` (Primary actions, active states, premium branding)
- **Success (Emerald)**: `#10B981` (Price drops, optimal states)
- **Danger (Coral)**: `#EF4444` (Price hikes, yield risks)
- **Neutral (Slate)**:
  - Text Primary: `#FFFFFF`
  - Text Secondary: `#94A3B8`
  - Borders: `rgba(255, 255, 255, 0.1)`

## 3. Typography

- **Headings**: Montserrat (Bold, 700+)
  - Letter spacing: `-0.025em`
- **Body**: Inter (Thin/Medium/Semi-bold)
  - Letter spacing: `normal`

## 4. Components & Atoms

- **Cards (Glass)**:
  - Background: `rgba(21, 41, 74, 0.95)`
  - Border: `1px solid rgba(255, 255, 255, 0.1)`
  - Border Radius: `12px`
  - Shadow: Soft elevation shadow.
- **Buttons (Gold)**:
  - Gradient: `linear-gradient(135deg, #D4AF37 0%, #B49020 100%)`
  - Hover: Brighter gradient, subtle scale up.
- **Inputs**:
  - Dark background, subtle gold border on focus.

## 5. Visual Techniques

- **Glassmorphism**: 16px blur on overlays and navigation.
- **Gradients**: Subtle radial gradients to create depth in the background.
- **Micro-interactions**: Hover transforms (translateY -4px) for cards.

## 6. Design System Notes for Stitch Generation

> **Note to Stitch**: When generating screens, strictly follow the "Deep Ocean & Soft Gold" theme. All cards must be semi-transparent with blur effects. Use Montserrat for titles and Inter for data. Layouts should be "Bento-style" grids for the dashboard.
