# Code Guide

**Module:** Code Guide  
**Access:** All users (read-only view) | `config.admin` (add/edit/delete entries)

---

## Overview

The Code Guide is a **configuration-driven reference page** listing all known Rockwell Automation project codes, Open Air codes, and their associated metadata. It serves as the single source of truth for code look-up across all EAM modules — used when setting up SOWs, entering finance data, or verifying project associations.

### How Data Is Stored

Code Guide entries are **not a separate database table**. They are stored in the shared configuration system:

| Storage | Detail |
|---------|--------|
| **Table** | `app_config_items` (with `type_id = 'code_guide'`) |
| **Type definition** | `app_config_types` (entry where `type_id = 'code_guide'`) |
| **API endpoint** | `GET /api/config/items?typeId=code_guide` |
| **Managed via** | Configuration → Dropdown Values (type: Code Guide) |

This means any Admin can add, edit, or reorder codes directly in the **Configuration** module — no developer action needed.

---

## Screen

> **Screenshot:** Code Guide page — searchable reference table with code, label, and category columns

---

## Data Structure

Each Code Guide entry is an `app_config_item` record with the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| `item_value` | The actual code (unique identifier) | `RA-12345` |
| `label` | Human-readable project/code name | `Digital Services - ANZ` |
| `color` | Optional Ant Design colour tag | `blue`, `green` |
| `sort_order` | Display order in the table | `1`, `2`, `3` |
| `type_id` | Always `code_guide` for this module | `code_guide` |

> The Code Guide table in the UI maps these fields to columns: **Code** (`item_value`), **Name** (`label`), and **Category** (`color` tag).

---

## Step-by-Step: Looking Up a Code

1. Click **Code Guide** (📖) in the left sidebar.
2. The full code table loads automatically from `GET /api/config/items?typeId=code_guide`.
3. Use the **search bar** at the top to filter by:
   - Code value (e.g. `RA-12345`)
   - Project/code name (partial match supported)
   - Category tag
4. Results filter as you type — no need to press Enter.
5. Click **Reset** or clear the search box to show all codes again.

> 💡 **Tip:** Use `Ctrl + F` (browser native find) for fast in-page searching when the full table is loaded.

---

## Sorting the Table

1. Click any **column header** to sort ascending.
2. Click again to sort descending.
3. An arrow (↑ ↓) shows the current sort direction.
4. Default order is controlled by the `sort_order` field set in Configuration.

---

## Common Use Cases

| Use Case | How Code Guide Helps |
|----------|----------------------|
| Setting up a new SOW | Look up the correct Open Air code to enter in the `open_air_code` field of the SOW form |
| Entering finance revenue | Verify the code matches the correct project in `finance_projects` before entering amounts |
| Auditing project associations | Cross-check codes used across SOWs (`ra_process.open_air_code`) and finance (`finance_projects.code`) |
| Onboarding new team members | Familiarise with the full list of active project codes |
| Linking Beeline requests | Confirm which project code a Beeline request maps to before setting `account_anchor` |

---

## How Code Guide Entries Are Managed (Admin)

The Code Guide table **cannot be edited on this page**. Entries are managed through the **Configuration** module.

### Step-by-Step: Adding a New Code Entry

1. Navigate to **Configuration** → **Dropdown Values** tab.
2. Find and expand the **Code Guide** type in the list.
3. Click **+ Add Option**.
4. Fill in:
   - **Value** — the code (e.g. `RA-67890`)
   - **Label** — the project/code name
   - **Color** — optional category colour tag
5. Click **Save**.
6. The new entry immediately appears in the Code Guide for all users.

### Step-by-Step: Editing an Existing Code

1. Go to **Configuration** → **Dropdown Values** → expand **Code Guide**.
2. Click the **Edit** icon next to the entry.
3. Update the label, value, or colour.
4. Click **Save**.

### Step-by-Step: Reordering Codes

1. In the Code Guide option list in Configuration, drag the **⠿ handle** on any row.
2. Drop it in the new position.
3. The `sort_order` is updated automatically and reflected immediately in the Code Guide page.

### Step-by-Step: Deleting a Code

1. Click the **× icon** next to the entry in Configuration → Code Guide options.
2. Confirm the deletion.

> ⚠️ **Warning:** Deleting a code does not remove it from SOW records or finance entries that already use it — those records will retain the old code value. Always check usage before deleting.

---

## Relationship to Other Modules

| Module | How It Uses Code Guide |
|--------|------------------------|
| **Internal Process** | `open_air_code` field on each SOW (`ra_process` table) should match a Code Guide entry |
| **Finance Management** | `code` field on `finance_projects` records correlates to Open Air codes |
| **Invoice Management** | `code` field on `invoice_projects` records |
| **Configuration** | Stores and manages all Code Guide entries via `app_config_items` |

### API & Database Reference

```
UI: CodeGuide.tsx
  └── configApi.ts → GET /api/config/items?typeId=code_guide
        └── server/routes/config.js
              └── SELECT * FROM app_config_items WHERE type_id = 'code_guide' ORDER BY sort_order
```

For full schema detail see [Database Design](../DATABASE_DESIGN.md) — tables `app_config_types` and `app_config_items`.  
For the full UI → API → DB mapping see [UI API DB Mapping](../UI_API_DB_MAPPING.md) — section "Information > Code Guide".

---

> **Previous:** [Notifications](./10-notifications.md) | **Back to Index:** [README](./README.md)
