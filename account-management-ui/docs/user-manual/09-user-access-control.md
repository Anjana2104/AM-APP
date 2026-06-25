# User Access Control

**Module:** User Access Control  
**Access:** `users.admin` — Administrators only

---

## Overview

User Access Control (UAC) allows administrators to manage who can log into the EAM application and what they can do. It covers three areas: Users, Roles, and Permissions.

---

## Screens & Tabs

| Tab | Purpose |
|-----|---------|
| **Users** | Create, edit, activate/deactivate, and delete user accounts |
| **Roles & Permissions** | Define roles and assign page-level permissions |
| **User Groups** | Create groups of users for notification targeting |

---

## Users Tab

> **Screenshot:** User Access Control — Users tab showing user table with username, role, active status, and action buttons

### What You See

The Users table lists all registered accounts with:

| Column | Description |
|--------|-------------|
| Username | Login identifier |
| Display Name | Friendly name shown in the app header |
| Role | Assigned role (Admin, Manager, Viewer, or custom) |
| Active | Green = active (can log in) / Grey = inactive |
| Actions | Edit, Activate/Deactivate, Delete buttons |

---

### Step-by-Step: Creating a New User

1. Navigate to **User Access Control** from the sidebar.
2. Click **+ Add User** (top right of the Users tab).
3. Fill in the user creation form:

| Field | Required | Notes |
|-------|----------|-------|
| Username | ✅ | Must be unique, case-insensitive |
| Password | ✅ | Minimum recommended: 8 characters |
| Display Name | No | Shown in the app header; defaults to username |
| Role | No | Select from existing roles |

4. Click **Save**.
5. The new user appears in the table and can log in immediately.

> ⚠️ **Security Note:** Passwords are hashed using PBKDF2-SHA256. The plain-text password is never stored or shown after account creation. If a user forgets their password, an admin must reset it.

---

### Step-by-Step: Editing a User

1. Click the **Edit** (pencil ✏️) icon on a user row.
2. The edit form opens pre-filled.
3. You can update:
   - Display Name
   - Role assignment
   - Password (leave blank to keep the existing password)
   - Active status
4. Click **Save**.

---

### Step-by-Step: Resetting a User's Password

1. Click **Edit** on the target user row.
2. Enter a new password in the **Password** field.
3. Click **Save**.
4. Inform the user of their new password securely.

---

### Step-by-Step: Deactivating a User

1. Click the **Active toggle** on the user row.
2. The user's status changes to **Inactive**.
3. The user immediately loses the ability to log in, but their history and data are preserved.

**Re-activating:** Click the same toggle again — it returns to Active.

---

### Step-by-Step: Deleting a User

1. Click the **Delete** (🗑️) icon on a user row.
2. Confirm the deletion in the prompt.

> ⚠️ **Warning:** You cannot delete the **last active Admin** user. At least one Admin account must remain active at all times to prevent lockout.

---

## Roles & Permissions Tab

> **Screenshot:** Roles & Permissions tab — role cards with page-level permission checklists and edit buttons

Roles define a named set of permissions that can be assigned to users.

### Built-in Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access to all modules and administrative features |
| **Manager** | Read + write on process, resources, requests, finance |
| **Viewer** | Read-only across all modules |

Built-in roles cannot be deleted, but their permissions can be modified.

---

### Step-by-Step: Creating a Custom Role

1. Click the **Roles & Permissions** tab.
2. Click **+ Add Role**.
3. Enter a **Role Name** and optional description.
4. Use the **permission checklist** to assign permissions (see Permission Matrix below).
5. Click **Save Role**.
6. The role is now available in the user creation/edit form.

---

### Step-by-Step: Editing a Role's Permissions

1. Click the **Edit** icon on a role card.
2. The permission checklist opens.
3. Check or uncheck permissions as needed.
4. Click **Save**.
5. All users assigned this role immediately gain or lose the updated permissions.

---

### Step-by-Step: Deleting a Custom Role

1. Click the **Delete** icon on a role card.
2. Confirm deletion.
3. Users previously assigned this role will have no role — their access will be restricted until a new role is assigned.

> ⚠️ **Note:** Built-in roles (Admin, Manager, Viewer) cannot be deleted.

---

## Permission Matrix

Permissions are page-level, each with `view`, `edit`, and `delete` granularity.

| Page ID | UI Name | Section |
|---------|---------|---------|
| `account_summary` | Account Summary | Account |
| `executive_summary` | Finance Summary | Finance |
| `executive_revenue` | SOW Details | Finance |
| `executive_invoicing` | Invoicing Details | Finance |
| `clientmgmt_requests` | Client Requests | Clients |
| `resources_info` | Resource Hub | Resources |
| `engagement_mapping` | Engagement Mapping | Resources |
| `clientmgmt_connects` | Internal Process | Process |
| `configuration` | App Settings | Settings |
| `user_access_control` | User Access Control | Settings |
| `user_settings` | User Settings | Settings |

> 💡 **Tip:** A role set to `view=false` for a page will hide that page entirely from users with that role.

---

## User Groups Tab

> **Screenshot:** User Groups tab — group list with name, description, and member Transfer widget

User Groups allow you to bundle multiple users together for notification targeting (used in App Settings → App Notifications).

### Step-by-Step: Creating a User Group

1. Click the **User Groups** tab.
2. Click **+ New Group**.
3. Enter a **Group Name** and optional description.
4. In the **Members** section, move users from the left (available) to the right (members) using the Transfer widget.
5. Click **Save Group**.
6. The group can now be selected as a recipient in App Settings → App Notifications.

### Step-by-Step: Editing a User Group

1. Click the **Edit** (✏️) icon on a group row.
2. Update the name, description, or member list.
3. Click **Save**.

### Step-by-Step: Deleting a User Group

1. Click the **Delete** (🗑️) icon on a group row.
2. Confirm deletion.
3. Any notification triggers targeting this group will no longer deliver to its former members.

---

> **Previous:** [App Settings](./08-configuration.md) | **Next:** [Notifications](./10-notifications.md)
