# 👻 Autonomous Discovery Engine (Technical Deep-Dive)

The **Autonomous Discovery Engine** is a core capability of **Hotel Rate Sentinel** that solves the "Cold Start" problem by proactively identifying strategic rivals using AI-powered semantic matchmaking.

## 🏗️ Architecture

The engine operates as a specialized module within the **Analyst Agent**, leveraging high-speed vector similarity search.

### 1. The Vector Space

We use **Supabase (pgvector)** to store and query hotel metadata in a 768-dimensional vector space.

- **Storage**: `hotel_directory` table, `embedding` column (type: `vector(768)`).
- **Indexing**: **HNSW (Hierarchical Navigable Small World)** index for sub-100ms similarity lookups.
  ```sql
  CREATE INDEX ON hotel_directory USING hnsw (embedding vector_cosine_ops);
  ```

### 2. Semantic Embeddings

Hotel "Vibes" are converted into math using Gemini.

- **Model**: `models/embedding-001`.
- **Logic**: We serialize hotel name, stars, rating, location context, and SerpApi snippet highlights into a "Metadata String" before embedding.

### 3. Discovery Flow

1. **Target Identification**: The user selects a hotel and opens the Analysis page.
2. **Signal Generation**: The backend generates (or fetches) the embedding for the target hotel.
3. **Similarity Search**: An RPC call (`match_hotels`) identifies the top 5 properties in the global directory with the highest **Cosine Similarity**.
4. **Filtering & City Fallback (May 6, 2026 Bugfix)**:
    - **Issue**: Previously, omitting the `target_city` parameter in `AnalystAgent.discover_rivals` caused the underlying `match_hotels` RPC fallback to run globally, resulting in semantic leakage where hotels from different cities were matched if geographic coordinates were missing or corrupted.
    - **Fix**: The system now strictly enforces a city-bounded matching boundary by passing a verified `target_city` string. If coordinates are unavailable, the search correctly scopes within the same metropolitan area or municipality, eliminating cross-city matches.
5. **UI Rendering**: The `DiscoveryShard` renders these matches with a "Match Percentage."

## 🛠️ Developer Guide

### Update Embeddings

If hotel metadata changes, you must regenerate the embedding:

```bash
python backend/scripts/seed_embeddings.py
```

### Extending Discovery Logic

To refine match accuracy, modify the `format_hotel_for_embedding` function in `backend/utils/embeddings.py`. Adding more features (e.g., specific amenities like "Infinity Pool") will improve the semantic overlap for luxury segments.

---

_Hotel Rate Sentinel R&D - Phase 5 Documentation_
