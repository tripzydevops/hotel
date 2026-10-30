# Security Audit & Git History Credentials Report (October 2026)

## Executive Summary
A comprehensive credential and secrets audit was executed across both the active working tree (1,149 tracked files) and the entire commit history of the `tripzydevops/hotel` repository.

- **Current Working Tree Status:** ✅ **CLEAN (0 active leaks found)**. No live Google API keys, Supabase/InsForge service-role JWTs, DataForSEO credentials, or private keys exist in any tracked file.
- **Git History Status:** ⚠️ **12 Historical Commits Flagged for Key Rotation**. Secrets were introduced in historical commits prior to May 2026 before being removed in subsequent remediation commits.

---

## 1. Working Tree Audit
All 1,149 tracked files were scanned with regex detection patterns for:
- Google Gemini / Maps API Keys (`AIza[0-9A-Za-z\-_]{35}`)
- JWT Service Role Tokens (`eyJhbGci...`)
- RSA/EC Private Keys (`-----BEGIN ... PRIVATE KEY-----`)
- OpenAI API Keys (`sk-...`)
- Generic hardcoded credentials

**Result:** Zero active credentials found. Sensitive files ([`credentials.json`](file:///C:/projects/hotelplus-vm/credentials.json), [`project.json`](file:///C:/projects/hotelplus-vm/project.json), `.env*`) are properly excluded via [`.gitignore`](file:///C:/projects/hotelplus-vm/.gitignore). Administrative account metadata ([`SERPAPI_ACCOUNTS.md`](file:///C:/projects/hotelplus-vm/docs/archive/SERPAPI_ACCOUNTS.md)) was removed from the repository root and archived.

---

## 2. Git History Audit Findings
The following historical commits contain diff additions of sensitive credentials prior to remediation:

| Commit Hash | Credential Type | Description / Action Required |
| :--- | :--- | :--- |
| `e5ffa7cc` | Google API Key (`AIzaSyDLNO...`) | Legacy Google Gemini / Maps key. **Rotate in Google Cloud Console**. |
| `bda0a1f2` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | InsForge / Supabase Service Role Secret. **Rotate in InsForge dashboard**. |
| `7e36c466` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Duplicate historical staging. |
| `bac4e0e0` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical fallback key. |
| `3ba07cb8` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical test script insertion. |
| `b623ec99` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical test script insertion. |
| `d2208506` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical config insertion. |
| `5c1bdaf0` | JWT Service Role Key (`eyJhbGciOiJIUzI...`) | Historical backup insertion. |

---

## 3. Required Mitigation Actions

1. **Rotate Google API Key:**
   - Navigate to Google Cloud Console > APIs & Services > Credentials.
   - Delete/regenerate the key prefix matching `AIzaSyDLNO...`.
   - Update `GEMINI_API_KEY` and `GOOGLE_API_KEY` in Vercel project environment variables and `.env.local`.

2. **Rotate InsForge Service Role Key:**
   - In the InsForge project dashboard, cycle the `INSFORGE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
   - Update deployment secrets in GitHub Secrets and Vercel.

3. **Optional Git History Scrub:**
   - If enterprise compliance (SOC 2 / PCI) requires purging historical commits from git history, execute `git-filter-repo` or BFG Repo-Cleaner to rewrite history, followed by a force-push to `main`.
