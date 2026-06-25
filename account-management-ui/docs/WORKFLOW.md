# Workflows

Key end-to-end workflows in the EAM application.

---

## 1. Resource Onboarding

```
User uploads Excel (Resources tab)
        │
        ▼
POST /api/resources/bulk-upload
        │
        ├── Parse rows from Excel
        ├── INSERT/UPDATE resources (upsert by ra_id)
        └── Write audit_log entries (field: "Bulk Upload")
        │
        ▼
Resource appears in Resource Hub list
        │
        ▼
(Optional) Link to a SOW/Process
  PUT /api/resources/:id/link-process
        │
        ├── UPDATE resources SET process_id = ?
        ├── Write audit_log (module=resources, field="Process Link")
        └── Write audit_log (module=ra_process, field="Resource Linked")
        │
        ▼
(Optional) Set engagement dates
  PUT /api/resources/batch
        │
        ├── UPDATE resources SET engagement_start_date, engagement_end_date
        └── Write audit_log per changed field
```

---

## 2. PIW Upload → Resource Date Sync

```
User selects a process → clicks "Upload PIW"
        │
        ▼
Upload wizard (InternalProcess.tsx)
  Step 1: Upload .xlsm file
        │
        ▼
POST /api/piwGeneration/upload
        │
        ├── Parse Excel: read PIW filename, RAID tab, Resource Summary section 1
        ├── Extract: start_date, end_date from Resource Summary section 1
        ├── UPDATE ra_process SET piw = filename
        ├── Write audit_log (field: "PIW Uploaded")
        │
        └── For each resource found in RAID tab:
              ├── Match by ra_id
              ├── UPDATE resources SET engagement_start_date, engagement_end_date
              └── Write audit_log (field: "Engagement Start/End Date")
        │
        ▼
Process overview reflects updated PIW + resource dates
```

---

## 3. PIW Generation

```
User clicks "Generate PIW" on a process
        │
        ▼
Generation wizard (3 steps):

Step 1 — Configuration
  ├── Select PIW template (from templates table)
  ├── Select holiday calendar template
  ├── Set billing period (start/end months)
  └── Configure resource list

Step 2 — Preview
  ├── POST /api/piwGeneration/generate
  │     ├── Load .xlsm template from DB (templates table)
  │     ├── Populate sheets: Resource Summary, RAID, Calculation
  │     ├── Inject holidays from calendar template
  │     └── Return generated file as base64
  └── Display preview of filled data

Step 3 — Download
  └── User downloads the generated .xlsm file
```

---

## 4. SOW Generation

```
User clicks "Generate SOW" on a process
        │
        ▼
POST /api/sowGeneration/generate
        │
        ├── Load SOW Word template from templates table
        ├── Replace placeholders: {{sow_name}}, {{start_date}},
        │   {{resources}}, {{budget}}, etc.
        └── Return filled .docx as download
        │
        ▼
User downloads SOW document
```

---

## 5. Audit Trail Flow

```
Any data mutation (edit, link, upload)
        │
        ▼
Frontend calls POST /api/audit with:
  { module, record_id, record_name, field, old_value, new_value, changed_by }
        │
        ▼
Server inserts into audit_log
        │
        ▼
Audit log visible in:
  ├── ProcessDetailView → "Audit Logs" tab
  │     Uses GET /api/audit/process-combined/:id
  │     (merges: field changes + resource link events + engagement date changes)
  │
  ├── ResourceDetailPanel → "Audit Log" modal
  │     Uses GET /api/audit/resources/:id
  │
  └── Resource Intelligence side panel
        Uses GET /api/audit/resources/:id
```

---

## 6. Notification Trigger Flow

```
User edits a field (e.g. processing_status on a client request)
        │
        ▼
PUT /api/requests/:id
        │
        ├── UPDATE client_requests
        └── Call evaluateTriggers(db, 'client_requests', recordId, changedFields)
              │
              ▼
        Query notification_triggers WHERE
          source_table = 'client_requests' AND
          trigger_field IN (changedFields) AND
          is_active = 1
              │
              ▼
        For each matching trigger:
          ├── notify_target_type = 'field_value'  → notify the user whose ID is the new field value
          ├── notify_target_type = 'group'        → notify all members of the named user group
          └── notify_target_type = 'broadcast'    → notify all active users
              │
              ▼
        INSERT into notifications
              │
              ▼
        Notification bell in UI updates (polling every 30s)
```

### Persona-Filtered Snooze (User Settings)

```
User opens User Settings → Notification Snooze tab
        │
        ▼
GET /api/notification-triggers/relevant?userId=X
        │
        ├── Fetch user's group membership (user_group_members)
        ├── Fetch user's role permissions (roles)
        └── Filter active triggers to only those the user can receive:
              ├── broadcast  → always included
              ├── group      → only if user is a member of that group
              └── field_value→ only if user has view permission on the mapped page
        │
        ▼
Only relevant triggers shown in snooze dropdown
```

---

## 7. Browser Navigation (Back/Forward)

```
User clicks a sidebar page link
        │
        ▼
navigateTo(module, page) in App.tsx
        │
        ├── window.history.pushState({ module, page }, '', '#page')
        └── setState: activePage, activeModule
        │
        ▼
Browser back button pressed
        │
        ▼
'popstate' event fires
        │
        └── Restore: activePage = event.state.page
                     activeModule = event.state.module
```

---

## 8. SOW → Resource Navigation

```
Resource has sowName linked (from ra_process via process_id)
        │
        ▼
User clicks "Linked SOW" tag in:
  ├── ResourceDetailPanel (Resource Hub drawer)
  └── Resource Intelligence side panel
        │
        ▼
onNavigateToProcess(sowName) callback fires
        │
        ▼
App.tsx sets initialProcessSow = sowName
  + navigateTo('information', 'information_process')
        │
        ▼
InternalProcess renders with initialSow prop
        │
        ├── filters.sow pre-filled
        ├── ProcessTab shows filtered process list
        └── Detail panel auto-opens for matching SOW
```

---

## 9. User Login & Permission Check

```
User submits login form
        │
        ▼
POST /api/auth/login
  { username, password }
        │
        ├── Hash password (SHA-256 + salt)
        ├── SELECT user WHERE username = ? AND password_hash = ?
        ├── JOIN roles to get permissions JSON
        └── Return: { user, role, permissions }
        │
        ▼
AuthContext stores user + permissions
        │
        ▼
Each page rendered in App.tsx checks:
  permissions[page_id]?.view === true
        │
        ├── true  → render page
        └── false → render "Access Denied" message

Edit/Delete buttons check:
  permissions[page_id]?.edit / .delete
```
