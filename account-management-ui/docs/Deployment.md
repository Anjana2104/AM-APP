# Deployment Guide (Local SQLite -> Shared Dev -> Future PostgreSQL)

This guide gives end-to-end steps to move this app from personal local usage to a shared dev environment for testing, and later migrate backend database usage from SQLite to PostgreSQL.

> Scope note: **No data migration is included** (as requested). You can re-import your downloaded data separately.

---

## 1) Current Architecture Baseline

- Frontend: Vite + React (`npm run build` -> `dist/`)
- Backend: Node/Express (`server/index.js`)
- Current DB: SQLite (`server/data/eam_finance.db`)
- API base: same host, backend serves `/api/*`

---

## 2) Create/Prepare Git Repository (Team-Ready)

### Step 2.1 - Create organization repo
1. Create a new repo in org/team GitHub (recommended), e.g. `eam-app`.
2. Add branch protections on `main`:
   - Require PR
   - Require status checks
   - Restrict direct pushes

### Step 2.2 - Push current code from personal setup
```powershell
git init
git add .
git commit -m "Initial team-ready baseline"
git branch -M main
git remote add origin <ORG_REPO_URL>
git push -u origin main
```

### Step 2.3 - Add core repo files
- `.gitignore` (ensure DB and secrets excluded)
- `.env.example` and `server/.env.example`
- `README.md` startup/deploy summary
- `docs/Deployment.md` (this file)

---

## 3) Standardize Environment Configuration

Create environment variables before deployment:

### Frontend
- `VITE_API_BASE_URL` (if frontend and backend are split domains)

### Backend
- `NODE_ENV=development|production`
- `PORT=3001`
- `DB_CLIENT=sqlite|postgres`
- `SQLITE_DB_PATH=server/data/eam_finance.db` (for sqlite mode)
- `DATABASE_URL=postgres://...` (for postgres mode)
- Any auth/session/secret keys

---

## 4) Deploy for Team Testing (Recommended First: Single VM)

Use one Linux VM (or cloud instance) for quick team access.

### Step 4.1 - Provision server
1. Create Ubuntu VM.
2. Open firewall/security group:
   - `22` (SSH)
   - `80` / `443` (HTTP/HTTPS)

### Step 4.2 - Install runtime
```bash
sudo apt update
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### Step 4.3 - Clone and install
```bash
git clone <ORG_REPO_URL> /opt/eam-app
cd /opt/eam-app
npm ci
cd server
npm ci
```

### Step 4.4 - Build frontend
```bash
cd /opt/eam-app
npm run build
```

### Step 4.5 - Run backend via PM2 (or systemd)
```bash
sudo npm i -g pm2
cd /opt/eam-app/server
pm2 start index.js --name eam-api
pm2 save
pm2 startup
```

### Step 4.6 - Configure Nginx reverse proxy
- Serve frontend `dist` on `/`
- Proxy `/api` to `http://127.0.0.1:3001`

Example Nginx site:
```nginx
server {
  listen 80;
  server_name <YOUR_DOMAIN_OR_IP>;

  root /opt/eam-app/dist;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Then:
```bash
sudo ln -s /etc/nginx/sites-available/eam-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4.7 - Enable HTTPS (recommended)
Use Certbot + Let’s Encrypt.

---

## 5) CI/CD Pipeline (GitHub Actions Reference)

Create 3 workflows:

1. **CI (PR checks)**
   - install deps
   - run `npm run build`
   - run server checks (if present)

2. **CD Dev (auto on main)**
   - build frontend/backend
   - deploy artifacts to dev server
   - restart process manager

3. **Manual rollback workflow**
   - deploy selected prior commit tag

Minimum CI pipeline stages:
1. Checkout
2. Setup Node
3. `npm ci` (root + server)
4. `npm run build`
5. Optional: `npm audit --omit=dev` policy check

---

## 6) Future PostgreSQL Migration Plan (No Data Migration)

### Step 6.1 - Add DB abstraction switch
In backend config:
- `DB_CLIENT=sqlite` -> current path
- `DB_CLIENT=postgres` -> new pg pool/client path

### Step 6.2 - Introduce PostgreSQL driver + connection layer
Use `pg` and central DB adapter (same method signatures used by routes).

### Step 6.3 - Convert schema/migrations
Create SQL migrations in order:
1. baseline tables
2. indexes/constraints
3. incremental feature migrations

### Step 6.4 - Update route queries for PostgreSQL dialect
Check all:
- auto-increment syntax
- upsert syntax
- placeholder style (`$1, $2...`)
- transaction handling
- JSON handling

### Step 6.5 - Verification
1. Deploy in dev with `DB_CLIENT=postgres`
2. Run smoke tests on critical modules:
   - Finance
   - Stakeholders
   - Requests
   - Resources
   - Internal Process
   - Notifications/Auth

---

## 7) Release Steps for Shared Dev Access

1. Merge approved PR to `main`
2. CI must pass
3. CD deploys to dev server
4. Run post-deploy sanity:
   - login
   - 2-3 CRUD flows
   - Stakeholders graph load
   - API health endpoint
5. Share dev URL with test users

---

## 8) UI State + Docs Sync Checklist (for future syncs)

When UI/navigation/page IDs change, update all of:

1. `src/App.tsx`  
   - page IDs, section map, navigation menus
2. `src/pages/UserAccessControl.tsx`  
   - `ALL_PAGES` permission matrix labels/sections
3. `docs/UI_API_DB_MAPPING.md`
4. `docs/MODULE_FILE_FUNCTIONALITY_OVERVIEW.md`
5. `docs/ARCHITECTURE.md`
6. `docs/user-manual/*.md`
7. `docs/generated/schema_ddl.sql` header page-ID block

Recommended PR checklist item:
- [ ] "UI state and page-ID docs synced"

---

## 9) Testing Access Rollout (What you need now)

Since you need others to test now:
1. Deploy to a shared dev server (Section 4).
2. Keep SQLite initially (fastest path).
3. Create tester user accounts in User Access Control.
4. Share HTTPS URL + test credentials.
5. Lock down with IP allowlist if needed.

---

## 10) Operational Best Practices

- Keep separate environments: local, dev, staging, prod.
- Never commit secrets or DB files.
- Add daily DB backup (even in dev).
- Tag release commits for rollback.
- Keep deployment runbook updated after each infra change.

