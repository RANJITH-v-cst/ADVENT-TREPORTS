# ADVENT TREPORTS — Tally ERP Dashboard

A full-stack dashboard connecting to **Tally ERP 9/Prime** with Power BI-style interactive charts.

## Architecture

```
[Tally ERP] → (XML/HTTP) → [Python FastAPI Backend] → (REST API) → [React Frontend + Chart.js]
```

## Quick Start

1. **Make sure Tally ERP is running** on `localhost:9000`
2. Double-click **`start.bat`**
3. Login with `admin` / `admin`

## Default Credentials

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin    | Admin |
| user     | user     | User  |

## Tech Stack

- **Backend**: Python 3.12, FastAPI, httpx, xmltodict, SQLite
- **Frontend**: React 18, Vite, Chart.js, React Router, Axios
- **Auth**: Session tokens with bcrypt password hashing
- **Charts**: Chart.js with custom dark theme styling

## Features

- 📊 6 interactive Power BI-style charts
- 📋 Daybook with searchable transaction table
- 📦 Stock items with value charts
- 👤 Multi-user auth (admin/user roles)
- 🔒 Admin panel for user management
- 🎨 Premium dark glassmorphism UI
