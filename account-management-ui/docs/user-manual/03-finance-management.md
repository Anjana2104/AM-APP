# Finance Management

**Module:** Finance Management  
**Access:** `finance.read` (view) | `finance.write` (edit)

---

## Overview

The Finance Management module is the default landing page after login. It tracks monthly revenue and invoice milestones for all Rockwell project codes, and provides both a summary card view and detailed project-level drill-down.

---

## Screens & Tabs

| Tab | Purpose |
|-----|---------|
| **Finance Summary** | Card-based view of all projects with monthly revenue |
| **Invoice Management** | Invoice records per project, milestone types |

---

## Finance Summary Tab

> **Screenshot:** Finance Summary tab — project revenue cards with PDF export button (top right)

### What You See

- A grid of **project cards**, one per active project.
- Each card shows:
  - Project name and code
  - Monthly booked and recognised revenue figures
  - Year-to-date (YTD) total
  - Active/Inactive status badge

### Step-by-Step: Viewing Finance Summary

1. Click **Finance Management** in the left sidebar.
2. The **Finance Summary** tab is selected by default.
3. Scroll through the cards to see all projects.
4. Use the **search/filter bar** at the top to narrow by project name or code.

### Step-by-Step: Exporting Finance Summary as PDF

1. Navigate to the Finance Summary tab.
2. Click the **PDF icon** (🗎) in the top-right corner of the page.
3. A formatted PDF report downloads automatically to your browser's default download folder.
4. The PDF includes all visible project cards and their revenue figures.

> 💡 **Tip:** The PDF export icon is consistent across the app — red colour, Ant Design icon style, hover shows "Export PDF" tooltip.

---

## Project Detail View

> **Screenshot:** Project Detail side panel — monthly revenue breakdown by row

### Step-by-Step: Viewing a Project's Revenue Detail

1. Click on any **project card** in the Finance Summary tab.
2. A right-side detail panel opens.
3. The panel shows a month-by-month revenue breakdown table.
4. Columns: Month, Booked Amount, Recognised Amount, Milestone Type.

### Step-by-Step: Editing Revenue Data

1. Open the project detail panel.
2. Click on a revenue cell to make it editable (inline edit).
3. Type the updated amount.
4. Press **Enter** or click away to confirm the value.
5. Click **Save** to persist all pending edits.

> ⚠️ **Note:** Edits require `finance.write` permission. If the cells are not clickable, contact your admin.

---

## Invoice Management Tab

> **Screenshot:** Invoice Management tab — table with project, month, amount, milestone type columns

### What You See

- A table of all invoice records.
- Columns: Project Code, Month, Amount, Milestone Type (booked / recognised / milestone).

### Step-by-Step: Filtering Invoices

1. Click the **Invoice Management** tab.
2. Use the **Project** dropdown filter to select a specific project.
3. Use the **Month** filter to narrow to a date range.
4. The table updates instantly — no need to click a Search button.
5. Click **Reset Filters** to clear all filters.

### Step-by-Step: Importing Invoice Data (Excel Upload)

1. Click the **Upload** button (top right of the Invoice tab).
2. In the file picker, select your `.xlsx` invoice file.
3. The file must follow the prescribed template format (see below).
4. A preview of parsed rows appears.
5. Click **Confirm** to save all records.
6. A summary shows how many records were inserted or updated.

### Downloading the Invoice Template

1. Click the **Template** button next to Upload.
2. An Excel template file downloads immediately.
3. Fill it in with your invoice data and re-upload.

> ⚠️ **Note:** The template column order must not be changed — the parser relies on column positions.

---

## Project Code Reference

For a searchable list of all Open Air project codes, see the [Code Guide](./11-code-guide.md) module.

---

> **Previous:** [Navigation](./02-navigation.md) | **Next:** [Internal Process](./04-internal-process.md)
