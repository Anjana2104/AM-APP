# Client Requests

**Module:** Client Requests  
**Access:** `requests.read` (view) | `requests.write` (edit)

---

## Overview

The Client Requests module tracks all Beeline staffing requests raised by clients. It shows the full lifecycle of each request — from initial raising through processing to resolution — along with analytical insights and direct links to linked SOWs and resources.

---

## Screens & Tabs

| Tab | Purpose |
|-----|---------|
| **Requests** | Main table of all Beeline requests with filters |
| **Insights** | Charts and metrics summarising request data |

---

## Requests Tab — Main List

> **Screenshot:** Client Requests — main table with filter bar, status chips, and request rows

### What You See

The main table lists all client requests with the following columns:

| Column | Description |
|--------|-------------|
| Beeline ID | Unique client staffing system identifier |
| Description | Brief description of the request |
| Raised By | Person or team who raised the request |
| Processing Status | Current status in the processing pipeline |
| Overall Status | High-level status (Open, Closed, etc.) |
| Account Anchor | Responsible account owner |
| Date Raised | Date the request was created |
| Request Type | Category of request |

---

## Filters

> **Screenshot:** Filter bar — Processing Status, Overall Status, Account Anchor, Date Range dropdowns

### Available Filters

| Filter | Description |
|--------|-------------|
| Processing Status | Filter by current pipeline stage (e.g., In Review, Approved, Rejected) |
| Overall Status | Filter by high-level status |
| Account Anchor | Filter by responsible owner |
| Request Type | Filter by category |
| Date Range | Filter by Date Raised (from / to date picker) |

> ⚠️ **Note:** Filters for Resource Name and Description have been removed for a cleaner experience. Use the **table search bar** for text-based lookup across all columns.

### Step-by-Step: Applying Filters

1. Navigate to **Client Requests** from the sidebar.
2. The filter bar is displayed above the table.
3. Click any filter dropdown and select a value.
4. The table updates instantly — no need to click Search.
5. Multiple filters can be active simultaneously.
6. Click **Reset Filters** to clear all active filters at once.

> 💡 **Tip:** The Processing Status filter lists only statuses that exist in your data — it won't show empty options.

---

## Active / Inactive Toggle

1. Use the **Active / All** toggle switch at the top of the list.
2. **Active** — shows only requests with `is_active = true` (linked to active Beeline IDs).
3. **All** — shows every request including inactive/closed ones.

---

## Request Detail Panel

> **Screenshot:** Request Detail Panel — right-side drawer with all fields, Beeline ID link, SOW name link

### Step-by-Step: Opening a Request Detail

1. Click on any row in the requests table.
2. A **right-side detail panel (drawer)** opens without leaving the list.
3. The panel shows all fields for that request.

### Beeline ID — Clickable Link

- The **Beeline ID** at the top of the panel is displayed as a **clickable link**.
- Clicking it opens the corresponding external Beeline system record (or the internal detail view if configured).

### SOW Name — Clickable Link

- The **SOW Name** field in the detail panel is displayed as a **clickable link**.
- Clicking it:
  1. Navigates to the **Internal Process** → **Overview tab**.
  2. Automatically applies a filter to highlight the linked SOW.
  3. Closes the filter panel for a clean view.

### Step-by-Step: Editing a Request

1. Open the detail panel for a request.
2. Click on any editable field (Processing Status, Account Anchor, etc.).
3. Update the value.
4. Click **Save** to persist changes.
5. All edits are recorded in the audit log.

### Linked Resources

- The detail panel shows which resources are associated with this Beeline request.
- Resources with a matching `beeline_id` field in the Resource Hub are listed here automatically.

---

## Insights Tab

> **Screenshot:** Client Requests Insights tab — bar charts, pie charts, and summary metric cards

### What You See

The Insights tab provides analytical summaries of all client request data:

| Section | Description |
|---------|-------------|
| Request Volume by Status | Bar chart — count of requests per Processing Status |
| Trend Over Time | Line chart — request volume by month |
| Account Anchor Breakdown | Pie/donut chart — distribution by account owner |
| Request Type Distribution | Breakdown by request category |
| Summary Metrics | Total requests, open count, approval rate |

### Step-by-Step: Viewing Insights

1. Click the **Insights** tab at the top of the Client Requests page.
2. Charts render automatically using live data from the requests table.
3. Hover over chart elements to see exact values in tooltips.

### Step-by-Step: Exporting Insights as PDF

1. On the Insights tab, locate the **PDF icon** (🗎) in the top-right corner.
2. The button shows **icon only** — hover to see the "Export PDF" tooltip.
3. Click the icon.
4. A formatted PDF of the Insights view downloads automatically.

> 💡 **Tip:** The Insights PDF captures all visible charts and metric cards at the time of export.

---

> **Previous:** [Internal Process](./04-internal-process.md) | **Next:** [Resource Hub](./06-resource-hub.md)
