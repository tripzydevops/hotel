# PCI DSS Scope Exclusion Statement
**Document Reference:** SEC-PCI-EXC-2026-V1  
**Effective Date:** May 30, 2026  
**Version:** 1.0  
**Status:** Approved  
**Classification:** Public  

---

## 1. Executive Summary
This document defines the Payment Card Industry Data Security Standard (PCI DSS) scope exclusion for **HotelPlus** (a product of Tripzy.travel). 

HotelPlus is a B2B hotel rate intelligence, market pricing analysis, and competitive parity monitoring platform. It is designed to assist hotel revenue managers in tracking public rate distribution and identifying parity violations. 

HotelPlus **does not** function as a property management system (PMS), central reservation system (CRS), booking engine, or point-of-sale (POS) terminal. As such, the platform does not process, store, transmit, or otherwise touch Cardholder Data (CHD) or Sensitive Authentication Data (SAD).

---

## 2. Scope Assessment & Exclusion Criteria
According to the PCI DSS v4.0.1 requirements, any entity that stores, processes, or transmits cardholder data, or can impact the security of the cardholder data environment (CDE), is subject to PCI compliance. 

HotelPlus has been evaluated against the following primary scoping criteria:

| Scoping Criteria | Application to HotelPlus | Status |
| :--- | :--- | :--- |
| **Primary Account Number (PAN) Storage** | The database schema (`supabase/` configurations) does not contain tables, columns, or fields designed to store PANs, expiration dates, CVVs, or cardholder names. | **Excluded** |
| **Payment Ingestion / Processing** | The platform contains no user-facing payment flows, booking forms, or transactional endpoints. All competitor pricing is gathered via public scraping endpoints (DataForSEO) and does not involve booking transactions. | **Excluded** |
| **Transmission of Credit Card Details** | No API routes (`api/` or backend FastAPI services) accept, transmit, or proxy payload structures containing cardholder data. | **Excluded** |
| **Connected System Security Impact** | HotelPlus operates in a separate, isolated cloud environment. It has no network connectivity or integrations with any client hotel’s local Cardholder Data Environment (CDE) or PMS payment interfaces. | **Excluded** |

---

## 3. Compliance & Questionnaire Eligibility
Because HotelPlus is entirely out of scope for handling cardholder data, it is eligible for scope exclusion representation when responding to hotel chain vendor security assessments.

* **Applicability:** Excluded from PCI DSS audit scope.
* **Relevant SAQ:** If required by enterprise procurement, HotelPlus aligns with **Self-Assessment Questionnaire A (SAQ-A)** as an entirely outsourced service provider with zero cardholder data footprint.
* **Attestation:** HotelPlus will provide this Scope Exclusion Statement alongside annual vulnerability scan summaries to satisfy chain vendor risk management queries.

---

## 4. Architectural Rules for Future Integrations
To maintain this scope exclusion and protect the security posture of the platform, the following architectural guidelines are enforced:

1. **Third-Party Gateways Only:** Any future billing or subscription flows for HotelPlus B2B users must be handled via a fully PCI-DSS compliant, redirect-based Tier 1 payment processor (e.g., Stripe, Adyen). Credit card details must never touch HotelPlus servers.
2. **Tokenization:** Direct API integrations for payments must use hosted fields or tokenization libraries (e.g., Stripe Elements) to ensure credit card numbers are transmitted directly from the client's browser to the payment processor.
3. **Database Constraints:** Row-level validation and schema validation rules will actively block any inputs resembling credit card number patterns (Luhn algorithm checks) in feedback forms or query logs.

---

## 5. Document Sign-Off & Review
This statement is reviewed annually by the security and architecture teams to ensure that any feature updates or architectural changes do not bring the platform back into PCI DSS scope.

**Approved by:**  
*Lead System Architect, Tripzy.travel / HotelPlus Security Group*
