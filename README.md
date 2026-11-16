# WoredaCare: Woreda Booking and Appointment Management System

WoredaCare lets citizens book in-person appointments for woreda public services online, lets each
department review those requests and serve citizens through a live desk queue, and gives the
woreda administration control over departments, services, schedules, staff and an audit trail.

This document describes the system's **functional** and **non-functional requirements**, the
business rules it enforces, and the known gaps between the specification and the current build.

---

## Contents

1. [System overview](#1-system-overview)
2. [Users and roles](#2-users-and-roles)
3. [Appointment workflow](#3-appointment-workflow)
4. [Functional requirements](#4-functional-requirements)
5. [Non-functional requirements](#5-non-functional-requirements)
6. [Business rules](#6-business-rules)
7. [Known gaps](#7-known-gaps)
8. [Getting started](#8-getting-started)

---

## 1. System overview

### 1.1 Purpose

Citizens currently queue in person without knowing when they will be served. WoredaCare replaces
that with scheduled appointments: a citizen picks a service, date and time online, the department
approves the request, and on the day the citizen checks in at the desk and follows their place in
the queue live.

### 1.2 Scope

| In scope | Out of scope |
|---|---|
| Online booking, approval, rescheduling and cancellation | Online payment of service fees |
| Desk check-in, live queue, calling and completing service | Document upload and verification workflows |
| Departments, services, working hours and calendar exceptions | SMS or email delivery (setting exists, not connected) |
| Staff accounts, citizen directory, reports and audit trail | Multi-woreda or multi-tenant deployment |

### 1.3 Architecture

```
Browser (React 19 + Vite)  ──HTTPS/REST──►  Express 5 API  ──►  PostgreSQL
        ▲                                        │
        └──────── WebSocket live notices ◄───────┘
```

| Layer | Technology | Location |
|---|---|---|
| Web client | React 19, React Router 7, Zustand, TanStack Table, Recharts, Sonner | [`client/`](client/) |
| API | Node.js ≥ 22, Express 5, Zod validation, CASL authorization, pino logging | [`server/`](server/) |
| Live updates | WebSocket (`ws`) at `/api/v1/ws` | [`server/services/realtime.service.js`](server/services/realtime.service.js) |
| Database | PostgreSQL, schema managed by `node-pg-migrate` | [`server/migrations/`](server/migrations/) |

The API is layered as **routes → middleware → controllers → services → repositories → PostgreSQL**.
All endpoints are under `/api/v1`; `GET /healthz` reports service health.

---

## 2. Users and roles

| Role | Who | Main pages (sidebar) |
|---|---|---|
| **Visitor** (not signed in) | Anyone | Home/sign-in, Register, About, Services, Departments, Contact, Track |
| **Citizen** | A resident who registered with a phone number | Appointment, My Queue |
| **Department Officer** (Department Head) | Staff assigned to one department and one or more of its services | Appointment, Queue |
| **Administrator** | Woreda central administration | Account Provision, Citizen Management, Department Management, Service Management, Schedule Management, Audit Logs |

Access is enforced on the server for every request (role-based, plus department and service
scoping for officers and ownership for citizens); hiding a menu item is never the only protection.

---

## 3. Appointment workflow

```
             Citizen books                 Officer reviews
 (none) ───────────────────► PENDING ───────────────────────► APPROVED ──┐
                               │  │                              │       │ Officer checks citizen in
                               │  └──► REJECTED (with reason)    │       ▼
              Citizen/staff    │                                 │   CHECKED_IN ──► IN_PROGRESS ──► COMPLETED
              cancels          ▼                Citizen (within  │   (queue token)   (called to       (service done)
                           CANCELLED ◄──────── cutoff) / staff ──┘                   a counter)
                                                cancels                                   │
                                                                                          └──► NO_SHOW
```

1. A citizen books a service at an open date and time; the request is **Pending**.
2. A department officer **approves** or **rejects** it (a rejection needs a reason). Officers can
   also **reschedule** it.
3. On the day, the officer **checks the citizen in** at the desk and a queue token is issued
   (for example `CRV-03`).
4. The officer **calls the next citizen** to a counter, then marks the service **Completed** or
   **No-show**.
5. Every step is recorded in the **audit log** and pushed live to the pages that show it.

---

## 4. Functional requirements

Requirement IDs are stable so they can be referenced from tests and change requests.

### 4.1 Authentication and accounts

| ID | Requirement |
|---|---|
| FR-AUTH-01 | A visitor can register as a citizen with full name, Ethiopian mobile number (`+2519XXXXXXXX`; `09…`, `9…` and `251…` forms are normalized) and password; email and address are optional. |
| FR-AUTH-02 | A phone number or email can belong to only one account. |
| FR-AUTH-03 | Citizens sign in with phone number and password; staff sign in with email (or phone) and password. |
| FR-AUTH-04 | After 5 failed sign-in attempts for the same phone or email, that identifier is locked for 15 minutes. |
| FR-AUTH-05 | Signing out revokes the session on the server, so the old token can no longer be used. |
| FR-AUTH-06 | Each role is taken to its own portal after sign-in (`/citizen`, `/officer`, `/admin`). |

### 4.2 Public pages

| ID | Requirement |
|---|---|
| FR-PUB-01 | Visitors can browse active departments and public services (fee, processing time, required documents). |
| FR-PUB-02 | Anyone can track an appointment by reference number or phone number and see its stage (Submitted, Approved, Checked In, In Progress, Delivered); personal contact details are not shown. |
| FR-PUB-03 | Booking requires signing in; open dates and times can be viewed before signing in. |

### 4.3 Citizen: booking (Appointment page)

| ID | Requirement |
|---|---|
| FR-BOOK-01 | The citizen sees the bookable services (with daily capacity and today's availability) and opens a booking form with **Book Slot**. |
| FR-BOOK-02 | The form offers only dates and times allowed by the schedule; each time shows whether it is free and the citizen's expected order in the queue. |
| FR-BOOK-03 | A booking is always made under the full name and phone number of the citizen's account. |
| FR-BOOK-04 | The server refuses a booking in the past, outside working days or hours, in the lunch break, off the time grid, on a calendar-exception date, on a full time slot, or beyond the service's or department's daily capacity. |
| FR-BOOK-05 | Each booking gets a reference number `WRD-YYYYMMDD-NNNN` and starts as **Pending**. |
| FR-BOOK-06 | If **today** is closed by a calendar exception for the service, **Book Slot** shows a notice only and does not open the form. |
| FR-BOOK-07 | When **Confirm Booking** is clicked, the date is re-checked against the latest calendar exceptions from the server; a closed date is refused with a notice that names the exception and stays visible for 6 seconds. The same notice appears when the citizen picks a closed date or when the administrator closes the selected date while the form is open. |
| FR-BOOK-08 | **My Appointments** lists the citizen's appointments, newest booking first; after a booking the list returns to page 1 so the new booking is the first row. It has a search box and service and status filters. |
| FR-BOOK-09 | A citizen can cancel a **Pending** appointment, and an **Approved** one up to the cancellation cutoff before its time (see BR-06). A refusal shows the server's reason. A cancelled appointment shows **Cancelled** in red in the Action column. |
| FR-BOOK-10 | A printable appointment slip (reference, room, required documents, instructions) is available to the appointment's owner, the responsible officer and the administrator only. |

### 4.4 Citizen: My Queue

| ID | Requirement |
|---|---|
| FR-QUEUE-01 | My Queue lists the citizen's appointments **from today onward** (pending, approved, checked in, at the counter and finished), sorted by date and time. |
| FR-QUEUE-02 | Each row shows the citizen, service and department, appointment date and time, queue position, people ahead, people behind, request time, status and action. |
| FR-QUEUE-03 | **People ahead / behind** count the other bookings for the same service on the same date that the department has **approved** and that are still in the queue, by appointment time; pending requests are not counted until approved. Served and cancelled rows show "—". |
| FR-QUEUE-04 | Each appointment that is still ahead (pending, approved or checked in) shows a **live countdown** to its start time, ticking every second; a pending one is drawn dashed and labelled "awaiting approval". The same countdown appears on the Appointment page. |
| FR-QUEUE-05 | When the citizen is called to a counter, a banner shows **"It's your turn! Please proceed to Counter Desk #N"**; when the service is completed, a notice confirms it. |
| FR-QUEUE-06 | My Queue has a search box (service, department, reference, time, status) and **All Services / All Statuses** filters, with a "Clear filters" option when nothing matches. |
| FR-QUEUE-07 | Approvals, check-ins, calls and completions appear on My Queue without reloading the page. |

### 4.5 Department officer

| ID | Requirement |
|---|---|
| FR-OFF-01 | An officer sees and acts on appointments of their own department and assigned services only. |
| FR-OFF-02 | An officer can approve or reject (with a reason) a **Pending** appointment; other rows show "Decided", or **Cancelled** in red when cancelled. |
| FR-OFF-03 | An officer can reschedule an appointment to another valid date and time (all booking rules apply) and cancel pending or approved appointments. |
| FR-OFF-04 | An officer can check in an **Approved** appointment at the desk, which issues the next queue token for the department and day. |
| FR-OFF-05 | An officer can call the next waiting citizen to a numbered counter and mark the service **Completed** or **No-show**; completing twice records it once. |
| FR-OFF-06 | An officer can view outcome reports and export the appointment registry (CSV) for their own department. |

### 4.6 Administrator

| ID | Requirement |
|---|---|
| FR-ADM-01 | **Account Provision:** create, edit, activate/deactivate and delete staff accounts. An officer must be assigned to a department and at least one service of that department. |
| FR-ADM-02 | **Citizen Management:** browse and search registered citizens with location filters (cursor-based pages). |
| FR-ADM-03 | **Department Management:** create, edit, activate/deactivate and delete departments (unique code, room, contact phone). |
| FR-ADM-04 | **Service Management:** create, edit, activate/deactivate and delete services (code, department, duration, daily quota, fee, processing time, required documents). |
| FR-ADM-05 | **System settings:** woreda name, region, hotline, emergency phone, maximum parallel bookings per time slot and cancellation cutoff (hours), plus stored options listed in [Known gaps](#7-known-gaps). |
| FR-ADM-06 | **Reports:** appointment outcome summary for Today, This Week or This Month (optionally per department), a geographical breakdown, and a CSV export of the appointment registry. |

### 4.7 Schedule Management (administrator only)

| ID | Requirement |
|---|---|
| FR-SCH-01 | **Operating Hours:** set working days (Monday to Sunday), opening and closing times, an optional lunch break, the appointment slot length (5 to 240 minutes) and the effective date range. |
| FR-SCH-02 | Set a default daily appointment capacity and a separate **daily capacity per service**; bookings stop automatically when a capacity is reached. |
| FR-SCH-03 | **Calendar Exceptions:** add public holidays, non-working days, blocked dates and exceptional working days, for a single date or a date range of up to 366 days, with a title and description. |
| FR-SCH-04 | An exception applies to **all departments**, **one department** or **selected departments**. |
| FR-SCH-05 | An exceptional working day must specify its own opening and closing times and daily capacity. |
| FR-SCH-06 | Every schedule change and every deletion asks for confirmation; before a working schedule is changed or an exceptional working day is removed, the confirmation shows the existing bookings it affects. |
| FR-SCH-07 | Existing approved appointments are never silently deleted when a schedule changes. |

### 4.8 Audit Logs (administrator)

| ID | Requirement |
|---|---|
| FR-AUD-01 | The system records every appointment event: **Appointment Requested** (citizen books; status Pending), **Approved**, **Rejected** (with reason), **Rescheduled**, **Cancelled** (by citizen or staff), **Completed Service** and **No-show**. |
| FR-AUD-02 | Each entry stores the exact date and time, who performed it (name and role), the citizen, service and department, the reason, and a **Before / After** snapshot of status, date and time. |
| FR-AUD-03 | The Audit Logs page shows, in order: Citizen, Performed By, Service, Action, Before, After, Date & Time. The changed values are highlighted in the After column. |
| FR-AUD-04 | The log is filtered by action, department and search text (citizen, officer, reference, service, department). |
| FR-AUD-05 | The log is paged on the server with a keyset cursor, **5 entries per page**, newest first; a page keeps the same entries while new ones arrive, and Previous always returns to the newest entries. |
| FR-AUD-06 | New entries appear without reloading the page. |

---

## 5. Non-functional requirements

### 5.1 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | Passwords are stored as bcrypt hashes and must be at least 8 characters with a digit or symbol. |
| NFR-SEC-02 | Sessions use a signed JWT (HS256) in an **HttpOnly** cookie (`Secure` in production, `SameSite=Lax`); a Bearer token is also accepted for API clients. |
| NFR-SEC-03 | State-changing requests made with the session cookie require a matching CSRF token (double-submit cookie) and an allowed `Origin`. |
| NFR-SEC-04 | Every endpoint enforces role, department, service and ownership rules on the server (CASL); a citizen can never read or change another citizen's data. |
| NFR-SEC-05 | All request bodies and query strings are validated with Zod; invalid input gets `422` with field-level messages and never reaches the database. All SQL uses parameters. |
| NFR-SEC-06 | Requests are rate-limited per IP (5 per second with a burst of 50; sign-in and registration 20 per minute with a burst of 10). |
| NFR-SEC-07 | Security headers are set with Helmet; request bodies are limited to 1 MB; CORS allows only the configured web origins. |
| NFR-SEC-08 | Public responses (tracking, availability) expose no personal contact details. |
| NFR-SEC-09 | Sessions do not expire on inactivity (by design, for shared desk computers); they end on sign-out, which revokes the token. |

### 5.2 Data integrity and concurrency

| ID | Requirement |
|---|---|
| NFR-INT-01 | A time slot can never be booked twice and capacities can never be exceeded, even under simultaneous requests (bookings for a service and day are serialized with a database advisory lock inside a transaction). |
| NFR-INT-02 | Status changes are atomic and conditional (for example, a cancel and a check-in at the same moment cannot both succeed). |
| NFR-INT-03 | Audit entries are only ever added, never edited or deleted. |
| NFR-INT-04 | Schema changes are versioned migrations; every migration has a reversible `down` step. |

### 5.3 Performance and scalability

| ID | Requirement |
|---|---|
| NFR-PERF-01 | Long lists (audit log, citizens, staff, departments, services) are paged on the server; the audit log uses keyset pagination so pages stay fast as the log grows. |
| NFR-PERF-02 | Lookups used by lists and the queue are backed by database indexes (for example audit log by time, action and department). |
| NFR-PERF-03 | Live countdowns update only their own element each second, without re-rendering the surrounding table. |

### 5.4 Real-time behaviour and reliability

| ID | Requirement |
|---|---|
| NFR-RT-01 | Changes (bookings, decisions, check-ins, calls, completions, catalog and schedule edits, audit entries) are pushed to open pages over a WebSocket and appear within about a second. |
| NFR-RT-02 | The WebSocket reconnects automatically with backoff; after reconnecting, pages reload the data they may have missed. Pages that show live queues also refresh on a short timer as a fallback. |
| NFR-RT-03 | Rules that matter (booking, cancellation, calendar exceptions) are always enforced on the server, so a page that missed a live update can never complete a forbidden action. |
| NFR-RT-04 | Countdowns use the server's clock, so a citizen device with a wrong clock still shows the correct time left. |
| NFR-REL-01 | Recording an audit entry or sending a live notice never makes the user's action fail; such errors are logged instead. |
| NFR-REL-02 | The server refuses to start without a migrated database and shuts down gracefully on `SIGINT`/`SIGTERM`. |

### 5.5 Usability and accessibility

| ID | Requirement |
|---|---|
| NFR-UX-01 | Every page works at phone width (no sideways page scrolling) and at a standard 1440 px desktop width without hiding table columns. |
| NFR-UX-02 | Error and success messages are plain-language toasts; calendar-exception notices stay visible for 6 seconds. |
| NFR-UX-03 | Status is shown with consistent colours and labels across pages (Pending, Approved, Waiting, Now Serving, Served, Cancelled, No-show). |
| NFR-UX-04 | Timers are exposed to screen readers as readable text (for example "1 hour 23 minutes until your appointment") and animations respect the reduced-motion preference. |

### 5.6 Localization

| ID | Requirement |
|---|---|
| NFR-L10N-01 | All dates and times are woreda time (`Africa/Addis_Ababa`, UTC+3), whatever the device's time zone. |
| NFR-L10N-02 | Phone numbers follow the Ethiopian mobile format `+2519XXXXXXXX`. |

### 5.7 Maintainability and operability

| ID | Requirement |
|---|---|
| NFR-MNT-01 | The API keeps a strict layering (routes, middleware, controllers, services, repositories) and a single response envelope `{ success, message, data, meta }`. |
| NFR-MNT-02 | Logs are structured JSON (pino) with a request ID on every request. |
| NFR-MNT-03 | Configuration comes from environment variables with development defaults (see `server/.env.example` and `client/.env.example`). |
| NFR-MNT-04 | Automated tests (`npm test` in `server/`) cover validation, authorization, scheduling rules, queue logic and, against a disposable PostgreSQL database, the main end-to-end regressions. |

---

## 6. Business rules

| ID | Rule |
|---|---|
| BR-01 | Only the administrator can create, update or delete schedules, calendar exceptions, departments, services and staff accounts. |
| BR-02 | Bookings must follow the operating hours, slot grid, lunch break, availability and daily capacities; the backend validates every rule before accepting a booking or reschedule. |
| BR-03 | Calendar exceptions override normal availability: a **blocked** date is always closed; a **public holiday** or **non-working day** closes the date; an **exceptional working day** re-opens it with its own hours and capacity. |
| BR-04 | A booking for a service that has no department, or whose service or department is inactive, is refused. |
| BR-05 | A rejection must include a reason. |
| BR-06 | A citizen may cancel a **Pending** appointment at any time, and an **Approved** one up to the cancellation cutoff (Settings, default 4 hours) before its start; once checked in it can no longer be cancelled by the citizen. Officers and the administrator can cancel pending or approved appointments at any time. A cancelled appointment frees its time slot. |
| BR-07 | Only **Approved** appointments can be checked in; only checked-in or approved appointments can be completed or marked no-show. |
| BR-08 | Queue tokens are numbered per department and day (`{DEPT_CODE}-NN`). |
| BR-09 | Existing approved appointments are never silently deleted when schedules change. |

---

## 7. Known gaps

Items from the specification that the current build does not yet meet, so they are not mistaken
for working features:

| Area | Gap |
|---|---|
| Schedules | Only **one working schedule** for the whole woreda can exist; the specification asks for separate operating hours per department. |
| Schedules | The specification gives Department Heads **read-only** access to their department's schedule; currently Schedule Management is visible to the administrator only. |
| Schedules | The specification lists separate "Appointment Availability" and "Daily Appointment Capacity" pages; capacity is currently set inside Operating Hours. |
| Schedules | The specification asks for a **monthly and weekly calendar view** of open and closed days; the API provides the data (`GET /schedules/calendar`) but no page shows it yet. |
| Settings | **Auto-approve bookings**, **advance booking days** and **SMS gateway** are stored but not yet enforced or connected. |
| Security | The CSV export quotes fields correctly but does not neutralize spreadsheet formulas (a value starting with `=`, `+`, `-` or `@`). |
| Layout | On the officer's **Appointments** page the Action column needs horizontal scrolling at 1440 px. |
| Navigation | Some pages exist without a sidebar entry: admin Appointments, Reports and Settings; officer Verify and Reports; citizen Profile and Notifications. |
| Navigation | The API lets officers read the citizen directory for their department, but the officer link to it leads to an administrator-only page. |

---

## 8. Getting started

### Prerequisites

- Node.js 22 or newer
- PostgreSQL 13 or newer (developed and tested on 16)

### API (`server/`)

```bash
cd server
cp .env.example .env        # set DB_*, JWT_SECRET and the SEED_ADMIN_* values
npm install
npm run migrate             # create the database (if missing) and apply migrations
npm run seed                # create the first administrator
npm run dev                 # http://localhost:8080/api/v1
npm test                    # unit tests, plus integration tests when PostgreSQL is reachable
```

### Web client (`client/`)

```bash
cd client
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8080/api/v1
npm install
npm run dev                 # http://localhost:3000
npm run build               # production build in client/dist
```

Sign in at `http://localhost:3000` with the administrator from `SEED_ADMIN_*`, provision
department officers, set up departments, services and the working schedule, and citizens can
then register and book.
