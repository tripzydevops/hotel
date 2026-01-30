# 📊 Strategic Reporting Roadmap: Moving Beyond Numbers

This document outlines the proposed technical and functional roadmap for the next generation of Tripzy.travel's reporting engine.

## 🎯 Goal

To transform the "Reports" page into a **Revenue Management Command Center** that uses Autonomous Agents to answer the "So What?" for hotel managers.

---

## 🏗️ The Three Proposed Strategies

### 1. Benchmarking Standard (STR-Lite)

Focus on industry-standard indices using occupancy data.

| Metric                             | Formula                                | Purpose                  |
| :--------------------------------- | :------------------------------------- | :----------------------- |
| **MPI** (Market Penetration Index) | (Your Occ % / Comp Set Occ %) \* 100   | Fair share of guests.    |
| **ARI** (Average Rate Index)       | (Your ADR / Comp Set ADR) \* 100       | Pricing strategy health. |
| **RGI** (Revenue Generation Index) | (Your RevPAR / Comp Set RevPAR) \* 100 | Ultimate yield score.    |

> [!NOTE]
> This requires a "User Signal Collection" module in Layer 1 to collect internal occupancy figures.

---

### 2. Autonomous Quadrant Advisor (The "Brain" Approach)

Using public signals to solve the **"Cold Start"** problem (where we have no occupancy data).

- **X-Axis**: **ARI** (Price Index - derived from Scraping).
- **Y-Axis**: **Competitive Sentiment Rank** (Your Rating vs. Comp Set - derived from Scraping).

**The Four Quadrants:**

1.  **Ahead & Gaining**: High Reputation + High Price (Market Leader).
2.  **Ahead & Losing**: High Price + Declining Sentiment (Value Risk - _Lower rates or fix services!_).
3.  **Behind & Gaining**: Low Price + High Sentiment (Recovery/Growth - _Opportunity to raise rates!_).
4.  **Behind & Losing**: Low Price + Low Sentiment (Crisis Mode).

---

### 3. Qualitative & Digital Intelligence

Benchmarking the "Invisible" market.

- **OTA Share of Voice**: Ranking position on page 1 of Google Hotels / Booking.com.
- **Stealth Pattern Detection**: Identifying if competitors are hiding discounts behind "Mobile-Only" or "Member-Only" tags.
- **Value-for-Money Gap**: Detecting when Price Index (ARI) exceeds Sentiment Index, creating a conversion bottleneck.

---

## 💡 Implementation Phases

### Phase 1: Foundation (Layer 3)

- [ ] Add `comp_set_type` ("Primary" vs "Aspirational") to `Hotel` model.
- [ ] Enhance scrapers to capture `review_rating` and `review_count` daily.
- [ ] Implement backend `get_indices` service to calculate ARI.

### Phase 2: Autonomous Intelligence (Layer 2)

- [ ] Develop **Agent Orchestration** to analyze the "Four-Quadrant" position.
- [ ] Generate **Agent-Written "So What?" Summaries** using Gemini.

### Phase 3: Visual Command Center (Layer 1)

- [ ] Build interactive 2x2 Quadrant Chart.
- [ ] Implement "Daily Pulse" notifications for "Stealth Undercutting" detection.

---

_Created on: 2026-01-30_
