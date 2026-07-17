# Navigation

**Module:** Application Layout & Navigation  
**Access:** All users

---

## Overview

The EAM application has a consistent layout across all modules. Understanding the layout helps you navigate quickly between features.

---

## Application Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: EAM Application Title          User: John Doe  [Logout] │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                        │
│ SIDEBAR  │                  MAIN CONTENT AREA                    │
│          │                                                        │
│  📊 Finance          Active module renders here.                 │
│  🔄 Process          Tabs, tables, panels, charts.               │
│  👥 Stakeholders                                                  │
│  📋 Requests                                                      │
│  👥 Resource Hub                                                  │
│  💡 Intelligence                                                  │
│  ⚙️  Config                                                       │
│  👤 Users                                                         │
│          │                                                        │
└──────────┴───────────────────────────────────────────────────────┘
```

> **Screenshot:** Full application layout showing sidebar, header, and main content area

---

## Sidebar Navigation

The left sidebar lists all available modules. Click any icon or label to switch to that module. The **active module is highlighted in blue**.

### Main Navigation

| Icon | Module | Description |
|------|--------|-------------|
| 🏠 | Account Summary | High-level account dashboard |
| 📊 | Finance Management | SOW project milestones, booking operations, and insights |
| 🔄 | Internal Process | SOW and resource management |
| 👥 | Stakeholders | Stakeholder relationship network and profile views |
| 📋 | Requests | Beeline staffing requests |
| 👥 | Resource Hub | Master resource list |
| 💡 | Resource Intelligence | Per-resource analytics |
| 🗺️ | Engagement Mapping | Resource engagement timeline, Forecasting |

### Settings & Configuration (popover menu)

Clicking the ⚙️ gear icon in the sidebar opens a popover with:

| Item | Description |
|------|-------------|
| **User Access Control** | Users, roles, permissions, user groups |
| **App Settings** | App Notifications, Templates, Configs, App Values, and Manage Data controls |
| **User Settings** | Column visibility preferences, notification snooze rules |
| **Information** | Client rate card and client process |

> **Note:** Items you do not have permission to access are hidden from the sidebar automatically.

---

## Header Bar

The top header contains:

- **Application title** — EAM on the left
- **Current user name** — displayed on the right
- **Logout button** — click to end your session and return to the login screen

---

## Main Content Area

- Each module renders its own tabs, tables, and controls in this area.
- Tabs within a module (e.g., Overview, Process, Insights with date-range analytics filters) are shown at the top of the content area.
- A **right-side drawer/panel** opens when you click on a record row — it shows details without leaving the list view.

---

## Browser Back / Forward

The EAM application fully supports browser history navigation.

| Action | Result |
|--------|--------|
| **Browser Back** (`Alt + ←`) | Returns to the previous page, restoring filters, selected tab, and open panels |
| **Browser Forward** (`Alt + →`) | Moves forward in navigation history |

> 💡 **Tip:** This works across all modules. If you drill into a SOW detail and press Back, you return to the SOW list with the same scroll position and filters.

---

## Responsive Behaviour

- The sidebar collapses to icons-only on smaller screens (< 1280px width).
- Hover over an icon to see the module label as a tooltip.
- All tables support horizontal scrolling on smaller viewports.

---

> **Next:** [Finance Management](./03-finance-management.md)
