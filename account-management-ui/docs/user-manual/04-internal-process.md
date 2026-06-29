# Internal Process (SOW Management)

**Module:** Internal Process  
**Access:** `process.read` (view) | `process.write` (edit, upload, link resources)

---

## Overview

The Internal Process module is the operational core of EAM. It manages the full lifecycle of Statement of Work (SOW) records — from creation and resource engagement to PIW uploads, engagement dates, and a complete audit trail of every change.

---

## Screens & Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Card grid of all SOWs with summary stats |
| **Process** | Per-SOW detail: fields, PIW upload, resource linking |
| **SOW Detail View** | Full edit form, timeline, engagement dates, audit |

---

## Overview Tab

> **Screenshot:** Internal Process — Overview tab showing SOW cards with stats and resource boxes

### What You See

Each SOW card displays:

| Field | Description |
|-------|-------------|
| SOW Name | Name of the Statement of Work |
| Salesforce ID | CRM reference |
| PROMS ID | Project management office ID |
| Open Air Code | Finance system code |
| Budget | Contracted budget value |
| Start Date | Engagement start date |
| Account Anchor | Responsible account owner |
| Active Status | Green (Active) / Grey (Inactive) badge |
| Resource Count | Number of resources currently linked |

### Step-by-Step: Finding a SOW

1. Navigate to **Internal Process** from the sidebar.
2. The **Overview** tab loads with all active SOW cards.
3. Use the **search bar** at the top to filter cards by SOW name, Salesforce ID, or Open Air code.
4. Scroll through the grid to browse.

### Feature Links & Resource Box (per card)

Each SOW card has two interactive sections:

**Feature Link**
- Click the **Feature Link** button on a card to open a pre-configured external URL (e.g., SharePoint, Confluence) related to that SOW.
- Feature links are configured per SOW in the detail view.

**Manage Resources Box**
- Shows a list of all resources currently linked to the SOW.
- **Search box** — type a resource name or RA ID to filter the linked list.
- **Unlink All** button — removes all resource associations for this SOW in one click.
- **× icon** next to each resource — unlinks that individual resource.

---

## SOW Detail View

> **Screenshot:** SOW Detail View — edit form with fields, tabs, and PDF export button

### Step-by-Step: Opening a SOW Detail

1. On the Overview tab, click on any **SOW card**.
2. The Detail View opens — either as a full page or a right-side panel.

### Step-by-Step: Editing a SOW Record

1. Open the SOW Detail View.
2. Click on any editable field (SOW name, Salesforce ID, budget, start date, etc.).
3. Update the value.
4. Click **Save** at the bottom of the form.
5. All changes are immediately recorded in the Audit Log with your username and timestamp.

### Step-by-Step: Exporting SOW Detail as PDF

1. Open the SOW Detail View.
2. Click the **red PDF icon** (🗎) in the top-right corner.
3. A formatted PDF downloads automatically.
4. The PDF contains: SOW header, all field values, linked resources, timeline, and full audit log.

> 💡 **Tip:** The PDF icon is red (FilePdfOutlined) — consistent with Resource Intelligence export.

---

## Engagement Dates

> **Screenshot:** Engagement Dates section — start/end date fields per resource with timeline chart

Engagement dates track when each resource starts and ends on a SOW.

### Step-by-Step: Setting Engagement Dates

1. Open the SOW Detail View.
2. Scroll to the **Engagement Dates** section (or click the Engagement tab).
3. For each linked resource, click the **Start Date** or **End Date** field.
4. Use the date picker to select a date.
5. Click **Save**.

The engagement dates feed into the **Timeline tab** which displays a Gantt-style chart.

---

## Process Tab — PIW Upload

> **Screenshot:** Process tab — PIW upload area with drag-and-drop zone and parsed resource preview

PIW (Project Initiation Workbook) is an Excel file (.xlsm / .xlsx) that contains resource and milestone data for a SOW.

### Step-by-Step: Uploading a PIW File

