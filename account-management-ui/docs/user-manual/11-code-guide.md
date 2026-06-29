# Code Guide (Retired from UI)

**Status:** Removed from active UI navigation  
**Current management path:** App Settings → Dropdown Values (`type_id = code_guide`)

---

## Overview

The standalone **Code Guide** page has been removed from the UI.

Code/reference values are still available in the system and are managed through configuration data:

- `app_config_types` (`type_id = code_guide`)
- `app_config_items` (entries for `code_guide`)
- API: `GET /api/config/items?typeId=code_guide`

---

## Operational Guidance

- To add/edit/reorder code-guide values, use **App Settings** (admin access).
- Functional modules (Finance/Internal Process/Invoice) continue consuming these values where applicable.
- No user-facing Code Guide page route is available.

---

## References

- [App Settings](./08-configuration.md)
- [Database Design](../DATABASE_DESIGN.md)
- [UI API DB Mapping](../UI_API_DB_MAPPING.md)

---

> **Previous:** [Notifications](./10-notifications.md) | **Back to Index:** [README](./README.md)
