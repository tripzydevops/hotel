# Tripzy.travel 🚀

### Autonomous Agent-Based Recommendation Engine

**Tripzy.travel** is a next-generation travel intelligence platform designed to solve the "Cold Start" problem using Autonomous Agents and LLM-based reasoning.

## 🏗️ Technical Architecture

We adhere to a strict **3-Layer Architecture**:

1. **LAYER 1: User Interface & Signal Collection**
   - Next.js Web Dashboard & React Native Mobile App.
   - Real-time user signal collection module.
   - Dynamic i18n support (EN/TR) and Currency Normalization.

2. **LAYER 2: Autonomous Reasoning Engine (The "Brain")**
   - FastAPI-powered backend with Autonomous Agent orchestration.
   - **Strategic Intelligence Layer**: Calculates **ARI (Average Rate Index)** and **GRI (Global Review Index)** to perform market benchmarking.
   - **Autonomous Quadrant Advisor**: Real-time analysis of Price vs. Value to provide actionable revenue management insights.

3. **LAYER 3: Data & Algorithms (The Infrastructure)**
   - **Supabase** for relational and vector storage.
   - `pgvector` for semantic hotel search and hybrid recommendations.
   - Real-time market data extraction via **SerpApi**.

## 📊 Core Features

- **ARI (Price Index)**: Real-time price benchmarking against market averages.
- **GRI (Sentiment Index)**: Scientific sentiment analysis based on rating and social proof volume.
- **Quadrant Visualization**: Dynamic 2x2 grid for strategic positioning.
- **Enterprise Reports**: Professional PDF/CSV exports with multi-currency support.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase Account
- SerpApi Key

### Installation

1. Clone the repository
2. Install frontend dependencies: `npm install`
3. Install backend dependencies: `pip install -r requirements.txt`
4. Set up `.env` from `.env.example`

### Running Locally

```bash
# Frontend
npm run dev

# Backend
cd backend
uvicorn main:app --reload
```

---

_Built with ❤️ for the future of Autonomous Travel Intelligence._
