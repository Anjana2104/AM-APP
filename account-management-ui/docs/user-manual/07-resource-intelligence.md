# Resource Intelligence

**Module:** Resource Intelligence  
**Access:** `resources.read` (view) | `resources.write` (edit)

---

## Overview

Resource Intelligence provides deep per-resource analytics — engagement history, skills breakdown, field-level audit logs, and a one-click PDF export of the full resource profile. It is the go-to module for understanding individual resource utilisation and history.

---

## Screens

| View | Purpose |
|------|---------|
| **Resource List** | Card or list view of all resources with filters |
| **Individual Resource Detail Panel** | Full profile, links, audit, skills, comments |

---

## Resource List

> **Screenshot:** Resource Intelligence — card/list view with left filter panel and search bar

### Step-by-Step: Navigating to Resource Intelligence

1. Click **Resource Intelligence** (💡) in the left sidebar.
2. Resources are displayed as **cards** by default.
3. Use the **view toggle** (top right) to switch between card view and list view.

### Search

1. Use the **search bar** at the top to search by:
   - Employee name
   - RA ID
   - Email address
2. Results filter as you type.

### Filter Panel (Left Sidebar)

Click any filter to narrow the resource list:

| Filter | Options |
|--------|---------|
| Engagement Status | Deployed, Available, On Bench, Removed, etc. |
| Role / Domain | Functional role groups |
| PIW Role | Role as per PIW assignment |
| Skill Type | Primary, Secondary, Certification |
| Account Anchor | Associated account owner |

> 💡 **Tip:** Multiple filters can be active at once. Click **Clear Filters** to reset all.

### Refresh Button

- Click the **🔄 Refresh** icon (top right, beside the PDF export icon) to reload the latest resource data from the server.
- Useful after another user has made updates.

---

## Individual Resource Detail Panel

> **Screenshot:** Resource Intelligence — right-side detail panel open with resource profile

### Step-by-Step: Opening a Resource Profile

1. Click on any resource **card** or **list row**.
2. A right-side detail panel slides open.
3. The panel displays the full resource profile.

---

### Panel Sections

#### Header

| Item | Description |
|------|-------------|
| Name | Employee full name (large heading) |
| RA ID | Rockwell Automation employee ID |
| Email | Corporate email address |
| Status Badge | Colour-coded engagement status (green = deployed, grey = bench, etc.) |

---

#### Beeline ID — Clickable Link

- The **Beeline ID** is displayed as a clickable blue link directly below the header.
- Clicking it opens the matching **Client Request** in the Client Requests module.
- If no Beeline ID is linked, the field shows as blank or "—".

---

#### Linked Process / SOW — Clickable Link

- Displayed **below the Beeline ID**, also as a clickable link.
- Clicking it navigates to **Internal Process → Overview tab** with the linked SOW pre-selected and filters applied.
- This allows quick cross-module navigation directly from a resource profile.

---

#### Skills

| Section | Contents |
|---------|---------|
| Primary Skills | Core technical or functional skills |
| Secondary Skills | Supporting skills |
| Certifications | Professional certifications held |

---

#### Current Engagement

| Field | Description |
|-------|-------------|
| Current SOW | SOW the resource is currently assigned to |
| Engagement Start | Start date of current engagement |
| Engagement End | Expected end date |
| PIW Role | Role within the current SOW |

---

#### Audit Log

> **Screenshot:** Audit Log section — table with Field, Before (red), After (green), Changed By, Timestamp

The audit log inside the resource panel shows every field-level change made to that resource's record.

| Column | Description |
|--------|-------------|
| Field | Name of the field that changed |
| Before | Previous value — shown with red highlight |
| After | New value — shown with green highlight |
| Changed By | Username who made the change |
| Timestamp | Date and time of change |

> 💡 **Tip:** The audit log loads fresh every time you open a resource panel — always reflects the latest data.

---

#### Recent Log Entries (Comments)

- Shows the most recent comments and notes added to this resource.
- Includes author name and timestamp for each entry.
- To add a new comment, use the Resource Hub drawer (this panel is view-only for comments).

---

## PDF Export

> **Screenshot:** Resource Intelligence — red FilePdf icon beside the Refresh button (top right)

The PDF export generates a complete, formatted profile document for the selected resource — suitable for sharing with stakeholders or archiving.

### Step-by-Step: Exporting a Resource Profile as PDF

1. Open the resource detail panel for the desired resource.
2. Locate the **red PDF icon** (🗎) in the **top-right corner**, directly beside the Refresh (🔄) button.
3. Hover over the icon — a tooltip reading **"Export PDF"** appears.
4. Click the icon.
5. The PDF is generated programmatically (no print dialog appears).
6. The file downloads automatically — named after the resource  
   (e.g., `John_Doe_profile.pdf`).

### What the PDF Contains

| Section | Included |
|---------|---------|
| Basic Info (name, RA ID, email, status) | ✅ Yes |
| Current Engagement (SOW, dates, PIW role) | ✅ Yes |
| Skills (primary, secondary, certifications) | ✅ Yes |
| Audit Log (full field-change history) | ✅ Yes |
| Insights Summary charts | ❌ No — excluded by design |

> ⚠️ **Note:** Ensure your browser allows automatic downloads from this site. If the download does not start, check your browser's download permissions.

---

## Comparison with Resource Hub

| Feature | Resource Hub | Resource Intelligence |
|---------|-------------|----------------------|
| Master resource list | ✅ | ✅ |
| Bulk Excel import | ✅ | ❌ |
| Edit resource fields | ✅ | ❌ (view only) |
| Add comments | ✅ | ❌ |
| Filter panel | Basic | Advanced (5 filter types) |
| Audit log in panel | ❌ | ✅ |
| Beeline ID link | ✅ | ✅ |
| SOW link | ✅ | ✅ |
| PDF export | ❌ | ✅ |
| Per-resource analytics | ❌ | ✅ |

---

> **Previous:** [Resource Hub](./06-resource-hub.md) | **Next:** [Configuration](./08-configuration.md)
