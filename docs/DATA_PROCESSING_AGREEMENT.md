# 📄 HotelPlus Data Processing Agreement (DPA) Template

This **Data Processing Agreement (DPA)** is entered into by and between the **Hotel Client** (acting as "Data Controller") and **HotelPlus** (acting as "Data Processor"). It forms an addendum to the main B2B Software Service Agreement governing the use of the HotelPlus Market Intelligence platform.

---

## 1. Definitions and Interpretation
*   **"Applicable Privacy Law"** means GDPR (Regulation (EU) 2016/679), KVKK (Turkish Personal Data Protection Law No. 6698), CCPA/CPRA, and all other regional data protection statutes.
*   **"Personal Data"**, **"Data Subject"**, **"Processing"**, **"Controller"**, and **"Processor"** have the meanings defined under the GDPR.
*   **"Subprocessor"** means any third-party processor engaged by HotelPlus to process metadata or support platform hosting infrastructure.

---

## 2. Scope and Nature of Data Processing

### Categories of Data Subjects
*   **B2B Authorized Users:** Hotel revenue managers, administrators, and directors accessing the B2B dashboard.

### Categories of Personal Data Processed
*   **Business Contact Metadata:** Names, business email addresses, work telephone numbers, hotel corporate names, and job titles.
*   **System Event Logs:** Client IP addresses, browser user agent strings, and interface activity logs.

### Excluded Data Categories (PCI Exclusion Scope)
*   **Strict Prohibitions:** The Data Controller is strictly prohibited from entering guest credit card details, payment data, or guest reservation databases (PII) into the platform. HotelPlus does **not** process, store, or transmit payment card data.

---

## 3. Obligations of the Data Processor (HotelPlus)
1.  **Instructions:** HotelPlus shall process Personal Data solely on the documented instructions of the Data Controller.
2.  **Confidentiality:** HotelPlus ensures that all employees authorized to process Personal Data are bound by strict confidentiality obligations.
3.  **Data Deletion:** Upon account closure or termination of the service agreement, HotelPlus shall execute a hard deletion of all stored B2B user profiles from our database servers (hosted on InsForge) within 30 days, unless applicable legislation requires retention.
4.  **Audit Assistance:** HotelPlus shall provide the Data Controller with compliance summaries, penetration test summaries, and platform validation evidence upon request.

---

## 4. Security Measures (Technical and Organizational)
HotelPlus implements the following security controls:

*   **Tenant Isolation:** Row-Level Security (RLS) is enforced in the PostgreSQL database layer to prevent cross-customer data leakage.
*   **Encryption:** All data in transit is encrypted using Transport Layer Security (TLS 1.3).
*   **Error Masking:** Automated backend exception handlers scrub detailed database trace logs on 500 error responses to prevent infrastructure information exposure.
*   **Rate Limits:** Strict rate limiting is enforced on authentication routes (10 reqs/min) and general endpoints (60 reqs/min) to prevent brute-force attacks and maintain system availability.

---

## 5. Subprocessor Management
The Data Controller authorizes HotelPlus to engage the following subprocessors to deliver the platform infrastructure:

| Subprocessor | Services Provided | Data Location | Privacy Safeguards |
|:---|:---|:---|:---|
| **InsForge** | Database hosting & PostgREST database layer. | EU-Central-1 | GDPR compliant, SOC 2 / ISO 27001. |
| **Vercel** | Web application hosting & edge delivery network. | Global (Edge) | GDPR compliant, SOC 2 compliant. |

---

## 6. Personal Data Breaches
1.  **Response:** HotelPlus shall notify the Data Controller **within 72 hours** of validating any security incident that results in unauthorized access, alteration, or disclosure of the B2B user profile metadata.
2.  **Mitigation:** HotelPlus shall immediately implement containment protocols and provide the Data Controller with updates regarding remediation efforts.
