# App Settings

**Module:** App Settings  
**Access:** `config.admin` — Administrators only

---

## Overview

The App Settings module is the administrative control panel for the EAM application. It manages all app-wide settings: dropdown option lists, app key-value settings, notification trigger rules, and document templates used across every other module.

---

## Screens & Tabs

| Tab | Purpose |
|-----|---------|
| **App Notifications** | Configure automatic in-app notification rules on field changes |
| **Templates** | Upload and manage document templates (PIW, SOW, holiday calendar) |
| **Dropdowns & Values** | Manage selectable dropdown lists and app key-value settings |

> Navigate to **App Settings** from the Settings & Configuration (⚙️) menu in the sidebar.

---

## App Notifications Tab

> **Screenshot:** App Notifications tab — trigger list with source table, field, recipients, and active toggle

Notification triggers automatically generate internal notifications when monitored fields change on records.

### What You See

- A table of all configured notification rules.
- Columns: Trigger Name, Source Table, Trigger Field(s), Recipients, Active toggle.
- Rows are drag-sortable to control display order.

### Step-by-Step: Creating a New Trigger

1. Click the **App Notifications** tab.
2. Click **+ New Trigger**.
3. Fill in the trigger form:

| Field | Description |
|-------|-------------|
| Name | A descriptive label for the trigger |
| Source Table | The data table to monitor (e.g., `ra_process`, `client_requests`) |
| Trigger Field | The field to watch (or `__any__` to fire on any change) |
| Notification Type | `Task`, `Info`, or `Alert` |
| Recipients | `Broadcast` (all users), `Notify a User Group`, or `field_value` (user whose ID matches the new value) |
| Message Template | Notification text — supports `{field}`, `{old_value}`, `{new_value}`, `{changed_by}`, `{record_name}` tokens |
| Active | Whether the rule is live immediately |

4. Click **Save Trigger**.

### Step-by-Step: Enabling / Disabling a Trigger

1. Find the trigger in the list.
2. Click the **Active toggle** (green = active, grey = inactive).
3. The toggle saves immediately — no Save button needed.

### Step-by-Step: Editing or Deleting a Trigger

- Click the **Edit** (✏️) icon to open the trigger form pre-filled.
- Click the **Delete** (🗑️) icon then confirm — stops all future notifications from that rule.

### Special Field Values

| Value | Behaviour |
|-------|-----------|
| `__any__` | Fires when **any** field on the record changes |
| `__bulk_insert__` | Fires when records are bulk-imported |
| `__delete_all__` | Fires when all records in a table are deleted |
| `__record_delete__` | Fires when a single record is deleted |

### Message Template Tokens

| Token | Replaced With |
|-------|--------------|
| `{trigger_label}` | Descriptive trigger name |
| `{field}` | Name of the field that changed |
| `{old_value}` | Previous field value |
| `{new_value}` | New field value |
| `{changed_by}` | Username who made the change |
| `{record_name}` | Name/identifier of the affected record |
| `{changes}` | Summary of all changed fields (wildcard triggers) |

---

## Templates Tab

> **Screenshot:** App Settings — Templates tab with file list, download icons, and Upload button

Document templates (PIW workbooks, SOW Word documents, holiday calendars) are stored and managed here. Only the **latest uploaded version** of each template type is kept.

### Step-by-Step: Uploading a Template

1. Click the **Templates** tab.
2. Click **Upload Template** ℹ️ (hover the info icon to see usage notes).
3. In the file dialog, select the template file.
4. Click **Upload**.
5. The new version replaces the previous one for that template type.

### Step-by-Step: Downloading or Deleting a Template

- Click the **Download** icon (⬇️) to save a copy locally.
- Click the **⋯ (more)** menu → **Delete** to remove it permanently.

> ⚠️ **Warning:** Deleting a template removes it permanently. Active PIW/SOW generation will fail if the required template is deleted.

---

## Dropdowns & Values Tab

This combined tab has two sub-views toggled by the **Segmented control** at the top: **Dropdown Types** and **App Values**.

---

### Dropdown Types

> **Screenshot:** Dropdowns & Values — Dropdown Types view with expandable type list

Dropdown Types control what options appear in filter dropdowns, form selects, and status pickers across all modules.

#### Step-by-Step: Adding a New Option

1. Select **Dropdown Types** in the segmented control.
2. Click on a type row in the left panel to select it.
3. Click **+ Add** in the right panel (option list).
4. Enter the option label, value, and colour.
5. Click **Save** — the option is immediately available across the app.

#### Step-by-Step: Reordering Options

1. Select the type in the left panel.
2. Drag any option row using the **drag handle** (⠿) on the left.
3. Drop it in the desired position — order is saved automatically.

#### Step-by-Step: Deleting an Option

1. In the right panel, click the **⋯** menu on the option row → **Delete**.
2. Confirm deletion.

> ⚠️ **Warning:** Deleting an option that is in use by existing records leaves those records with an orphaned value. Check usage before deleting.

#### Built-in Types

Types marked as **Built-in** cannot be deleted. Their options can still be edited.

---

### App Values

App Values are named key-value settings referenced by specific application features (e.g., fiscal year start, default rate).

#### Step-by-Step: Adding an App Value

1. Select **App Values** in the segmented control.
2. Click **+ New** (top right).
3. Fill in the **Key**, **Value**, and optional **Description** in the popup.
4. Click **Save**.

#### Step-by-Step: Editing or Deleting an App Value

- Click the **Edit** (✏️) icon on a value row to modify it.
- Click the **⋯** menu → **Delete** to remove it.

---

> **Previous:** [Resource Intelligence](./07-resource-intelligence.md) | **Next:** [User Access Control](./09-user-access-control.md)
