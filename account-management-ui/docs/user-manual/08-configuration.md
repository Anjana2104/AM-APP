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
| **Configs** | Manage selectable dropdown lists linked to app modules |
| **App Values** | App key-value settings (URLs, thresholds, feature flags) |
| **Manage Data** | Centralised backup and delete-all operations for every module's data |

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

## Manage Data Tab

The **Manage Data** tab provides a centralised control panel for backing up and deleting data across every module in the application.

> ⚠️ **Warning:** All delete operations are **permanent and irreversible**. There is no recycle bin. Always download a backup before deleting.

### How It Works

Each module is shown as a card with two actions:

| Action | Description |
|--------|-------------|
| **Backup** | Downloads an Excel file with all current data for that module |
| **Delete All Data** | Permanently removes all records. Requires typing `DELETE` to confirm |

### Modules Available

| Category | Module Card | What It Deletes |
|---|---|---|
| Finance Management | SOW Details (Finance Projects) | All finance project milestones and revenue rows |
| Finance Management | Finance Bookings | All booking records across all projects |
| Invoice Management | Invoice Details | All invoice projects and monthly invoice amounts |
| Resource Information | Resource Records | All resource employee records |
| Resource Information | Resource Audit History | Audit trail entries for the Resources module |
| Resource Information | Resource Comments | All comments on resource records |
| Client Requests | Client Requests | All client request records |
| Client Requests | Request Audit History | Audit trail for Client Requests |
| Client Requests | Request Comments | All comments on request records |
| Internal Process | Internal Process Records (SOW / PIW) | All process records |
| Internal Process | Process Audit History | Audit trail for Internal Process |
| Internal Process | Process Comments | All process comments |
| Stakeholders | Client Stakeholder Hierarchy | All client stakeholder network records |
| Stakeholders | RA Stakeholder Hierarchy | All RA stakeholder network records |
| App Settings | App Configurations (Dropdown Types) | All custom dropdown types and their values |
| App Settings | App Values (Key-Value Store) | All app key-value settings |

### Permissions

- **Backup** is available to all users with view access to the module.
- **Delete All Data** requires `delete` permission on the module's page ID. If you lack permission, the button is disabled.

### Step-by-Step: Backup Before Delete

1. Navigate to **App Settings** → **Manage Data** tab.
2. Find the module card you want to manage.
3. Click **Backup** — an Excel file will download immediately.
4. Verify the downloaded file contains the expected data.
5. Click **Delete All Data**.
6. In the confirmation dialog, type `DELETE` (all caps).
7. Click **Delete All Data** to proceed.

---

> **Previous:** [Resource Intelligence](./07-resource-intelligence.md) | **Next:** [User Access Control](./09-user-access-control.md)
