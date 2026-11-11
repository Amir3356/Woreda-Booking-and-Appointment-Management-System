# WoredaCare — Woreda Booking and Appointment Management System

WoredaCare is a web system for booking appointments with Woreda public-administration offices.
Citizens book a service online and get a reference number and appointment slip. Department officers
review the bookings and check citizens in at the desk queue. The administrator manages
departments, services, schedules, staff accounts and system settings.

## Contents

- [User roles](#user-roles)
- [Architecture](#architecture)
- [Functional requirements](#functional-requirements)
- [Non-functional requirements](#non-functional-requirements)
- [Getting started](#getting-started)
- [Project structure](#project-structure)

---

## User roles

| Role | Who | Main tasks |
|------|-----|------------|
| **Guest** | Any visitor, not signed in | Browse departments and services, view open slots, track an appointment, register |
| **Citizen** | Registered resident | Book, view, reschedule and cancel own appointments, print the slip, manage profile |
| **Officer** | Staff member assigned to one department and counter | Review (approve/reject) bookings, check citizens in, run the desk queue, view reports |
| **Administrator** | System administrator | Manage departments, services, schedules, staff accounts and settings; view audit logs and reports |

---

## Architecture

WoredaCare is a **monolithic application** whose code is organized in **layers**.

- **Monolith (system level):** the whole backend is one Node.js/Express application in `server/`,
  started as one process, with one `package.json` and one PostgreSQL database. Modules (auth,
  users, catalog, schedules, appointments, queue, reports, audit) call each other directly as
  function calls, inside the same process, and share database transactions.
- **Layered code organization (code level):** the code is divided into layers (routes, middleware,
  controllers, services, repositories, models). Each layer has one job and only calls the layer below it.

```
 Browser (React + Vite, :3000)
        │  HTTP (REST /api/v1)  ·  WebSocket (/api/v1/ws)
        ▼
 WoredaCare server (Node.js + Express, :8080)
   routes → middleware → controllers → services → repositories
        │
        ▼
 PostgreSQL (database "woreda")
```

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7, Zustand, Vite 6 |
| Backend | Node.js 22+, Express 5 (one application) |
| Database | PostgreSQL 14+ via `pg` (node-postgres), plain SQL |
| Migrations and seeds | node-pg-migrate |
| Validation | Zod (request bodies and query strings) |
| Security headers | Helmet |
| Live updates | WebSocket (`ws`), pushed from in-process domain events |
| Logging | pino (structured JSON) |

### Modules

| Module | Endpoints | Tables |
|--------|-----------|--------|
| Auth | `/api/v1/auth` – register, sign in, sign out, current user | `users`, `revoked_tokens`, `login_failures` |
| Citizen profile | `/api/v1/citizen/profile` | `users` |
| Staff and settings | `/api/v1/admin/users`, `/api/v1/admin/settings` | `users`, `system_settings` |
| Catalog | `/api/v1/departments`, `/api/v1/services` | `departments`, `services` |
| Schedules | `/api/v1/schedules` (incl. public `active` and `availability`) | `schedules` |
| Appointments | `/api/v1/appointments` – book, track, history, review, reschedule, cancel, slip | `appointments` |
| Desk queue | `/api/v1/queue` – check-in, board, call next, finalize | `queue_tokens` |
| Reports and audit | `/api/v1/reports`, `/api/v1/audit-logs` | `appointments`, `audit_logs` |
| Live notices | `GET /api/v1/ws` (WebSocket) | — |

When something changes (an appointment, a department, a service or a schedule), the service that
made the change publishes an in-process event (`services/event.service.js`), and every open browser
page receives a small notice over the WebSocket (`appointments.changed` or `catalog.changed`) so it
can re-fetch what it shows.

### Layered code organization

```
server/
├── package.json
├── .env.example         Settings template (copy to .env)
├── migrations/          node-pg-migrate migrations: one file per table (schema, keys, indexes)
├── seeds/               node-pg-migrate seeds: administrator account and default settings
├── scripts/migrate.js   Runs migrations and seeds (migrate, rollback, fresh, seed)
└── src/
    ├── server.js        Starts the process: database setup, HTTP + WebSocket server, graceful shutdown
    ├── app.js           Builds the Express app and wires the layers together
    ├── routes/          Layer 1 – maps URLs and HTTP methods to controllers, attaches role checks
    ├── middleware/      Cross-cutting – Helmet, authentication/roles, Zod validation, CORS, rate limiting, logging, errors
    ├── validations/     Zod schemas for every request body and query string
    ├── controllers/     Layer 2 – reads the HTTP request, calls a service, sends the HTTP response
    ├── services/        Layer 3 – business logic and rules (validation, capacity, status changes, events)
    ├── repositories/    Layer 4 – data access: all SQL queries
    ├── models/          Layer 5 – table row ↔ API object mapping, statuses and pure domain rules
    ├── config/          Environment settings, database.js (PostgreSQL pool and transactions), logger
    └── utils/           Small shared helpers: IDs, errors, response format, dates, time slots, CSV
```

A request flows down through the layers and the result flows back up:

```
HTTP request
   │
   ▼
middleware    ── Helmet headers, request id, logging, CORS, rate limit, JSON body, JWT → req.caller
   │
   ▼
routes        ── URL → controller, role checks (requireRole), Zod validation (validate)
   │
   ▼
controllers   ── HTTP only: parse input, choose status code
   │
   ▼
services      ── business rules, no HTTP or SQL
   │
   ▼
repositories  ── SQL queries, transactions
   │
   ▼
models        ── row → API object mapping
   │
   ▼
PostgreSQL
```

**Layer rules**

1. A layer calls only the layers below it (controllers never query the database; repositories
   never contain business rules).
2. Controllers know about HTTP; services do not, so business logic can be tested without a web server.
   Request shape and format rules live in Zod schemas (`validations/`); services receive validated
   data and keep only the rules that need the database (e.g. "department exists", slot capacity).
3. Only repositories contain SQL, so storage details can change without touching business logic.
4. Errors are thrown as typed errors (`utils/errors.js`) and turned into HTTP responses in one place
   (`middleware/errorHandler.js`).
5. Configuration comes only from `config/`, which reads environment variables and `server/.env`.

---

## Functional requirements

Each requirement has an ID so it can be referred to in tests, issues and reviews.

### FR-1 Authentication and accounts

| ID | Requirement |
|----|-------------|
| FR-1.1 | A guest can register as a citizen with full name, email, phone, national ID and password. |
| FR-1.2 | Email and national ID must be unique; registering a duplicate is refused. |
| FR-1.3 | A user can sign in with email and password and receives a signed access token (JWT). |
| FR-1.4 | A signed-in user can retrieve their own account details (`/auth/me`). |
| FR-1.5 | A user can sign out; the token is revoked and can no longer be used. |
| FR-1.6 | After 5 failed sign-in attempts, the account is locked out for 15 minutes. |
| FR-1.7 | A deactivated account cannot sign in. |
| FR-1.8 | Each user has exactly one role: `CITIZEN`, `OFFICER` or `ADMIN`. Pages and API endpoints are restricted by role. |

### FR-2 Citizen profile

| ID | Requirement |
|----|-------------|
| FR-2.1 | A citizen can view their profile. |
| FR-2.2 | A citizen can update their profile details (name, phone, address). |

### FR-3 Department and service catalog

| ID | Requirement |
|----|-------------|
| FR-3.1 | Anyone can list departments and the public services each one offers. |
| FR-3.2 | Each service shows its code, description, duration, daily quota, fee (ETB), processing time and required documents. |
| FR-3.3 | The administrator can create, edit, activate/deactivate and delete departments. |
| FR-3.4 | The administrator can create, edit, activate/deactivate and delete services. |
| FR-3.5 | Inactive services, and services in inactive departments, cannot be booked. |
| FR-3.6 | Catalog changes are published as events (`woreda.catalog`) so other services and caches stay up to date. |

### FR-4 Schedules and availability

| ID | Requirement |
|----|-------------|
| FR-4.1 | The administrator can create, edit, activate/deactivate and delete schedules for a department, or for a single service. |
| FR-4.2 | A schedule defines working days, opening and closing time, daily capacity and an effective date range. |
| FR-4.3 | Anyone can list the active (bookable) schedules. |
| FR-4.4 | Anyone can view the available time slots for a service on a given date. |
| FR-4.5 | Slots are generated from the schedule hours and the service duration; full slots and closed days are not offered. |
| FR-4.6 | Officers can view schedules. |

### FR-5 Appointment booking

| ID | Requirement |
|----|-------------|
| FR-5.1 | A signed-in citizen can book an appointment by choosing a department, service, date and time slot. |
| FR-5.2 | The booking form validates: name (at least 3 characters), Ethiopian phone number (`+2519XXXXXXXX`), a date that is not in the past, and a valid time slot. |
| FR-5.3 | The chosen date and time must fall inside an open schedule for that service. |
| FR-5.4 | Booking is refused when the time slot or the day is already full (per-slot parallel limit and daily capacity). |
| FR-5.5 | A new booking gets a unique reference number and starts in `PENDING` status. |
| FR-5.6 | A citizen can view the list of their own appointments. |
| FR-5.7 | Anyone can track an appointment by reference number or phone number. |
| FR-5.8 | A citizen can view and print an appointment slip with the reference number, details and arrival instructions. |

### FR-6 Appointment lifecycle

Appointment statuses: `PENDING → APPROVED / REJECTED → CHECKED_IN → IN_PROGRESS → COMPLETED`, plus `CANCELLED` and `NO_SHOW`.

| ID | Requirement |
|----|-------------|
| FR-6.1 | Officers and the administrator can list appointments, with filters and pagination. |
| FR-6.2 | An officer can approve or reject a `PENDING` appointment; a rejection requires a reason. |
| FR-6.3 | Rejecting or cancelling an appointment frees its slot for other citizens. |
| FR-6.4 | A citizen can cancel their own appointment only while it is `PENDING`. |
| FR-6.5 | Officers and the administrator can cancel `PENDING` or `APPROVED` appointments. |
| FR-6.6 | An appointment can be rescheduled to a new date and time slot that is open and has space; the old slot is released only after the new one is secured. |
| FR-6.7 | Every booking, approval, rejection, cancellation and reschedule is published as an event on `woreda.appointments`. |

### FR-7 Check-in and desk queue

| ID | Requirement |
|----|-------------|
| FR-7.1 | An officer can verify and check in a citizen who arrives with an approved appointment; the citizen receives a queue token number. |
| FR-7.2 | An officer can view the day's queue board for their department (waiting, serving, completed, no-show). |
| FR-7.3 | An officer can call the next citizen in the queue to their counter. |
| FR-7.4 | An officer can finish a queue token as `COMPLETED` or `NO_SHOW`, which also updates the appointment. |
| FR-7.5 | The queue shows an estimated waiting time for each token. |

### FR-8 Notifications

| ID | Requirement |
|----|-------------|
| FR-8.1 | Open browser pages receive live updates over WebSocket when appointments or the queue change. |
| FR-8.2 | A citizen can view their notifications page. |

### FR-9 Staff and system administration

| ID | Requirement |
|----|-------------|
| FR-9.1 | The administrator can list all users. |
| FR-9.2 | The administrator can create (provision) officer and administrator accounts. |
| FR-9.3 | An officer account must be assigned to a department and may have a counter number. |
| FR-9.4 | The administrator can activate, deactivate and delete user accounts. |
| FR-9.5 | The administrator can view and update system settings: Woreda name, city/region, hotline, reception phone, SMS gateway on/off, auto-approve bookings, advance booking days, cancellation cut-off hours and maximum parallel bookings per slot. |

### FR-10 Reports and audit

| ID | Requirement |
|----|-------------|
| FR-10.1 | Officers and the administrator can view a summary report of appointments (counts by status, department and period). |
| FR-10.2 | Officers and the administrator can export appointments as CSV. |
| FR-10.3 | Each appointment decision (booked, approved, rejected, cancelled, rescheduled) is recorded in an audit log with who did it and when. |
| FR-10.4 | The administrator can view and filter the audit log. |

### FR-11 Public information pages

| ID | Requirement |
|----|-------------|
| FR-11.1 | The site provides public About, Services, Departments, Contact and Track Appointment pages. |

---

## Non-functional requirements

### NFR-1 Security

| ID | Requirement |
|----|-------------|
| NFR-1.1 | Passwords are stored only as bcrypt hashes (cost 10) and are never returned by the API. |
| NFR-1.2 | API access uses signed JWTs that expire after 12 hours; signed-out tokens are revoked (stored in the `revoked_tokens` table until they expire). |
| NFR-1.3 | Role-based access control is enforced on the server for every protected endpoint, not only in the UI. |
| NFR-1.4 | The server limits each IP to 5 requests/second (burst 50) on the API, and 20 requests/minute (burst 10) on sign-in and registration; excess requests get HTTP 429. |
| NFR-1.5 | Repeated failed sign-ins lock the account temporarily (see FR-1.6). |
| NFR-1.6 | CORS only allows the configured frontend origins; WebSocket connections check the Origin header. |
| NFR-1.7 | Only the application server is published; PostgreSQL should accept connections from the server host only. |
| NFR-1.8 | Secrets (such as `JWT_SECRET` and `DB_PASSWORD`) are supplied through environment variables or `server/.env` (not committed), not hard-coded for production. |
| NFR-1.9 | All input is validated on the server with Zod schemas; invalid requests return HTTP 422 with field-level error messages. |
| NFR-1.10 | Helmet sets security headers on every response (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, referrer and cross-origin policies) and hides `X-Powered-By`. |

### NFR-2 Performance

| ID | Requirement |
|----|-------------|
| NFR-2.1 | Normal API requests should respond within 1 second (95th percentile); an alert fires when responses are slower. |
| NFR-2.2 | Database connections are pooled; open pages re-fetch data only when a change notice arrives over the WebSocket instead of polling. |
| NFR-2.3 | Database queries use indexes on the most common lookups (by service/date/slot, citizen, department/date, queue date and status). |
| NFR-2.4 | Long lists (appointments, users, audit log) are paginated. |

### NFR-3 Reliability and data integrity

| ID | Requirement |
|----|-------------|
| NFR-3.1 | Bookings and reschedules check daily and per-slot capacity inside a PostgreSQL transaction holding an advisory lock per service and day, so two citizens cannot over-book the same slot at the same time. |
| NFR-3.2 | Status changes are conditional (e.g. only a `PENDING` appointment can be approved), so concurrent edits do not overwrite each other. |
| NFR-3.3 | PostgreSQL foreign keys, unique and check constraints protect relationships (e.g. a service with appointments or a department with services cannot be deleted); multi-step changes such as check-in run in one transaction. |
| NFR-3.4 | A failure in audit logging or in sending live notices must not block sign-in or booking; the system logs the error and continues. |
| NFR-3.5 | The schema is versioned with node-pg-migrate migrations (each with a rollback); the server refuses to start on an unmigrated database, and `GET /healthz` reports whether the database answers. |
| NFR-3.6 | All data is kept in PostgreSQL and survives restarts; back it up with `pg_dump`. |

### NFR-4 Availability and monitoring

| ID | Requirement |
|----|-------------|
| NFR-4.1 | `GET /healthz` returns 200 while the server and database are up, 503 otherwise, for uptime checks. |
| NFR-4.2 | The server writes structured JSON logs (one line per request with method, path, status and duration). |
| NFR-4.3 | Each request carries a request ID (`X-Request-ID`), returned in responses and error envelopes for tracing. |

### NFR-5 Usability and accessibility

| ID | Requirement |
|----|-------------|
| NFR-5.1 | The interface is responsive and works on mobile phones, tablets and desktops. |
| NFR-5.2 | Each role has its own dashboard and navigation, showing only the actions that role can perform. |
| NFR-5.3 | Error messages are clear and tell the user how to fix the problem. |
| NFR-5.4 | Booking takes a few simple steps: department → service → date → time slot → confirm. |
| NFR-5.5 | Dates and times follow local conventions (East Africa Time, `Africa/Addis_Ababa`); phone numbers use the Ethiopian format. |

### NFR-6 Scalability and maintainability

| ID | Requirement |
|----|-------------|
| NFR-6.1 | The backend is one deployable application with clearly separated modules, so it is simple to run, debug and deploy. |
| NFR-6.2 | The code follows a layered structure (routes, middleware, controllers, services, repositories, models, config). |
| NFR-6.3 | The API is versioned (`/api/v1`). |
| NFR-6.4 | The whole backend starts with a single command (`npm start` in `server/`). |

### NFR-7 Compatibility

| ID | Requirement |
|----|-------------|
| NFR-7.1 | The frontend supports current versions of Chrome, Firefox, Edge and Safari. |
| NFR-7.2 | The system runs on any host with Node.js 22+ and PostgreSQL 14+. |

---

## Getting started

### Prerequisites

- Node.js 22+ and npm
- PostgreSQL 14+ running locally (or reachable over the network)

### 1. Start the backend

```bash
cd server
cp .env.example .env   # then set DB_PASSWORD (and DB_HOST/DB_USER if not local "postgres")
npm install
npm run migrate        # creates the woreda database if needed and applies all migrations
npm run seed           # administrator account and default settings
npm start              # or: npm run dev  (restarts on file changes)
```

The API is then at http://localhost:8080/api/v1. The administrator signs in with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `server/.env`; change the password after the first sign-in.

#### Migration and seed commands

| Command | What it does |
|---------|--------------|
| `npm run migrate` | Applies pending migrations from `migrations/` |
| `npm run migrate:down` | Rolls back the last migration (`npm run migrate:down -- 3`, or `-- all`) |
| `npm run migrate:fresh` | Drops **every table and all data**, then runs all migrations again |
| `npm run migrate:fresh:seed` | Same as `migrate:fresh`, then runs the seeds |
| `npm run seed` | Runs every seed in `seeds/` (seeds are idempotent, so this is safe to repeat) |
| `npm run migrate:create -- <name>` | Creates a new migration file in `migrations/` |
| `npm run seed:create -- <name>` | Creates a new seed file in `seeds/` |

### 2. Start the frontend

```bash
cd client
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8080/api/v1
npm install
npm run dev
```

The app opens at http://localhost:3000.

### Configuration (`server/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | HTTP port of the API |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL server |
| `DB_USER` / `DB_PASSWORD` | `postgres` / — | PostgreSQL credentials |
| `DB_NAME` | `woreda` | Database (created on first start) |
| `JWT_SECRET` | `dev-secret-change-me` | Signing key for access tokens. **Change it outside development.** |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Frontend origins allowed to call the API |
| `TZ` | `Africa/Addis_Ababa` | Time zone that defines "today" for bookings and the queue |
| `RATE_LIMIT_ENABLED` | `true` | Per-IP request limits (NFR-1.4); `false` turns them off |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` | `Amir Siraj` / `amirsiraj1995@gmail.com` | Administrator created by `npm run seed` |
| `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_PHONE` | — / `+251911223344` | Administrator password (hashed with bcrypt) and phone |

---

## Project structure

```
.
├── client/                    React frontend
│   ├── api/                   HTTP and WebSocket clients per resource
│   ├── pages/                 Public, citizen/, officer/ and admin/ pages
│   ├── layout/                Role layouts, navbar, sidebar
│   ├── components/ features/  Shared UI and the appointment slip
│   └── context/ hooks/ services/ utils/ styles/
└── server/                    Monolithic backend (Express + PostgreSQL), layered
    ├── migrations/ seeds/     node-pg-migrate schema migrations and seed data
    ├── scripts/migrate.js     Migration / seed runner
    └── src/
        ├── routes/ middleware/ controllers/ services/ repositories/ models/
        ├── validations/       Zod request schemas
        └── config/ utils/
```
