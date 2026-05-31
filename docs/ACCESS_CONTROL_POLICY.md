# 🔑 HotelPlus Access Control Policy

**Document Version:** 1.0.0  
**Effective Date:** May 30, 2026  
**Applicability:** All HotelPlus administrators, engineers, and platform users.  

---

## 1. Objective and Policy Statement
The purpose of this policy is to define rules for access to HotelPlus applications, databases, and hosting infrastructure. HotelPlus operates on the **Principle of Least Privilege (PoLP)**: access rights are granted only to the level required to perform a specific job function, preventing unauthorized data exposure.

---

## 2. Role-Based Access Control (RBAC)
The application enforces strict logical access boundaries via predefined roles at both the application layer and database layer:

| Role Name | Scope of Access | Enforced Permissions |
|:---|:---|:---|
| **User (Hotel Manager)** | Limited to their own hotel profile. | Read-only analysis, read-write watch lists (competitor hotels), read-only historical reports. |
| **Manager (Revenue Director)** | Limited to their own hotel entity and child properties. | Edit hotel settings, configure scan thresholds, manage subscription tiers. |
| **System Administrator (DevOps)** | Global system read/write. | Manage global scanning schedules, review system logs, configure database migrations. |

---

## 3. Database Layer Access: Tenant Isolation & RLS
To guarantee robust tenant isolation in a multi-tenant B2B model:
1.  **Row-Level Security (RLS):** All tables in the database (hosted on InsForge) enforce PostgreSQL Row-Level Security policies.
2.  **User-Context Isolation:** Database connections retrieve data by evaluating `auth.uid()`, matching the user's validated tenant context. No tenant can view or execute queries against another tenant's raw data, pricing watch list, or logs.
3.  **Credential Scrubber:** Automated sanitization protocols scrub database error codes and traces on the FastAPI gateway before they reach frontend layers to prevent leakage of physical schema structures.

---

## 4. Account Lifecycle Management

### Account Provisioning
*   Access requests for admin roles must be submitted to the Lead Architect and require multi-stage verification.
*   Upon approval, the system administrator configures the minimum required role mapping inside the database profiles.

### Account De-provisioning (Offboarding)
*   Upon termination of employment or B2B subscription cancellation:
    *   Administrator accounts are disabled immediately (within 2 hours of notification).
    *   B2B customer profile datasets are flagged for hard deletion.
    *   Any cached authentication sessions are revoked immediately in the database.

---

## 5. Password Security & Authentication Standards
*   **MFA (Multi-Factor Authentication):** Strictly enforced for all system administrator and operator roles. Upon password verification, the login pipeline halts and prompts the user for a 6-digit One-Time Password (OTP) delivered securely via our verified Gmail SMTP delivery pipeline. The 6-digit OTP code is validated cryptographically and matched against database-level persistence (`public.user_profiles.mfa_secret`) on our secure FastAPI backend. Session cookies (`hp_sess`) are only issued after successful MFA verification.
*   **Token Expiration:** JSON Web Tokens (JWT) are valid for a maximum of 24 hours. Refresh sessions require secure, HTTP-only verification keys.
*   **Failed Logins:** Accounts are automatically locked out for 15 minutes after 5 consecutive failed login attempts to prevent brute-force attacks.

---

## 6. Access Auditing and Review
*   **Access Reviews:** The system administrator conducts formal access control reviews quarterly to verify that only authorized employees hold admin roles.
*   **Audit Logging:** All authentication events (logins, logouts, password resets, role updates) are recorded in database logs. These logs are retained for 365 days in rollup formats to support forensic compliance audits.
