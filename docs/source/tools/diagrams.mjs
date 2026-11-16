// Renders the documentation diagrams to SVG: Mermaid diagrams in headless Chrome, use case
// diagrams as hand-built SVG (Mermaid has no use case diagram type).
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../fig/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const MERMAID = new URL("./node_modules/mermaid/dist/mermaid.min.js", import.meta.url).pathname;

const D = {};

D["arch"] = `flowchart LR
  subgraph Client["Client tier: web browser"]
    SPA["React 19 single-page application<br/>Public, Citizen, Officer and Admin portals"]
  end
  subgraph App["Application tier: Node.js 22"]
    API["Express 5 REST API<br/>/api/v1"]
    WS["WebSocket hub<br/>/api/v1/ws"]
  end
  subgraph Data["Data tier"]
    DB[("PostgreSQL<br/>13 tables")]
  end
  SPA -- "HTTPS JSON requests<br/>(JWT cookie + CSRF token)" --> API
  WS -- "live change notices" --> SPA
  API -- "SQL (pg pool, transactions,<br/>advisory locks)" --> DB
  API -- "publish events" --> WS`;

D["layers"] = `flowchart TB
  R["Routes<br/>URL + HTTP method"] --> M["Middleware<br/>request id, logging, CORS, rate limit,<br/>JWT authentication, CSRF, CASL ability, Zod validation"]
  M --> C["Controllers<br/>read request, call service, send envelope"]
  C --> S["Services<br/>business rules, transactions, audit, events"]
  S --> P["Repositories<br/>parameterized SQL"]
  P --> DB[("PostgreSQL")]
  S --> E["Event service"] --> RT["Realtime service<br/>(WebSocket broadcast)"]`;

D["subsystems"] = `flowchart TB
  subgraph PRES["Presentation subsystems: client"]
    direction LR
    PUB["Public portal"]
    CIT["Citizen portal"]
    OFF["Officer service desk"]
    ADM["Administration console"]
  end
  SHARED["Shared client layer: API client, realtime client, store, UI components"]
  SEC["Security middleware: JWT, CSRF, CASL, rate limit, Zod validation"]
  subgraph APP["Application subsystems: server"]
    direction LR
    AUTH["Authentication and sessions"]
    CAT["Catalog"]
    SCH["Scheduling"]
    APPT["Appointments"]
    QUE["Desk queue"]
    REP["Reporting"]
    AUD["Audit trail"]
    USR["Staff, citizens, settings"]
  end
  EVT["Events and realtime (WebSocket)"]
  PG[("PostgreSQL")]
  PRES --> SHARED
  SHARED -- "REST /api/v1" --> SEC
  SEC --> APP
  APP --> PG
  APP --> EVT
  EVT -- "live notices" --> SHARED`;

D["deploy"] = `flowchart LR
  subgraph DEV1["Citizen / staff device"]
    BR["Web browser<br/>(desktop or mobile)"]
  end
  subgraph WEB["Web server"]
    STATIC["Static files of the React build<br/>(client/dist)"]
  end
  subgraph APPSRV["Application server"]
    NODE["Node.js 22 process<br/>Express API + WebSocket<br/>(server.js)"]
  end
  subgraph DBSRV["Database server"]
    PGS[("PostgreSQL")]
  end
  BR -- "HTTPS: HTML, JS, CSS" --> STATIC
  BR -- "HTTPS REST /api/v1<br/>WSS /api/v1/ws" --> NODE
  NODE -- "TCP 5432" --> PGS`;

D["states"] = `stateDiagram-v2
  direction LR
  [*] --> PENDING: citizen books
  PENDING --> APPROVED: officer approves
  PENDING --> REJECTED: officer rejects (reason)
  PENDING --> CANCELLED: citizen or staff cancels
  APPROVED --> CANCELLED: citizen (before cutoff)\\nor staff cancels
  APPROVED --> APPROVED: rescheduled
  APPROVED --> CHECKED_IN: officer checks in\\n(queue token issued)
  CHECKED_IN --> IN_PROGRESS: officer calls next\\n(counter assigned)
  IN_PROGRESS --> COMPLETED: complete service
  IN_PROGRESS --> NO_SHOW: no-show
  CHECKED_IN --> COMPLETED: complete service
  APPROVED --> COMPLETED: complete service
  REJECTED --> [*]
  CANCELLED --> [*]
  COMPLETED --> [*]
  NO_SHOW --> [*]`;

