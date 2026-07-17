# Resource Hub

**Module:** Resource Hub  
**Access:** `resources.read` (view) | `resources.write` (edit, import)

---

## Overview

The Resource Hub is the master repository for all Rockwell Automation resources (employees). It supports bulk import from Excel, manual record editing, detailed per-resource drawers, tracks which resources are currently active or have been removed from engagements, and now supports multiple project allocations per resource with a combined utilization of up to 200%.

Resources are only treated as **Joined** when they are explicitly moved to that status in Engagement Mapping. Adding or importing a partial/non-bench allocation does not auto-join the resource.

---

## Screens

| View | Purpose |
|------|---------|
| **Resource List** | Full table of all resources with search and filters |
| **Resource Detail Drawer** | Right-side panel with full resource profile and comments |
| **Verification** | Validates recorded workex vs DOJ-derived computed workex and fixed experience-bucket ranges |
| **Removed Resources** | View of disengaged/offboarded resources |

---

## Resource List

> **Screenshot:** Resource Hub â€” main table with search bar, status filter, and resource rows

### Table Columns

| Column | Description |
|--------|-------------|
| RA ID | Rockwell Automation employee identifier (unique) |
| Name | Employee full name |
| Email | Corporate email address |
| PIW Role | Role assigned in the PIW file |
| Role / Domain | Functional role or technology domain â€” **now supports multiple values**. Each resource can have multiple roles/domains (e.g., "Backend, DevOps, Cloud") separated by commas. During bulk import, new domains are **appended** to existing ones instead of replacing them. |
| Skills | Primary and secondary skills (comma-separated) |
| Engagement | Legacy compatibility summary field (derived from project allocations) |
| Project Allocations | All project assignments with individual allocation %, start date, and end date |
| Date of Joining | Employee start date |
| Work Experience | Total experience in years |
| Linked SOW | SOW the resource is currently assigned to |

### Step-by-Step: Finding a Resource

1. Navigate to **Resource Hub** from the sidebar.
2. The full resource list loads by default.
3. Use the **search bar** at the top to search by name, RA ID, or email.
4. Use the **Engagement Status** filter dropdown to show only resources with a specific status (e.g., Available, Shortlisted, Offered, Selected, Joined).
5. Results update instantly as you type or select.

---

## Bulk Import (Excel Upload)

> **Screenshot:** Upload dialog â€” file picker with preview table showing parsed resource rows

Bulk import allows you to load or update hundreds of resources at once from an Excel file.

### Step-by-Step: Importing Resources

1. Click the **Upload / Import** button in the top-right of the Resource Hub.
2. In the file picker dialog, select your `.xlsx` resource file.
3. The system parses the file and shows a **preview table** with the extracted rows.
4. Review the preview â€” verify that names, RA IDs, and fields look correct.
5. Click **Confirm Import**.
6. The system **upserts** records by RA ID:
   - If the RA ID already exists â†’ the record is **updated**.
   - If the RA ID is new â†’ a **new record is inserted**.
   - If the same RA ID appears in multiple rows in the same upload, those rows are merged into one resource so multiple project allocations can be loaded together.
   - If an upload provides engagement/allocation values without an explicit allocation status, the resource remains **Available** until the status is explicitly advanced in Engagement Mapping.
7. A summary dialog shows the count of inserted and updated records.

### Import File Format

| Column | Required | Notes |
|--------|----------|-------|
| RA ID | âœ… Yes | Must be unique per employee |
| Name | âœ… Yes | Full name |
| Email | No | Corporate email |
| PIW Role | No | Role as per PIW file |
| Role / Domain | No | **Comma-separated roles/domains** (e.g., "Backend, DevOps"). On re-import, new domains are appended to existing ones â€” not replaced. |
| Skills | No | Comma-separated skill list |
| Engagement | No | Primary/current engagement summary |
| Allocation % | No | Per-row project allocation percentage. Allowed range: **0 to 200** |
| Date of Joining | No | YYYY-MM-DD format |

> âš ï¸ **Note:** Rows with a blank RA ID are skipped.
>
> ðŸ“Œ **Template example update:** The downloaded Resource template now includes:
> - a multi-Roles/Domains sample value (for example, `Full Stack, DevOps`)
> - a multi-project allocation example for the same RA ID across two rows (for example, `Project Alpha 60%` and `Project Beta 50%`)
> - combined utilization support up to **200%**

---

## Resource Detail Drawer

> **Screenshot:** Resource Detail Drawer â€” profile fields, Beeline ID link, SOW link, comments section

### Step-by-Step: Opening a Resource Detail

1. Click on any resource row in the table.
2. A **right-side drawer** opens with the full resource profile.

### What the Drawer Contains

| Section | Contents |
|---------|---------|
| Header | Name, RA ID, email, current engagement status badge |
| Basic Info | PIW Role, Roles/Domains, Date of Joining, Work Experience |
| Project Allocations | All active project allocations with individual percentages and combined total utilization |
| Skills | Primary skills, secondary skills, certifications |
| Beeline ID | Displayed as a **clickable link** |
| Linked Process (SOW) | Displayed as a **clickable link** below Beeline ID |
| Comments | Timestamped comment history with author |
| Add Comment | Text input to add a new comment |

### Beeline ID â€” Clickable Link

- Click the **Beeline ID** value to open the matching Client Request in the Client Requests module.
- If no Beeline ID is linked, the field is shown as empty.

### Linked Process / SOW â€” Clickable Link

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

## Verification Tab

The Verification tab helps validate resource experience consistency using current date logic and fixed experience buckets.

### Columns

- RA ID
- Resource Name
- Total Experience
- Prior Ex
- DOJ
- Exp Range (from Total Experience bucket)
- Calculated Total Workex (Yr) = Prior Ex + (DOJ to today)
- Calc Exp Range (from Calculated Total Workex bucket)

### Key behavior

- Calculated Total Workex is dynamically computed up to **today's date**.
- Workex values are shown up to **2 decimal places without rounding**.
- Experience buckets are computed directly as: **0-3 Yrs**, **3-5 Yrs**, **5-8 Yrs**, **8-10 Yrs**, **10+ Yrs**.
- Rows are highlighted when:
  - Total Experience and Calculated Total Workex do not match, or
  - Exp Range and Calc Exp Range do not match.

---

## Removed Resources

> **Screenshot:** Removed Resources view â€” greyed-out resource cards or rows indicating disengagement

Removed resources are those who have been disengaged from all active SOWs (offboarded, resigned, or contract ended).

### Viewing Removed Resources

1. In Resource Hub, look for the **Removed / Disengaged** toggle or tab.
2. Toggle to **Removed** to see only disengaged resources.
3. Their engagement status will indicate disengagement (e.g., "Removed", "Offboarded").

> âš ï¸ **Note:** Removed resources are **not deleted** from the system. Their full history, comments, and audit log are preserved. They can be re-activated if they re-join.

---

> **Previous:** [Client Requests](./05-client-requests.md) | **Next:** [Resource Intelligence](./07-resource-intelligence.md)


> ✅ Duplicate engagement handling: when the same engagement name appears multiple times for a resource, the system matches it case-insensitively and ignores spaces, then updates the existing allocation entry instead of creating a duplicate.

