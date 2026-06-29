# Stakeholders

**Module:** Clients > Stakeholders  
**Access:** Users with `information_teamhierarchy` page permission

---

## Overview

The Stakeholders module provides a relationship network and directory view for client/internal stakeholders.  
It supports search, quick team filters, detailed profile panel, full-profile view, comment/audit tracking, escalation-to-resource linking, template download, upload, and exports.

---

## Main Views

| View | Description |
|------|-------------|
| **Network View** | Interactive stakeholder graph with zoom, expand, and profile side panel |
| **Directory View** | Tabular stakeholder list with paging and row actions |

---

## Key Actions

### Filters
- **Quick tags:** Client / Internal Team
- **Filter panel:** Name, Title/Role, Department, Reporting Manager, Responsibility
- **Clear All** resets to default quick-filter behavior

### Search
- Search supports name, role, department, email, phone, responsibility
- Graph automatically scopes to connected paths for matches

### Export & Template
- **Data export** from Directory View
- **Diagram export** from Network View
- **Template download** for bulk upload format

### Add/Edit/Delete
- Add and edit stakeholder records via popup form
- Delete individual record or bulk delete-all (permission-based)

### Comments & Audit (Stakeholder View Panel)
- **Comments tab** supports tags:
  - Interactions
  - Escalations (with linked resource selection)
  - Current Requirement
  - Future Requirement
- **Escalations** can link resources. Linked escalation notes are mirrored to Resource comments under Escalations.
- **Unlinking** a resource from escalation removes the mirrored Resource comment for that resource.
- **Deleting** a stakeholder escalation comment removes all linked mirrored Resource comments.
- **Current/Future Requirement** comments automatically create a Client Request (Resource Demand) and show the linked request Beeline ID + request ID in the comment card.
- **Deleting** a Current/Future Requirement comment marks the linked auto-created Client Request inactive and appends a deletion note (who deleted, stakeholder, timestamp, original note) to support traceability.
- **Audit tab** shows stakeholder comment create/update/delete/link/unlink history.
- **Client Comments tab** provides a consolidated feed for all client stakeholders and supports adding new client comments directly.

---

## API / Data Backing

| Operation | Endpoint | Table |
|---|---|---|
| List by team type | `GET /api/team-hierarchy?teamType=client|ra` | `team_hierarchy_entries` |
| Save bulk | `PUT /api/team-hierarchy/:teamType/bulk` | `team_hierarchy_entries`, `audit_log` |
| List stakeholder comments | `GET /api/team-hierarchy/:stakeholderId/comments` | `stakeholder_comments`, `stakeholder_comment_resources` |
| Add stakeholder comment | `POST /api/team-hierarchy/:stakeholderId/comments` | `stakeholder_comments`, `stakeholder_comment_resources`, `resource_comments`, `audit_log` |
| Update stakeholder comment | `PUT /api/team-hierarchy/:stakeholderId/comments/:commentId` | `stakeholder_comments`, `stakeholder_comment_resources`, `resource_comments`, `audit_log` |
| Delete stakeholder comment | `DELETE /api/team-hierarchy/:stakeholderId/comments/:commentId` | `stakeholder_comments`, `stakeholder_comment_resources`, `resource_comments`, `audit_log` |
| List all client comments | `GET /api/team-hierarchy/comments?teamType=client` | `stakeholder_comments`, `stakeholder_comment_resources` |
| Stakeholder comment audit | `GET /api/team-hierarchy/:stakeholderId/comment-audit` | `audit_log` |

---

> **Previous:** [Internal Process](./04-internal-process.md) | **Next:** [Client Requests](./05-client-requests.md)