D["seq-book"] = `sequenceDiagram
  autonumber
  actor C as Citizen
  participant UI as Web client
  participant API as Express API
  participant AS as AppointmentService
  participant DB as PostgreSQL
  participant RT as Event / Realtime
  C->>UI: Confirm Booking
  UI->>API: GET /schedules/active-exceptions
  API-->>UI: exceptions
  alt date closed by an exception
    UI-->>C: 6-second notice
  else date open
    UI->>API: POST /appointments
    API->>API: JWT, CASL, Zod checks
    API->>AS: book(caller, request)
    AS->>DB: BEGIN, advisory lock
    AS->>DB: schedule and exceptions
    AS->>DB: count bookings
    alt a rule is broken
      AS-->>API: 422 / 409 reason
      API-->>UI: error envelope
      UI-->>C: reason
    else all rules pass
      AS->>DB: INSERT PENDING, COMMIT
      AS->>DB: INSERT audit (BOOKED)
      AS->>RT: publish appointment.booked
      RT-->>UI: appointments.changed
      AS-->>API: appointment
      API-->>UI: 201 Created
      UI-->>C: booking in the first row
    end
  end`;

D["seq-approve"] = `sequenceDiagram
  autonumber
  actor O as Department officer
  participant OUI as Officer web client
  participant API as Express API
  participant AS as AppointmentService
  participant DB as PostgreSQL
  participant RT as Event / Realtime
  participant CUI as Citizen web client (My Queue)
  O->>OUI: Approve
  OUI->>API: PATCH /appointments/:id/status
  API->>API: JWT, CSRF, CASL checks
  API->>AS: review(caller, id, decision)
  AS->>DB: load, check scope
  AS->>DB: UPDATE to APPROVED if PENDING
  AS->>DB: INSERT audit (APPROVED)
  AS->>RT: publish events
  RT-->>OUI: appointments.changed
  RT-->>CUI: appointments.changed
  CUI->>API: GET /queue/me
  API-->>CUI: position, ahead / behind
  CUI-->>CUI: row shows Approved
  API-->>OUI: 200 OK`;

D["seq-desk"] = `sequenceDiagram
  autonumber
  actor O as Department officer
  participant OUI as Officer web client
  participant API as Express API
  participant QS as QueueService
  participant DB as PostgreSQL
  participant RT as Event / Realtime
  participant CUI as Citizen web client
  O->>OUI: check citizen in
  OUI->>API: POST /queue/verify-checkin
  API->>QS: checkIn(officer, request)
  QS->>DB: BEGIN, lock, count tokens
  QS->>DB: CHECKED_IN, token CRV-03
  QS->>RT: publish appointment.checked_in
  O->>OUI: Call next to counter N
  OUI->>API: POST /queue/call-next
  API->>QS: callNext(officer, counter)
  QS->>DB: claim next WAITING token
  QS->>RT: publish appointment.in_progress
  RT-->>CUI: appointments.changed
  CUI-->>CUI: "It's your turn" banner
  O->>OUI: Complete Service
  OUI->>API: PATCH /queue/:id/status
  API->>QS: finalize(officer, id, COMPLETED)
  QS->>DB: COMPLETED (idempotent)
  QS->>DB: INSERT audit (COMPLETED)
  QS->>RT: publish appointment.completed
  RT-->>CUI: appointments.changed (row shows Served)`;

D["act-book"] = `%%{init: {"flowchart": {"rankSpacing": 28, "nodeSpacing": 28}}}%%
flowchart TB
  S((Start)) --> A[Sign in, open the Appointment page,<br/>tap Book Slot on a service]
  A --> D{Today closed by a<br/>calendar exception?}
  D -- yes --> D1[6-second notice,<br/>form stays closed] --> E1((End))
  D -- no --> F[Form opens: pick a date]
  F --> H{Date closed or not<br/>a working day?}
  H -- yes --> H1[Notice shown] --> F
  H -- no --> I[Pick a free time,<br/>Confirm Booking]
  I --> L{Server re-checks exceptions,<br/>hours, capacity, free slot}
  L -- fails --> L1[Server reason shown] --> F
  L -- passes --> M[Pending appointment created,<br/>audit entry, live notice]
  M --> N[Shown in the first row<br/>with a live countdown]
  N --> E2((End))`;

