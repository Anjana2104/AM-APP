# Resource Hub

**Module:** Resource Hub  
**Access:** `resources.read` (view) | `resources.write` (edit, import)

---

## Overview

The Resource Hub is the master repository for all Rockwell Automation resources (employees). It supports bulk import from Excel, manual record editing, detailed per-resource drawers, and tracks which resources are currently active or have been removed from engagements.

---

## Screens

| View | Purpose |
|------|---------|
| **Resource List** | Full table of all resources with search and filters |
| **Resource Detail Drawer** | Right-side panel with full resource profile and comments |
| **Removed Resources** | View of disengaged/offboarded resources |

---

## Resource List

> **Screenshot:** Resource Hub — main table with search bar, status filter, and resource rows

### Table Columns

| Column | Description |
|--------|-------------|
| RA ID | Rockwell Automation employee identifier (unique) |
| Name | Employee full name |
| Email | Corporate email address |
| PIW Role | Role assigned in the PIW file |
| Role / Domain | Functional role or technology domain |
| Skills | Primary and secondary skills (comma-separated) |
| Engagement | Current engagement status |
| Date of Joining | Employee start date |
| Work Experience | Total experience in years |
| Linked SOW | SOW the resource is currently assigned to |

### Step-by-Step: Finding a Resource

1. Navigate to **Resource Hub** from the sidebar.
2. The full resource list loads by default.
3. Use the **search bar** at the top to search by name, RA ID, or email.
4. Use the **Engagement Status** filter dropdown to show only resources with a specific status (e.g., Deployed, Available, On Bench).
5. Results update instantly as you type or select.

---

## Bulk Import (Excel Upload)

> **Screenshot:** Upload dialog — file picker with preview table showing parsed resource rows

Bulk import allows you to load or update hundreds of resources at once from an Excel file.

### Step-by-Step: Importing Resources

1. Click the **Upload / Import** button in the top-right of the Resource Hub.
2. In the file picker dialog, select your `.xlsx` resource file.
3. The system parses the file and shows a **preview table** with the extracted rows.
4. Review the preview — verify that names, RA IDs, and fields look correct.
5. Click **Confirm Import**.
6. The system **upserts** records by RA ID:
   - If the RA ID already exists → the record is **updated**.
   - If the RA ID is new → a **new record is inserted**.
7. A summary dialog shows the count of inserted and updated records.

### Import File Format

| Column | Required | Notes |
|--------|----------|-------|
| RA ID | ✅ Yes | Must be unique per employee |
| Name | ✅ Yes | Full name |
| Email | No | Corporate email |
| PIW Role | No | Role as per PIW file |
| Role / Domain | No | Functional domain |
| Skills | No | Comma-separated skill list |
| Engagement | No | Current status |
| Date of Joining | No | YYYY-MM-DD format |

> ⚠️ **Note:** The RA ID column must not contain duplicates within the file. Rows with a blank RA ID are skipped.

---

## Resource Detail Drawer

> **Screenshot:** Resource Detail Drawer — profile fields, Beeline ID link, SOW link, comments section

### Step-by-Step: Opening a Resource Detail

1. Click on any resource row in the table.
2. A **right-side drawer** opens with the full resource profile.

### What the Drawer Contains

| Section | Contents |
|---------|---------|
| Header | Name, RA ID, email, current engagement status badge |
| Basic Info | PIW Role, Role/Domain, Date of Joining, Work Experience |
| Skills | Primary skills, secondary skills, certifications |
| Beeline ID | Displayed as a **clickable link** |
| Linked Process (SOW) | Displayed as a **clickable link** below Beeline ID |
| Comments | Timestamped comment history with author |
| Add Comment | Text input to add a new comment |

### Beeline ID — Clickable Link

- Click the **Beeline ID** value to open the matching Client Request in the Client Requests module.
- If no Beeline ID is linked, the field is shown as empty.

### Linked Process / SOW — Clickable Link

- Click the **SOW name** to navigate directly to that SOW in Internal Process (Process tab), with the SOW pre-filtered.

### Step-by-Step: Editing Resource Fields

1. Open the resource detail drawer.
2. Click on any field to make it editable.
3. Update the value.
4. Click **Save** to persist the changes.
5. All edits are recorded in the resource's audit trail.

### Step-by-Step: Adding a Comment

1. Scroll to the bottom of the resource detail drawer.
2. Click in the **Add Comment** text area.
3. Type your note or update.
4. Click **Add** (or press Enter if configured).
5. The comment appears at the top of the comment history with your name and timestamp.

---

## Removed Resources

> **Screenshot:** Removed Resources view — greyed-out resource cards or rows indicating disengagement

Removed resources are those who have been disengaged from all active SOWs (offboarded, resigned, or contract ended).

### Viewing Removed Resources

1. In Resource Hub, look for the **Removed / Disengaged** toggle or tab.
2. Toggle to **Removed** to see only disengaged resources.
3. Their engagement status will indicate disengagement (e.g., "Removed", "Offboarded").

> ⚠️ **Note:** Removed resources are **not deleted** from the system. Their full history, comments, and audit log are preserved. They can be re-activated if they re-join.

---

> **Previous:** [Client Requests](./05-client-requests.md) | **Next:** [Resource Intelligence](./07-resource-intelligence.md)
