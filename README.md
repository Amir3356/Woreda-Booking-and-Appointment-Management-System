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

WoredaCare is built with a **microservices architecture**, and the code inside every service
follows a **layered architecture**.

- **Microservices (system level):** the backend is split into five independent business services
  plus an API gateway. Each service has its own codebase, `package.json`, Dockerfile and container,
  owns its own MongoDB collections, and can be built, deployed, scaled and restarted on its own.
- **Layered code organization (service level):** inside each service the code is divided into
  layers (routes, middleware, controllers, services, repositories, models, config, utils). Each
  layer has one job and only calls the layer below it.

### Microservices architecture

```
 Browser (React + Vite)
        │  HTTP / WebSocket
        ▼
 nginx (rate limiting, :8080)
        ▼
 API Gateway (JWT check, Redis response cache, WebSocket notifications)
        │
        ├── auth-service         :8081  register, sign in, sign out, current user
        ├── user-service         :8082  citizen profiles, staff accounts, system settings
        ├── department-service   :8083  departments and public services (+ gRPC catalog :9083)
        ├── appointment-service  :8084  bookings, review, reschedule, cancel, slips, reports, audit log
        └── booking-service      :8085  schedules, slot availability, desk queue

 MongoDB (replica set) · Redis (cache, revoked tokens, login lockout) · Kafka (domain events)
 Prometheus + Grafana (monitoring and alerting)
```

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7, Zustand, Vite 6 |
| Backend services | Node.js, Express, Mongoose |
| Database | MongoDB 7 (single-node replica set, for transactions) |
| Cache | Redis 7 |
| Messaging | Apache Kafka 3.8 (KRaft); topics `woreda.appointments` and `woreda.catalog` |
| Service-to-service | REST through the gateway; gRPC for catalog lookups |
| Edge | nginx 1.27 |
| Monitoring | Prometheus, Grafana, exporters for MongoDB, Redis, Kafka, nginx and the host |
| Deployment | Docker Compose |

#### Services and data ownership

| Microservice | Port | Responsibility | Owns (MongoDB collections) |
|--------------|------|----------------|----------------------------|
| **api-gateway** | 8080 | Single entry point: routes requests to services, checks JWTs, caches responses in Redis, pushes live updates over WebSocket | — (Redis cache only) |
| **auth-service** | 8081 | Registration, sign-in, sign-out, token issue and revocation, login lockout | reads/inserts `users` |
| **user-service** | 8082 | Citizen profiles, staff accounts, system settings | `users`, `system_settings` |
| **department-service** | 8083 / gRPC 9083 | Departments and public services (the catalog) | `departments`, `services` |
| **appointment-service** | 8084 | Booking, review, reschedule, cancel, slips, reports, audit log | `appointments`, `slot_reservations`, `audit_logs` |
| **booking-service** | 8085 | Schedules, slot availability, check-in and desk queue | `schedules`, `queue_tokens` |

#### How the services communicate

| Style | Used for |
|-------|----------|
| **REST over HTTP** (synchronous) | Browser → nginx → API gateway → service |
| **gRPC** (synchronous, internal) | appointment-service asks department-service for catalog data while booking |
| **Kafka events** (asynchronous) | Services publish `woreda.appointments` and `woreda.catalog` events; the gateway consumes them to clear caches and notify browsers |
| **WebSocket** | API gateway → open browser pages (live updates) |

### Layered code organization

Every microservice uses the same folder layout, so a developer who knows one service can find their
way around all of them:

```
<service>/
├── server.js          Starts the process: connects to DB/Kafka/gRPC, starts HTTP server, graceful shutdown
├── app.js             Builds the Express app and wires the layers together
├── routes/            Layer 1 – maps URLs and HTTP methods to controllers, attaches middleware
├── middleware/        Cross-cutting – authentication/roles, request logging, metrics, error handling
├── controllers/       Layer 2 – reads the HTTP request, calls a service, sends the HTTP response
├── services/          Layer 3 – business logic and rules (validation, capacity, status changes, events)
├── repositories/      Layer 4 – data access: all MongoDB / Redis / gRPC queries
├── models/            Layer 5 – Mongoose schemas, indexes and validation for the owned collections
├── config/            Settings and connections: env vars, database, Redis, Kafka, logger, metrics
└── utils/             Small shared helpers: IDs, errors, response format, dates, time slots
```

A request flows down through the layers and the result flows back up:

```
HTTP request
   │
   ▼
routes ──► middleware (auth, role, logging, metrics)
   │
   ▼
controllers   ── HTTP only: parse input, choose status code
   │
   ▼
services      ── business rules, no HTTP or database code
   │
   ▼
repositories  ── database / cache / gRPC access
   │
   ▼
models        ── MongoDB schema
```

**Layer rules**

1. A layer calls only the layer directly below it (controllers never query the database; repositories
   never contain business rules).
2. Controllers know about HTTP; services do not, so business logic can be tested without a web server.
3. Only repositories talk to MongoDB, Redis or other services over gRPC, so storage can change without
   touching business logic.
4. Errors are thrown as typed errors (`utils/errors.js`) and turned into HTTP responses in one place
   (`middleware/errorHandler.js`).
5. Configuration comes only from `config/`, which reads environment variables.