D["act-desk"] = `%%{init: {"flowchart": {"rankSpacing": 28, "nodeSpacing": 28}}}%%
flowchart TB
  S((Start)) --> A[Officer reviews a Pending request]
  A --> B{Request valid?}
  B -- no --> B1[Reject with a reason] --> E1((End))
  B -- yes --> B2[Approve]
  B2 --> C[Citizen arrives: officer checks in,<br/>queue token issued]
  C --> F[Officer calls next to a counter]
  F --> G{Citizen present?}
  G -- no --> G1[Mark No-show] --> E2((End))
  G -- yes --> H[Serve the citizen,<br/>Complete Service]
  H --> J[Served: audit entry,<br/>citizen notified live]
  J --> E3((End))`;

D["nav"] = `flowchart TB
  L["/login: Sign in"]
  subgraph PUBLIC["Public pages"]
    direction TB
    R["/register"] --- SV["/services"] --- DP["/departments"] --- TR["/track"] --- AB["/about, /contact"]
  end
  subgraph CITIZEN["Citizen portal"]
    direction TB
    CB["/citizen/book: Appointment"] --> CF["Booking form (Book Slot)"]
    CB <--> CQ["/citizen/queue: My Queue"]
  end
  subgraph OFFICER["Officer service desk"]
    direction TB
    OA["/officer/appointments: Appointment"] <--> OQ["/officer/queue: Queue"]
  end
  subgraph ADMIN["Administration console"]
    direction TB
    AP["/admin/account-provision"] --- AC["/admin/citizens"] --- AD["/admin/departments"] --- AS["/admin/services"] --- AH["/admin/schedule/hours"] --- AE["/admin/schedule/exceptions"] --- AU["/admin/audit"]
  end
  L --- PUBLIC
  L -- "citizen" --> CB
  L -- "officer" --> OA
  L -- "administrator" --> AP`;

D["er"] = `erDiagram
  departments ||--o{ services : "offers"
  departments ||--o{ users : "employs (officers)"
  departments ||--o{ appointments : "receives"
  services ||--o{ appointments : "is booked as"
  departments |o--o{ schedules : "may have"
  schedules ||--o{ schedule_service_capacities : "sets"
  services ||--o{ schedule_service_capacities : "limited by"
  calendar_exceptions ||--o{ calendar_exception_departments : "scoped to"
  departments ||--o{ calendar_exception_departments : "affected by"
  appointments ||--o| queue_tokens : "gets"
  users ||..o{ appointments : "books (citizen_id, no FK)"
  appointments ||..o{ audit_logs : "recorded in (no FK)"
  departments { text id PK
    text code UK
    text name
    text building_room
    text contact_phone
    boolean is_active }
  services { text id PK
    text department_id FK
    text code UK
    text name
    int duration_minutes
    int daily_quota
    numeric fee_etb
    text_array required_documents
    boolean is_active }
  users { text id PK
    text full_name
    text email
    text phone
    text password_hash
    text national_id UK
    text role
    text department_id FK
    text address
    boolean is_active }
  appointments { text id PK
    text reference_number UK
    text citizen_id
    text department_id FK
    text service_id FK
    date date
    text time_slot
    text status
    text token_number
    text rejection_reason
    timestamptz created_at }
  queue_tokens { text id PK
    text appointment_id FK
    text token_number
    text department_id
    int counter_number
    text status
    time checked_in_time
    date queue_date }
  schedules { text id PK
    text department_id FK
    text_array working_days
    time opening_time
    time closing_time
    time lunch_start
    time lunch_end
    int slot_interval_minutes
    int daily_capacity
    text status }
  schedule_service_capacities { text schedule_id PK
    text service_id PK
    int daily_capacity }
  calendar_exceptions { text id PK
    text type
    text title
    date start_date
    date end_date
    text scope
    int daily_capacity }
  calendar_exception_departments { text exception_id PK
    text department_id PK }
  audit_logs { text id PK
    timestamptz at
    text action
    text actor_name
    text actor_role
    text appointment_id
    jsonb before_snapshot
    jsonb after_snapshot }
  system_settings { text id PK
    text woreda_name
    int cancellation_cutoff_hours
    int max_parallel_slots
    boolean auto_approve_bookings }
  revoked_tokens { text jti PK
    timestamptz expires_at }
  login_failures { text email PK
    int failures
    timestamptz expires_at }`;

