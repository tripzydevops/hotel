# Auth Session Recovery Guide (InsForge)

This guide documents the specific behaviors, pitfalls, and solutions related to user session management in our InsForge + Vercel stack. 

## The Core Problem: GoTrue vs. PostgREST

InsForge uses a Supabase-compatible architecture, but with specific quirks in how it handles JWTs and sessions.

### Symptom
User is logged into the frontend (UI shows "Logged In"), but API calls return `401 Unauthorized` or `403 Forbidden` with the message: `"Invalid or expired session token"`.

### Root Cause
1.  **JWT Lifetime**: Frontend tokens (from `@insforge/sdk`) have a short TTL (usually 1 hour).
2.  **Auto-Refresh Failure**: If the frontend fails to refresh the token, or if the user stays on a page indefinitely, the token sent to the API becomes stale.
3.  **InsForge 0-Byte Response**: When verifying a session via the `/api/auth/sessions/current` endpoint, InsForge may return a `200 OK` with an **empty body** (Content-Length: 0) if the internal session state is in transition but invalid.

---

## The Solution: Centralized Verification

We have implemented a specialized verification path in `backend/services/auth_service.py` to handle these edge cases.

### 1. Token Verification logic
Instead of relying solely on the JWT signature, we call the InsForge Auth API directly using the provided token.

```python
# EXPLANATION: Centralized Auth Gate
# We call {INSFORGE_URL}/api/auth/sessions/current to verify the token.
# This prevents "Ghost Sessions" where a JWT is technically valid but the
# backend session has been terminated or invalidated.
```

### 2. Handling the 0-Byte Body
Our `_verify_token_via_insforge` function tracks if the response is empty. If it is, we treat it as an expired session and trigger a `401`.

```python
# EXPLANATION: InsForge Payload Guard
# If 'data' is empty but status was 200, it's an invalid state.
if not data:
    return None
```

---

## Troubleshooting Checklist

If you see recurring `401` errors in the logs:

1.  **Check `NEXT_PUBLIC_SUPABASE_URL`**: Ensure it matches the InsForge project URL exactly.
2.  **Inspect JWT**: Use [jwt.io](https://jwt.io) to check the `exp` (expiration) field.
3.  **Verify Admin Keys**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel. 
4.  **Middleware Check**: Ensure `middleware.ts` is extracting the `Authorization: Bearer <token>` header correctly from the request.

## How to Fix (Code Reference)

Refer to these files for the current implementation:
- `backend/services/auth_service.py`
- `backend/main.py` (Manual CORS & Error Handling)
- `backend/utils/db.py` (The PostgREST override quirk)