The API gateway has no database, so it has no `models/` folder; its `repositories/` hold Redis access
for the response cache and revoked tokens.

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
| NFR-1.2 | API access uses signed JWTs that expire after 12 hours; signed-out tokens are revoked in Redis. |
| NFR-1.3 | Role-based access control is enforced on the server for every protected endpoint, not only in the UI. |
| NFR-1.4 | nginx limits each IP to 5 requests/second (burst 50) on the API, and 20 requests/minute (burst 10) on sign-in and registration; excess requests get HTTP 429. |
| NFR-1.5 | Repeated failed sign-ins lock the account temporarily (see FR-1.6). |
| NFR-1.6 | CORS only allows the configured frontend origins; WebSocket connections check the Origin header. |
| NFR-1.7 | Internal services, the database, Redis, Kafka and metrics are not reachable from outside; only nginx is published. MongoDB, Prometheus and Grafana bind to `127.0.0.1` only. |
| NFR-1.8 | Secrets (such as `JWT_SECRET`) are supplied through environment variables, not hard-coded for production. |
| NFR-1.9 | All input is validated on the server; invalid requests return clear field-level error messages. |

### NFR-2 Performance

| ID | Requirement |
|----|-------------|
| NFR-2.1 | Normal API requests should respond within 1 second (95th percentile); an alert fires when responses are slower. |
| NFR-2.2 | Frequently read data is cached in Redis at the gateway: departments and services for 10 minutes, slot availability for 30 seconds. Caches are invalidated when the data changes. |
| NFR-2.3 | Database queries use indexes on the most common lookups (by service/date/slot, citizen, department/date, queue date and status). |
| NFR-2.4 | Long lists (appointments, users, audit log) are paginated. |

### NFR-3 Reliability and data integrity

| ID | Requirement |
|----|-------------|
| NFR-3.1 | Slot capacity is reserved with atomic database operations, so two citizens cannot over-book the same slot at the same time. |
| NFR-3.2 | Status changes are conditional (e.g. only a `PENDING` appointment can be approved), so concurrent edits do not overwrite each other. |
| NFR-3.3 | MongoDB runs as a replica set so multi-document transactions are available. |
| NFR-3.4 | A failure in Redis (cache, lockout) or in audit logging must not block sign-in or booking; the system logs the error and continues. |
| NFR-3.5 | Containers restart automatically on failure, and services wait for their dependencies to be healthy before starting. |
| NFR-3.6 | Data is kept in persistent Docker volumes; Kafka keeps events for 7 days. |

### NFR-4 Availability and monitoring

| ID | Requirement |
|----|-------------|
| NFR-4.1 | Every service exposes Prometheus metrics (request rate, errors, latency, Kafka events, gRPC calls, sign-ins). |
| NFR-4.2 | Grafana provides dashboards for system overview, service health, booking activity and infrastructure. |
| NFR-4.3 | Alerts fire when a service, MongoDB, Redis, Kafka or nginx is down, when more than 5% of requests fail with a server error, when responses are slow, or when Kafka events or catalog lookups fail. |
| NFR-4.4 | Every service writes structured logs, and each request carries a request ID for tracing across services. |
| NFR-4.5 | Metrics are retained for 15 days. |

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
| NFR-6.1 | The backend is split into independent microservices that can be deployed and scaled separately. |
| NFR-6.2 | Each service owns its own data collections; services communicate through REST, gRPC and Kafka events. |
| NFR-6.3 | All services use the same layered structure (routes, middleware, controllers, services, repositories, models, config). |
| NFR-6.4 | The API is versioned (`/api/v1`). |
| NFR-6.5 | The whole backend can be started with a single command (`docker compose up --build`). |

### NFR-7 Compatibility

| ID | Requirement |
|----|-------------|
| NFR-7.1 | The frontend supports current versions of Chrome, Firefox, Edge and Safari. |
| NFR-7.2 | The system runs on any host with Docker and Docker Compose. |

---

## Getting started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ and npm (for the frontend)

### 1. Start the backend

```bash
docker compose up --build
```

On first start, department-service creates the default departments, and user-service creates the
administrator account and default settings.

| What | URL |
|------|-----|
| API (through nginx) | http://localhost:8080/api/v1 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| MongoDB (mongosh / Compass) | `mongodb://localhost:27017/woreda?directConnection=true` |

### 2. Start the frontend

```bash
cd client
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8080/api/v1
npm install
npm run dev
```

The app opens at http://localhost:3000.

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | `dev-secret-change-me` | Signing key for access tokens. **Change it outside development.** |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Frontend origins allowed to call the API |

> Grafana runs without sign-in and is published on `127.0.0.1` only. Add a login before exposing it on a network.

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
├── server/                    One folder per microservice, each with the same layered layout
│   ├── api-gateway/           Routing, auth check, cache, WebSocket
│   ├── auth-service/          Microservice: authentication
│   ├── user-service/          Microservice: profiles, staff, settings
│   ├── department-service/    Microservice: departments and services catalog
│   ├── appointment-service/   Microservice: appointments, reports, audit
│   ├── booking-service/       Microservice: schedules, availability, queue
│   ├── nginx/                 nginx.conf (rate limits, proxy)
│   └── monitoring/            Prometheus config and alerts, Grafana dashboards
└── docker-compose.yml
```