D["classes"] = `classDiagram
  direction TB
  class Department {
    +id: string
    +code: string
    +name: string
    +buildingRoom: string
    +isActive: boolean
  }
  class PublicService {
    +id: string
    +name: string
    +dailyQuota: int
    +feeETB: number
    +requiredDocuments: string[]
  }
  class User {
    +id: string
    +fullName: string
    +phone: string
    +role: Role
    +serviceIds: string[]
  }
  class Appointment {
    +referenceNumber: string
    +date: string
    +timeSlot: string
    +status: Status
    +book()
    +review()
    +reschedule()
    +cancel()
  }
  class QueueToken {
    +tokenNumber: string
    +counterNumber: int
    +status: TokenStatus
    +checkIn()
    +callNext()
    +finalize()
  }
  class Schedule {
    +workingDays: string[]
    +openingTime: string
    +closingTime: string
    +lunchStart: string
    +slotIntervalMinutes: int
    +dailyCapacity: int
  }
  class ServiceCapacity {
    +dailyCapacity: int
  }
  class CalendarException {
    +type: ExceptionType
    +startDate: string
    +endDate: string
    +scope: Scope
  }
  class AuditEntry {
    +at: timestamp
    +action: string
    +actorRole: string
    +before: Snapshot
    +after: Snapshot
  }
  class SystemSettings {
    +woredaName: string
    +cancellationCutoffHours: int
    +maxParallelSlots: int
  }
  Department "1" --> "*" PublicService : offers
  Department "1" --> "*" User : employs
  User "1" --> "*" Appointment : books
  PublicService "1" --> "*" Appointment : booked as
  Appointment "1" --> "0..1" QueueToken : checked in as
  Schedule "1" --> "*" ServiceCapacity : sets
  PublicService "1" --> "*" ServiceCapacity : limited by
  CalendarException "*" --> "*" Department : scoped to
  Appointment "1" ..> "*" AuditEntry : recorded in`;

D["errors"] = `classDiagram
  direction LR
  class Error
  class AppError {
    +status: int
    +code: string
    +details: object[]
  }
  class ValidationError {
    422 VALIDATION_ERROR
    +add(field, issue)
    +throwIfAny()
  }
  class BadRequestError { 400 }
  class UnauthorizedError { 401 }
  class ForbiddenError { 403 }
  class NotFoundError { 404 }
  class ConflictError { 409 }
  class SlotFullError { 409 }
  class DailyCapacityError { 409 DAILY_CAPACITY_REACHED }
  class DepartmentCapacityError { 409 DEPARTMENT_CAPACITY_REACHED }
  class TooManyAttemptsError { 429 }
  Error <|-- AppError
  AppError <|-- ValidationError
  AppError <|-- BadRequestError
  AppError <|-- UnauthorizedError
  AppError <|-- ForbiddenError
  AppError <|-- NotFoundError
  AppError <|-- ConflictError
  AppError <|-- SlotFullError
  AppError <|-- DailyCapacityError
  AppError <|-- DepartmentCapacityError
  AppError <|-- TooManyAttemptsError`;

D["packages"] = `flowchart TB
  subgraph SERVER["server/ (API)"]
    direction TB
    routes --> middleware & validations & controllers
    middleware --> security
    controllers --> services
    services --> repositories & models & utils
    repositories --> config
    repositories --> models
    services --> config
  end
  subgraph CLIENT["client/ (web)"]
    direction TB
    pages --> layout & components & features & context & api & hooks & cutils["utils"]
    layout --> components
    context["context (Zustand store)"] --> api
    cservices["services"] --> api
    api["api (REST + realtime)"] --> cutils
  end
  api -. "HTTPS REST / WebSocket" .-> routes`;

