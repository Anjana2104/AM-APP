# Finance Management (SOW)

**Module:** Finance Management  
**Access:** `executive_revenue` (read/write by permission)

---

## Overview

Finance Management manages SOW project milestones, booking operations, and insights.

---

## Screens & Tabs

| Tab | Purpose |
|-----|---------|
| **Project Milestones** | Maintain SOW projects, monthly milestones, booking operations, uploads, and saves |
| **Insights** | Project Insights + Booking Insights with drilldown and exports |

---

## Project Milestones Tab

### Key actions

- Add / edit / delete projects
- Upload SOW milestone template
- Download template
- Save staged changes explicitly
- Manage per-project and bulk bookings
- Track booked vs anticipated milestone type

### Important behavior

- Delete and other mutable actions are staged where required and persisted on explicit save flows.
- Duplicate code checks are enforced during upload/edit.
- Booking operations are audited.

---

## Insights Tab

The Insights tab has two sub-tabs:

1. **Project Insights**
2. **Booking Insights**

### Common filters

- Company
- FY
- Currency toggle (INR / USD)

---

## Project Insights

Shows:

- Annual revenue summary
- Quarterly project distribution cards
- Monthly breakdown trend
- Year-over-year comparison

Export:

- Insight panel PNG export icon (top filter row)

---

## Booking Insights

Shows compact KPI tiles (single row):

- Total Booking Amount
- Fixed
- Anticipated
- Projects Covered
- Unbooked (dynamic by booking filter)

### Booking filters

- Bookings: **All / Fixed / Anticipated**
- Booked At month

### Trend sections

- **Booked-at Month Trend** (click row for drilldown)
- **Quarterly Booking Trend** (click row for drilldown)

### Unbooked logic

- Unbooked tile value follows the selected booking filter:
  - Fixed → fixed unbooked
  - Anticipated → anticipated unbooked
  - All → combined unbooked
- Drilldown shows project + milestone level unbooked details.

### Drilldown and exports

- Clicking KPI tiles/trend rows opens detail drawers.
- Drawer headers include icon-only Excel export.
- Trend cards include icon-only Excel export for overall trend details.

---

## Notes

- Booking type is supported as **fixed** and **anticipated**.
- Insights are designed for quick drilldown from summary to record-level details.

---

> **Previous:** [Navigation](./02-navigation.md) | **Next:** [Internal Process](./04-internal-process.md)
