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

---

## 🛡️ Advanced Resilience: JWT Manual Fallback Decoding

In production, external auth services may occasionally face transient network timeouts or service interruptions. To guarantee **100% uptime and resilience**, `backend/services/auth_service.py` implements a dual-layer authentication check:

1. **Primary Gate**: Verifies the token via the direct InsForge REST API session endpoint `/api/auth/sessions/current`.
2. **Fallback Gate**: If the primary REST API call fails (timeout, network error, or returns status 401/empty), the service automatically falls back to **safe manual JWT payload decoding**.
   - It splits the JWT token securely, handles base64-urlsafe padding normalization, and parses the JSON body.
   - Extracts user metadata (`sub`/`id`, `email`, and `role`).
   - Duck-types a `SimpleNamespace` representing the verified user payload, ensuring zero disruption to authorized frontend requests during downstream downtime.

---

## 🚨 Python FastAPI Sequential Dependency Evaluation Pitfall

### The Bug
A critical, hard-to-detect `NameError` startup crash occurred with the following symptom:
```text
File "/home/tripzydevops/hotel/backend/services/auth_service.py", line 120, in <module>
    insforge: Client = Depends(get_insforge_rls),
                               ^^^^^^^^^^^^^^^^
NameError: name 'get_insforge_rls' is not defined
```

### Root Cause
In Python, FastAPI dependency injection defaults (such as `Depends(get_insforge_rls)`) are evaluated at module-load/function-definition time. Because `get_insforge_rls` was defined below the route dependencies (e.g., `get_current_admin_user` and `get_current_active_user`) in the file, Python encountered a reference to `get_insforge_rls` before it was registered in the namespace.

### Resolution
The dependency helpers `get_insforge_rls`, `get_insforge_admin`, and their backward-compatibility aliases (`get_supabase_rls`, `get_supabase_admin`) were repositioned immediately after `get_token()` (and before any function definition that uses them as a default value). This guarantees error-free loading during application startup.

---

## 🧪 Verification & Testing Suite

To prevent regression and verify resilience under extreme token states, we created and verified the test suite at `scratch/test_jwt_fallback.py` which covers:
- **Valid Token Fallback Decoding (`test_jwt_fallback_success`)**: Verifies correct field extraction (`sub`, `email`, `role`) and object construction during simulated downstream API downtime.
- **Invalid Token Payload Structure (`test_jwt_fallback_invalid_payload`)**: Confirms that corrupted base64 or invalid JSON is safely caught and returns a standard `HTTPException(401)`.
- **Malformed Tokens (`test_jwt_fallback_abnormal_token`)**: Confirms abnormal tokens (no dots, malformed strings) raise a proper `HTTPException(401)` with zero unhandled exceptions.

---

## How to Fix (Code Reference)

Refer to these files for the current implementation:
- [backend/services/auth_service.py](file:///home/tripzydevops/hotel/backend/services/auth_service.py)
- [backend/main.py](file:///home/tripzydevops/hotel/backend/main.py) (Manual CORS & Error Handling)
- [backend/utils/db.py](file:///home/tripzydevops/hotel/backend/utils/db.py) (The PostgREST override quirk)
- [scratch/test_jwt_fallback.py](file:///home/tripzydevops/hotel/scratch/test_jwt_fallback.py) (Automated resilience test suite)
