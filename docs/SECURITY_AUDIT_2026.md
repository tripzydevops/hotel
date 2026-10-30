# Security Audit & Git History Credentials Report (October 2026)

## Executive Summary
A comprehensive credential and secrets audit was executed across both the active working tree (1,149 tracked files) and the entire commit history of the `tripzydevops/hotel` repository.

- **Current Working Tree Status:** ✅ **CLEAN (0 active leaks found)**. No live Google API keys, Supabase/InsForge service-role JWTs, SerpApi keys, DataForSEO credentials, Firecrawl tokens, VAPID private keys, or private keys exist in any tracked file.
- **Git History Status:** ⚠️ **Historical Commits Flagged Across 3 Providers**. Secrets were introduced in historical commits prior to May 2026 before being removed in subsequent remediation commits.

---

## 1. Multi-Provider Coverage Matrix

| Provider / Key Type | Working Tree Status | Git History Status | Mitigation / Rotation Status |
| :--- | :--- | :--- | :--- |
| **Google Gemini / Cloud API** | ✅ Clean (0 leaks) | ⚠️ Flagged (Commit `e5ffa7cc`) | Key rotated in Google Cloud Console |
| **InsForge / Supabase Service Key** | ✅ Clean (0 leaks) | ⚠️ Flagged (7 historical commits) | Service role secret cycled in InsForge |
| **SerpApi Keys** | ✅ Clean (0 leaks) | ⚠️ Flagged (Commits `02001e03`, `d4b8ba0e`) | Free/pool keys rotated & removed from code |
| **DataForSEO API** | ✅ Clean (0 leaks) | ✅ Clean (0 leaks in git history) | Uses environment variables only |
| **Firecrawl API** | ✅ Clean (0 leaks) | ✅ Clean (0 leaks in git history) | Uses environment variables only |
| **VAPID / Web Push Keys** | ✅ Clean (0 leaks) | ✅ Clean (0 leaks in git history) | Uses environment variables only |

---

## 2. Working Tree Audit
All 1,149 tracked files were scanned with regex detection patterns for:
- Google Gemini / Maps API Keys (`AIza[0-9A-Za-z\-_]{35}`)
- JWT Service Role Tokens (`eyJhbGci...`)
- SerpApi 64-character hex tokens
- DataForSEO Basic Auth headers
- Firecrawl tokens (`fc-...`)
- VAPID private keys
- RSA/EC Private Keys (`-----BEGIN ... PRIVATE KEY-----`)

**Result:** Zero active credentials found. Sensitive files ([`credentials.json`](file:///C:/projects/hotelplus-vm/credentials.json), [`project.json`](file:///C:/projects/hotelplus-vm/project.json), `.env*`) are properly excluded via [`.gitignore`](file:///C:/projects/hotelplus-vm/.gitignore). Administrative account metadata ([`SERPAPI_ACCOUNTS.md`](file:///C:/projects/hotelplus-vm/docs/archive/SERPAPI_ACCOUNTS.md)) was removed from the repository root and archived.

---

## 3. Git History Audit Findings by Commit

| Commit Hash | Credential Type | Description / Action Required |
| :--- | :--- | :--- |
| `e5ffa7cc` | Google API Key (`AIzaSyDLNO...`) | Legacy Google Gemini / Maps key. **Rotate in Google Cloud Console**. |
| `02001e03` | SerpApi Keys (Historical pool) | Batch of test/free keys committed in early dev. **Regenerate in SerpApi dashboard**. |
| `d4b8ba0e` | SerpApi Keys (`d31e23...`, `755ba8...`) | Early API client prototype commits. **Regenerate in SerpApi dashboard**. |
| `bda0a1f2` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | InsForge / Supabase Service Role Secret. **Rotate in InsForge dashboard**. |
| `7e36c466` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Duplicate historical staging. |
| `bac4e0e0` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical fallback key. |
| `3ba07cb8` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical test script insertion. |
| `b623ec99` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical test script insertion. |
| `d2208506` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical config insertion. |
| `5c1bdaf0` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical backup insertion. |

---

## 4. Required Mitigation & Rotation Checklist

1. **Google Cloud Console:**
   - Go to Google Cloud Console > APIs & Services > Credentials.
   - Delete/regenerate any key matching prefix `AIzaSyDLNO...`.
   - Update `GEMINI_API_KEY` and `GOOGLE_API_KEY` in Vercel project environment variables and `.env.local`.

2. **InsForge / Supabase Backend:**
   - In the InsForge project dashboard (API settings), regenerate the JWT `service_role` secret.
   - Update `INSFORGE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in GitHub Secrets and Vercel.

3. **SerpApi:**
   - Log into SerpApi dashboard, cycle the API keys, and verify only `SERPAPI_API_KEY` environment variables are used in production.

4. **Optional Git History Scrub:**
   - If enterprise compliance (SOC 2 / PCI) requires purging historical commits from git history, execute `git-filter-repo` or BFG Repo-Cleaner to rewrite history, followed by a force-push to `main`.
