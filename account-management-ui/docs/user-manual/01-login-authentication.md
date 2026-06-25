# Login & Authentication

**Module:** Login  
**Access:** All users

---

## Overview

The EAM login screen is the entry point to the application. All users must authenticate with a valid username and password before accessing any module.

---

## Screens

### Login Screen

```
┌─────────────────────────────────────────┐
│         EAM — Account Management        │
│                                         │
│   Username  [_________________________] │
│   Password  [_________________________] │
│                                         │
│              [ Login ]                  │
└─────────────────────────────────────────┘
```

> **Screenshot:** Login page with username/password fields and Login button

---

## Step-by-Step: Logging In

1. Open your browser and navigate to the EAM application URL.
2. Enter your **Username** in the first input field.
3. Enter your **Password** in the second input field.
4. Click the **Login** button.
5. On success, you are redirected to the **Finance Management** dashboard.

> ⚠️ If login fails, check that Caps Lock is off and credentials are correct. Contact your admin if the issue persists.

---

## Session Management

- Your session is stored in the browser. Closing the tab may end your session.
- To explicitly end your session, click the **Logout** option in the top-right corner of the application header.
- The session does not expire automatically during active use.

---

## Roles & Permissions

Access to features depends on the role assigned to your account by an administrator.

| Role | Access Level |
|------|-------------|
| **Admin** | Full access — all modules, user management, configuration |
| **Manager** | Read + write access to process, resources, finance |
| **Viewer** | Read-only access to dashboards and reports |

- Permissions are controlled at the module level (read / write per module).
- If you cannot see a module or button, you may not have the required permission — contact your admin.

---

## Security Notes

- Passwords are hashed using PBKDF2-SHA256 (100,000 iterations) — never stored in plain text.
- Never share your password.
- If your password needs to be reset, contact an Admin via User Access Control.

---

> **Next:** [Navigation](./02-navigation.md)