1. Go to **Internal Process** and click the **Process** tab.
2. Select the target SOW from the left list (if not already selected).
3. Locate the **PIW Upload** section on the right side.
4. **Drag and drop** your `.xlsm` or `.xlsx` PIW file onto the upload area,  
   — or — click **Browse** to select the file from your computer.
5. The system validates the format and extracts resource data.
6. A **preview table** appears showing parsed resources and columns.
7. Review the preview to confirm the data looks correct.
8. Click **Confirm Upload** to save the PIW data to the selected SOW.

> ⚠️ **Note:** Only one PIW file is allowed per SOW. Uploading a new file **replaces** the existing one. This action is logged in the audit trail.

### PIW File Requirements

| Requirement | Detail |
|-------------|--------|
| Format | `.xlsm` (macro-enabled) or `.xlsx` |
| Content | Resource rows with RA ID, name, role, engagement dates |
| Sheet | Must follow the standard PIW template structure |

---

## Process Tab — Resource Linking

> **Screenshot:** Process tab — Link & Manage Resources box with search and Unlink All

Resources must be linked to a SOW before they appear in engagement dates, reports, and the audit trail.

### Step-by-Step: Linking a Resource to a SOW

1. On the **Process tab**, find the **Link & Manage Resources** box.
2. Click inside the **search box** in the box.
3. Type a resource name, RA ID, or email.
4. A dropdown appears with matching resources from the Resource Hub.
5. Click a resource in the dropdown to link them to the current SOW.
6. The resource immediately appears in the linked list.

### Step-by-Step: Unlinking a Resource

**Single resource:**
1. Find the resource in the Manage Resources box.
2. Click the **× icon** next to their name.
3. Confirm the removal in the dialog.

**All resources at once:**
1. Click the **Unlink All** button at the top of the Manage Resources box.
2. Confirm in the dialog — all resource associations for this SOW are removed.

> ⚠️ **Note:** Unlinking a resource does **not** delete the resource record — it only removes the SOW association. All history is preserved in the audit log.

---

## Insights — Process Progress Analysis

The **Insights** tab now includes a **Process Progress Analysis** section at the end of the page.

### What it shows

- Stage-wise average completion time:
  - Average days from **Date Raised**
  - Average days from **previous stage**
- Monthly trend for a selected stage
- Detailed row-level progression entries (not just summary)

### Filters, Navigation, and Export

1. Use the **global Date Raised From / Date Raised To** range filter at the top of Insights to scope **all** insight cards, charts, and tables.
2. Select a stage from the Process Progress Analysis dropdown to view stage-specific trend changes over time.
3. Click any insight metric/chart row/table row to navigate to **Internal Process → Process (Overview)** with the relevant filters pre-applied.
4. Use the export icon on each insight section to export that section as PNG.

### Last Updated display

- In Process detail view panels, **Last Updated** is shown as:
  - date-only (no time),
  - smaller text,
  - italic and highlighted color for easy scanning.

## Audit Trail

> **Screenshot:** Audit tab — field-by-field change history table with before/after values colour-coded

The audit trail captures every change made to a SOW record, including field edits, resource linking/unlinking, PIW uploads, and engagement date changes.

### Step-by-Step: Viewing the Audit Trail

1. Open any SOW Detail View.
2. Click the **Audit** tab.
3. The audit table loads showing:

| Column | Description |
|--------|-------------|
| Field | The name of the field that changed |
| Before | Previous value (highlighted in red) |
| After | New value (highlighted in green) |
| Changed By | Username of who made the change |
| Timestamp | Date and time of the change |

4. Use the **date range filter** at the top of the table to narrow entries to a specific period.
5. Scroll down to load older entries.

> 💡 **Tip:** The audit log is immutable — no entry can be edited or deleted. It provides a complete, trustworthy history of every change.

---

## Combined Audit View

The **Process Combined Audit** endpoint merges three audit streams into one view:
- SOW field changes
- Resource linking / unlinking events
- Resource engagement date changes

This gives a single timeline of everything that happened on a SOW.

---

> **Previous:** [Finance Management](./03-finance-management.md) | **Next:** [Stakeholders](./05-stakeholders.md)
