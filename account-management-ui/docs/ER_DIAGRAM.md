# ER Diagram

Text-based entity-relationship diagram for the Account Management (EAM) application.

---

## Core Domain Entities

```
┌─────────────────────┐       ┌─────────────────────┐
│      ra_process      │       │      resources       │
│─────────────────────│       │─────────────────────│
│ PK  id              │◄──────│ FK  process_id       │
│     process_id (P1) │  0..N │     ra_id (UNIQUE)   │
│     sow (UNIQUE)    │       │     emp_name         │
│     piw (UNIQUE)    │       │     piw_role         │
│     start_date      │       │     allocation_status│
│     salesforce_id   │       │     beeline_id       │
│     proms_id        │       │     engagement_start │
│     budget          │       │     engagement_end   │
│     eprev           │       │     skills           │
│     account_anchor  │       │     doj              │
└─────────────────────┘       └──────────┬──────────┘
                                         │
                    ┌────────────────────┤
                    │                    │
                    ▼                    ▼
    ┌───────────────────┐   ┌───────────────────┐
    │  resource_insights│   │ resource_comments │
    │───────────────────│   │───────────────────│
    │ PK  id            │   │ PK  id            │
    │ FK  resource_id   │   │ FK  resource_id   │
    │     section       │   │     author        │
    │     title / body  │   │     tag / body    │
    │     status        │   │     created_at    │
    │     priority      │   └───────────────────┘
    │     author        │
    └───────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│   client_requests   │       │  request_comments   │
│─────────────────────│       │─────────────────────│
│ PK  id              │◄──────│ FK  request_id       │
│     beeline_id      │  0..N │     author           │
│     description     │       │     tag / body       │
│     processing_stts │       │     created_at       │
│     overall_status  │       └─────────────────────┘
│     account_anchor  │
│     is_active       │
└─────────────────────┘
```

---

## Finance Domain

```
┌─────────────────────┐       ┌─────────────────────┐
│  finance_projects   │       │   finance_revenue   │
│─────────────────────│       │─────────────────────│
│ PK  id              │◄──────│ FK  project_id       │
│     code (UNIQUE)   │  0..N │     month (YYYY-MM)  │
│     project         │       │     amount           │
│     company         │       │     milestone_type   │
│     status          │       └─────────────────────┘
└─────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│  invoice_projects   │       │  invoice_amounts    │
│─────────────────────│       │─────────────────────│
│ PK  id              │◄──────│ FK  project_id       │
│     code (UNIQUE)   │  0..N │     month (YYYY-MM)  │
│     project         │       │     amount           │
│     company         │       └─────────────────────┘
│     status          │
└─────────────────────┘
```

---

## User & Access Control Domain

```
┌──────────────┐          ┌──────────────────┐
│    roles     │          │      users       │
│──────────────│          │──────────────────│
│ PK  id       │◄─────────│ FK  role_id      │
│     name     │   N..1   │     username     │
│  permissions │          │  password_hash   │
│  (JSON blob) │          │  display_name    │
└──────────────┘          │     active       │
                          └────────┬─────────┘
                                   │
                    ┌──────────────┤
                    │              │
                    ▼              ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ user_preferences │  │user_group_members│
    │──────────────────│  │──────────────────│
    │ FK  user_id (1:1)│  │ FK  user_id      │
    │  preferences JSON│  │ FK  group_id     │
    └──────────────────┘  └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │   user_groups    │
                          │──────────────────│
                          │ PK  id           │
                          │     name         │
                          └──────────────────┘
```

---

## Notifications Domain

```
┌──────────────────────┐       ┌──────────────────────┐
│ notification_triggers│       │    notifications     │
│──────────────────────│       │──────────────────────│
│ PK  id               │◄──────│ FK  trigger_id       │
│     source_table     │  0..N │     title / message  │
│     trigger_field    │       │  target_user_id      │
│     message_template │       │  target_group_id     │
│     notify_target    │       │     read_by (JSON)   │
│     (field_value |   │       └──────────────────────┘
│      group |         │
│      broadcast)      │
│     is_active        │
└──────────────────────┘
```

---

## Configuration Domain

```
┌─────────────────────┐       ┌─────────────────────┐
│  app_config_types   │       │  app_config_items   │
│─────────────────────│       │─────────────────────│
│ PK  type_id         │◄──────│ FK  type_id          │
│     name            │  0..N │     item_value       │
│     built_in        │       │     label            │
│     linked_to (JSON)│       │     color            │
└─────────────────────┘       └─────────────────────┘

┌─────────────────────┐
│    app_values       │
│─────────────────────│  Generic key-value store
│ PK  key             │  for application settings
│     value           │  (e.g. fiscal year start)
└─────────────────────┘
```

---

## Audit Trail

```
                ┌────────────────────┐
                │     audit_log      │
                │────────────────────│
     writes to  │  module (table)    │  ← 'ra_process', 'resources',
◄───────────────│  record_id         │     'client_requests', etc.
  any operation │  field             │
                │  old_value         │
                │  new_value         │
                │  changed_by        │
                │  changed_at        │
                └────────────────────┘
```

---

## Logical Links (no DB foreign key constraint)

| From | Field | To | Notes |
|------|-------|----|-------|
| `resources` | `beeline_id` | `client_requests.beeline_id` | Logical link; no FK |
| `resources` | `process_id` | `ra_process.id` | Has FK in practice |
| `notifications` | `target_user_id` | `users.id` | Logical |
| `notifications` | `target_group_id` | `user_groups.id` | Logical |