// ---------------- use case diagrams (hand-built SVG) ----------------
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function actor(x, y, name) {
  return `<g font-family="Arial, Helvetica, sans-serif" stroke="#1f2937" fill="none" stroke-width="2">
    <circle cx="${x}" cy="${y}" r="12"/><line x1="${x}" y1="${y + 12}" x2="${x}" y2="${y + 45}"/>
    <line x1="${x - 20}" y1="${y + 24}" x2="${x + 20}" y2="${y + 24}"/>
    <line x1="${x}" y1="${y + 45}" x2="${x - 16}" y2="${y + 72}"/><line x1="${x}" y1="${y + 45}" x2="${x + 16}" y2="${y + 72}"/>
    <text x="${x}" y="${y + 92}" text-anchor="middle" stroke="none" fill="#111827" font-size="14" font-weight="700">${esc(name)}</text></g>`;
}
function useCaseSVG({ width, height, title, actors, cases, links, boundary }) {
  const parts = [];
  parts.push(`<rect x="${boundary.x}" y="${boundary.y}" width="${boundary.w}" height="${boundary.h}" fill="#f8fafc" stroke="#334155" stroke-width="1.5" rx="6"/>`);
  parts.push(`<text x="${boundary.x + boundary.w / 2}" y="${boundary.y + 24}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#0f172a">${esc(title)}</text>`);
  const pos = {};
  for (const c of cases) pos[c.id] = c;
  for (const a of actors) pos[a.id] = { ...a, anchorY: a.y + 30 };
  for (const [from, to, label] of links) {
    const a = pos[from], c = pos[to];
    const ax = a.side === "left" ? a.x + 22 : a.x - 22;
    const cx = a.side === "left" ? c.x - c.rx : c.x + c.rx;
    parts.push(`<line x1="${ax}" y1="${a.anchorY}" x2="${cx}" y2="${c.y}" stroke="#64748b" stroke-width="1.2"/>`);
  }
  for (const c of cases) {
    parts.push(`<ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx}" ry="24" fill="#ffffff" stroke="#1e3a8a" stroke-width="1.5"/>`);
    const lines = c.label.split("\n");
    lines.forEach((l, i) => parts.push(`<text x="${c.x}" y="${c.y + 5 + (i - (lines.length - 1) / 2) * 15}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#0f172a">${esc(l)}</text>`));
  }
  for (const a of actors) parts.push(actor(a.x, a.y, a.name));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${parts.join("")}</svg>`;
}

const ucCitizen = useCaseSVG({
  width: 900, height: 640, title: "WoredaCare: visitor and citizen use cases",
  boundary: { x: 190, y: 20, w: 520, h: 600 },
  actors: [
    { id: "visitor", name: "Visitor", x: 80, y: 90, side: "left" },
    { id: "citizen", name: "Citizen", x: 80, y: 380, side: "left" },
    { id: "officer", name: "Dept. Officer", x: 820, y: 420, side: "right" },
  ],
  cases: [
    { id: "register", label: "Register account", x: 450, y: 80, rx: 120 },
    { id: "browse", label: "Browse services\nand departments", x: 450, y: 140, rx: 120 },
    { id: "track", label: "Track appointment", x: 450, y: 200, rx: 120 },
    { id: "signin", label: "Sign in / sign out", x: 450, y: 260, rx: 120 },
    { id: "book", label: "Book appointment", x: 450, y: 320, rx: 120 },
    { id: "myappts", label: "View and filter\nMy Appointments", x: 450, y: 380, rx: 120 },
    { id: "cancel", label: "Cancel appointment", x: 450, y: 440, rx: 120 },
    { id: "queue", label: "Follow My Queue\n(live position, countdown)", x: 450, y: 500, rx: 135 },
    { id: "slip", label: "View appointment slip", x: 450, y: 560, rx: 120 },
  ],
  links: [
    ["visitor", "register"], ["visitor", "browse"], ["visitor", "track"], ["visitor", "signin"],
    ["citizen", "signin"], ["citizen", "book"], ["citizen", "myappts"], ["citizen", "cancel"], ["citizen", "queue"], ["citizen", "slip"],
    ["officer", "queue"], ["officer", "slip"],
  ],
});
const ucStaff = useCaseSVG({
  width: 900, height: 700, title: "WoredaCare: department officer and administrator use cases",
  boundary: { x: 190, y: 20, w: 520, h: 660 },
  actors: [
    { id: "officer", name: "Dept. Officer", x: 80, y: 170, side: "left" },
    { id: "admin", name: "Administrator", x: 820, y: 360, side: "right" },
    { id: "citizen", name: "Citizen", x: 80, y: 520, side: "left" },
  ],
  cases: [
    { id: "review", label: "Approve / reject\nappointment", x: 450, y: 80, rx: 120 },
    { id: "resched", label: "Reschedule or cancel\nappointment", x: 450, y: 140, rx: 125 },
    { id: "checkin", label: "Check in citizen\n(issue queue token)", x: 450, y: 200, rx: 125 },
    { id: "call", label: "Call next, complete\nor mark no-show", x: 450, y: 260, rx: 125 },
    { id: "reports", label: "View reports,\nexport CSV", x: 450, y: 320, rx: 120 },
    { id: "staff", label: "Provision staff accounts", x: 450, y: 380, rx: 130 },
    { id: "citizens", label: "Browse citizen directory", x: 450, y: 440, rx: 130 },
    { id: "catalog", label: "Manage departments\nand services", x: 450, y: 500, rx: 125 },
    { id: "schedule", label: "Manage operating hours\nand capacities", x: 450, y: 560, rx: 135 },
    { id: "exceptions", label: "Manage calendar\nexceptions", x: 450, y: 620, rx: 120 },
    { id: "audit", label: "View audit logs", x: 600, y: 660, rx: 80 },
  ],
  links: [
    ["officer", "review"], ["officer", "resched"], ["officer", "checkin"], ["officer", "call"], ["officer", "reports"],
    ["admin", "resched"], ["admin", "reports"], ["admin", "staff"], ["admin", "citizens"], ["admin", "catalog"], ["admin", "schedule"], ["admin", "exceptions"], ["admin", "audit"],
    ["citizen", "checkin"],
  ],
});
writeFileSync(`${OUT}uc-citizen.svg`, ucCitizen);
writeFileSync(`${OUT}uc-staff.svg`, ucStaff);
console.log("saved uc-citizen, uc-staff");

// ---------------- Mermaid ----------------
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body><div id="host"></div></body></html>`);
  await page.addScriptTag({ path: MERMAID });
  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false, theme: "base", securityLevel: "loose",
      fontFamily: "Arial, Helvetica, sans-serif",
      themeVariables: {
        primaryColor: "#eef2ff", primaryBorderColor: "#1e3a8a", primaryTextColor: "#0f172a",
        lineColor: "#475569", secondaryColor: "#f1f5f9", tertiaryColor: "#ffffff", fontSize: "15px",
        clusterBkg: "#f8fafc", clusterBorder: "#94a3b8", noteBkgColor: "#fef9c3",
        actorBkg: "#eef2ff", actorBorder: "#1e3a8a", signalColor: "#334155", signalTextColor: "#0f172a",
      },
      htmlLabels: false, flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false },
      sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 24, messageMargin: 28, boxMargin: 6, noteMargin: 6, wrap: false },
      er: { useMaxWidth: false }, class: { useMaxWidth: false }, state: { useMaxWidth: false },
    });
  });
  for (const [name, src] of Object.entries(D)) {
    const svg = await page.evaluate(async (id, code) => {
      const { svg } = await window.mermaid.render(id, code);
      return svg;
    }, `m_${name.replace(/[^a-z0-9]/gi, "_")}`, src).catch((e) => { throw new Error(`${name}: ${e.message}`); });
    writeFileSync(`${OUT}${name}.svg`, svg);
    console.log("saved", name);
  }
} finally {
  await browser.close();
}
