# SerpApi Account Renewal Dates

This file serves as a persistent record of the renewal dates for the SerpApi keys used in this project. Since SerpApi Free Plans do not expose renewal dates via their Account API, these values are manually extracted from user screenshots and implemented as overrides in `backend/services/serpapi_client.py`.

## Key Mapping

| Node | Owner | Key Fragment | Renewal Date | Source Date |
| :--- | :--- | :--- | :--- | :--- |
| **Node 01** | selcuk ozkan | `...31187e` | **March 5th** | 2026-03-03 |
| **Node 02** | (Pending) | `...c7f222` | Monthly Reset | TBD |
| **Node 03** | fast earn | `...73f3db` | **March 4th** | 2026-03-03 |
| **Node 04** | tripzydevops | `...44c1dc` | **March 25th** | 2026-03-03 |

## Backend Sync
These dates are hardcoded in `MANUAL_RENEWAL_OVERRIDES` within `backend/services/serpapi_client.py` to ensure they populate the Admin Panel correctly.

> [!NOTE]
> If a key is upgraded to a paid plan, SerpApi will start returning the `plan_renewal_date` field, which will automatically override these manual entries if the code is updated to check for API presence first.
