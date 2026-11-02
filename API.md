# Woreda Booking and Appointment Management System (WoredaCare)
## Production RESTful API Design Specification (`API.md`)

---

## 1. Architectural Standards & Conventions

This RESTful API is structured strictly around the **features, client workflows, role-based controls, and business logic** implemented in the client application.

### 1.1. Base URL & Protocol
- **Base Endpoint**: `https://api.woreda.gov.et/api/v1`
- **Transport Security**: TLS 1.3 Mandatory (HTTPS)
- **Standard Format**: `application/json; charset=utf-8`

### 1.2. Authentication & Authorization
- **Mechanism**: JWT Bearer Tokens in the standard HTTP header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **RBAC Roles**:
  - `CITIZEN`: Public self-service citizen actions
  - `OFFICER`: Departmental desk operations and counter queue management
  - `ADMIN`: Central woreda administrative governance

### 1.3. Standard Response Envelope

#### Success Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Resource retrieved successfully.",
  "data": {},
  "meta": {
    "timestamp": "2026-11-02T13:45:00+03:00",
    "version": "v1"
  }
}
```

#### Paginated Success Envelope
```json
{
  "success": true,
  "message": "List retrieved successfully.",
  "data": [],
  "meta": {
    "pagination": {
      "totalItems": 45,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "timestamp": "2026-11-02T13:45:00+03:00"
  }
}
```

#### Cursor-based Pagination Envelope (Used in Account Provisioning)
```json
{
  "success": true,
  "message": "Accounts retrieved successfully.",
  "data": [],
  "meta": {
    "cursor": {
      "current": 0,
      "pageSize": 5,
      "totalCount": 8,
      "hasPrev": false,
      "hasNext": true
    },
    "timestamp": "2026-11-02T13:45:00+03:00"
  }
}
```

#### Standard Error Envelope (`4xx`, `5xx`)
```json
{
  "success": false,
  "message": "Validation failed for the submitted fields.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "phone",
        "issue": "Phone number must match valid Ethiopian format (+2519XXXXXXXX)."
      }
    ]
  },
  "meta": {
    "timestamp": "2026-11-02T13:45:00+03:00",
    "requestId": "req-988319-a1"
  }
}
```

---

## 2. API Endpoints Catalog

---

### Module 1: Authentication & Authorization (`/auth`)

#### 1.1. Citizen Self-Registration
- **`POST /api/v1/auth/register`**
- **Access**: Public
- **Description**: Registers a new citizen account with their legal full name, verified phone number, national ID, and Kebele address.
- **Request Body**:
  ```json
  {
    "fullName": "Almaz Hailu Mengistu",
    "phone": "+251922112233",
    "email": "almaz@citizen.et",
    "nationalId": "ET-CIT-8841",
    "kebele": "Kebele 02",
    "houseNumber": "109",
    "password": "SecurePassword@123"
  }
  ```
- **Validation**:
  - `fullName`: Required, min 3 chars
  - `phone`: Required, valid Ethiopian phone format (`^\+2519\d{8}$`)
  - `nationalId`: Required, unique
  - `password`: Required, min 8 chars with symbols/digits
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Citizen account registered successfully.",
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "usr-citizen-2",
        "fullName": "Almaz Hailu Mengistu",
        "email": "almaz@citizen.et",
        "phone": "+251922112233",
        "nationalId": "ET-CIT-8841",
        "role": "CITIZEN",
        "address": "Kebele 02, House 109"
      }
    }
  }
  ```

#### 1.2. User Sign In
- **`POST /api/v1/auth/login`**
- **Access**: Public
- **Description**: Authenticates Citizen, Officer, or Admin credentials and returns access session.
- **Request Body**:
  ```json
  {
    "email": "admin@woreda.gov.et",
    "password": "Password@123",
    "role": "Central Administrator" // Optional client-side role context
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Authentication successful.",
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": "usr-admin",
        "fullName": "Ato Kibreab Demissie",
        "email": "admin@woreda.gov.et",
        "role": "ADMIN",
        "departmentId": null,
        "departmentName": "Woreda Central Administration"
      }
    }
  }
  ```

#### 1.3. Get Authenticated User Profile
- **`GET /api/v1/auth/me`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`
- **Response** (`200 OK`): User object with current role and department assignment.

#### 1.4. Logout
- **`POST /api/v1/auth/logout`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`
- **Response** (`200 OK`): Invalidates token session.

---

### Module 2: Citizen Profile Management (`/citizen/profile`)

#### 2.1. Get Citizen Profile
- **`GET /api/v1/citizen/profile`**
- **Access**: `CITIZEN`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "fullName": "Bekele Tadesse Wolde",
      "phone": "+251911889900",
      "email": "bekele@citizen.et",
      "nationalId": "ET-CIT-5582",
      "address": "Kebele 04, House No. 412"
    }
  }
  ```

#### 2.2. Update Citizen Profile
- **`PUT /api/v1/citizen/profile`**
- **Access**: `CITIZEN`
- **Request Body**:
  ```json
  {
    "fullName": "Bekele Tadesse Wolde",
    "phone": "+251911889900",
    "email": "bekele@citizen.et",
    "nationalId": "ET-CIT-5582",
    "address": "Kebele 04, House No. 412"
  }
  ```
- **Response** (`200 OK`): Updated profile confirmation.

---

### Module 3: Departments (`/departments`)

#### 3.1. List Municipal Departments
- **`GET /api/v1/departments`**
- **Access**: Public / Authenticated
- **Query Parameters**:
  - `isActive`: `true` | `false` (optional)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "dept-1",
        "name": "Kebele Administration & Vital Events",
        "code": "KBL",
        "description": "Citizen registration, residence identification, birth/marriage certificates.",
        "buildingRoom": "Building A, Ground Floor, Room 102",
        "contactPhone": "+251 11 551 2341",
        "isActive": true,
        "officerCount": 4,
        "serviceCount": 4
      }
    ]
  }
  ```

#### 3.2. Create Department
- **`POST /api/v1/departments`**
- **Access**: `ADMIN`
- **Request Body**:
  ```json
  {
    "name": "Health & Social Affairs",
    "code": "HLT",
    "description": "Primary healthcare registrations and medical certifications.",
    "buildingRoom": "Building B, Room 104",
    "contactPhone": "+251 11 552 4433"
  }
  ```
- **Response** (`201 Created`)

#### 3.3. Update Department
- **`PUT /api/v1/departments/{id}`**
- **Access**: `ADMIN`
- **Request Body**: Partial/Full fields of Department.
- **Response** (`200 OK`)

#### 3.4. Toggle Department Status
- **`PATCH /api/v1/departments/{id}/status`**
- **Access**: `ADMIN`
- **Response** (`200 OK`): Toggles `isActive`.

#### 3.5. Delete Department
- **`DELETE /api/v1/departments/{id}`**
- **Access**: `ADMIN`
- **Response** (`200 OK`): Soft or restricted hard delete.

---

### Module 4: Services Catalog (`/services`)

#### 4.1. List Services
- **`GET /api/v1/services`**
- **Access**: Public / Authenticated
- **Query Parameters**:
  - `departmentId`: Filter by parent department (e.g. `dept-1`)
  - `search`: Filter by name or service code
  - `isActive`: Boolean
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "srv-1",
        "departmentId": "dept-1",
        "name": "Kebele Digital ID Registration & Issuance",
        "code": "KBL-DID",
        "description": "First-time biometric registration and digital smart ID card issuance.",
        "durationMinutes": 30,
        "dailyQuota": 45,
        "feeETB": 0,
        "processingDays": "Same day",
        "requiredDocuments": [
          "Original Birth Certificate or Previous Kebele ID",
          "Two (2) recent passport-sized photographs",
          "Proof of residential address"
        ],
        "isActive": true
      }
    ]
  }
  ```

#### 4.2. Create Public Service
- **`POST /api/v1/services`**
- **Access**: `ADMIN`
- **Request Body**:
  ```json
  {
    "departmentId": "dept-1",
    "name": "Vital Event: Marriage Certificate",
    "code": "KBL-MAR",
    "description": "Registration of civil marriage status.",
    "durationMinutes": 30,
    "dailyQuota": 30,
    "feeETB": 150.00,
    "processingDays": "2-3 business days",
    "requiredDocuments": ["Both Spouses Kebele IDs", "Marriage Witnesses Info"]
  }
  ```
- **Response** (`201 Created`)

#### 4.3. Update Service
- **`PUT /api/v1/services/{id}`**
- **Access**: `ADMIN`

#### 4.4. Toggle Service Active Status
- **`PATCH /api/v1/services/{id}/status`**
- **Access**: `ADMIN`

#### 4.5. Delete Service
- **`DELETE /api/v1/services/{id}`**
- **Access**: `ADMIN`

---

### Module 5: Operating Schedules & Slot Availability (`/schedules`)

#### 5.1. List Operational Schedules
- **`GET /api/v1/schedules`**
- **Access**: `ADMIN`, `OFFICER`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "SCH-005",
        "department": "Kebele Administration & Vital Events",
        "departmentId": "dept-1",
        "service": "Kebele Digital ID Registration",
        "serviceId": "srv-1",
        "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "openingTime": "08:30",
        "closingTime": "17:30",
        "dailyCapacity": 45,
        "effectiveStartDate": "2026-01-01",
        "effectiveEndDate": null,
        "status": "Active"
      }
    ]
  }
  ```

#### 5.2. Create Schedule
- **`POST /api/v1/schedules`**
- **Access**: `ADMIN`
- **Request Body**:
  ```json
  {
    "departmentId": "dept-1",
    "serviceId": "srv-1",
    "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "openingTime": "08:30",
    "closingTime": "17:30",
    "dailyCapacity": 45,
    "effectiveStartDate": "2026-01-01",
    "effectiveEndDate": null
  }
  ```
- **Response** (`201 Created`)

#### 5.3. Query Dynamic Slot Availability
- **`GET /api/v1/schedules/availability`**
- **Access**: Public / Authenticated
- **Query Parameters**:
  - `serviceId`: Required (e.g. `srv-1`)
  - `date`: Required (`YYYY-MM-DD`, e.g. `2026-11-03`)
- **Description**: Calculates available counter capacity for each standard 30-minute interval across the operating window. Directly fuels the **Book Appointment** availability indicators (`Available`, `Full`, `Unavailable`).
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "serviceId": "srv-1",
      "date": "2026-11-03",
      "maxParallelSlots": 3,
      "slots": [
        {
          "timeSlot": "09:00 AM",
          "bookedCount": 1,
          "remainingCapacity": 2,
          "status": "Available" // "Available" | "Full" | "Unavailable"
        },
        {
          "timeSlot": "10:30 AM",
          "bookedCount": 3,
          "remainingCapacity": 0,
          "status": "Full"
        },
        {
          "timeSlot": "12:30 PM",
          "bookedCount": 0,
          "remainingCapacity": 0,
          "status": "Unavailable" // Lunch break / Holiday
        }
      ]
    }
  }
  ```

---

### Module 6: Appointments Management (`/appointments`)

#### 6.1. Book Appointment
- **`POST /api/v1/appointments`**
- **Access**: Public / `CITIZEN`
- **Description**: Submits a new appointment booking. Automatically generates the human-readable tracking reference `WRD-YYYYMMDD-XXXX`, initializes status to `PENDING`, and triggers citizen notifications.
- **Request Body**:
  ```json
  {
    "citizenName": "Tariku Belayneh Abebe",
    "citizenPhone": "+251911776655",
    "citizenEmail": "tariku@citizen.et",
    "departmentId": "dept-1",
    "serviceId": "srv-1",
    "date": "2026-11-03",
    "timeSlot": "09:00 AM",
    "citizenNotes": "First-time resident ID applicant with original documents."
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Appointment booked successfully.",
    "data": {
      "id": "apt-179357",
      "referenceNumber": "WRD-20261103-8219",
      "citizenName": "Tariku Belayneh Abebe",
      "citizenPhone": "+251911776655",
      "departmentName": "Kebele Administration & Vital Events",
      "serviceName": "Kebele Digital ID Registration & Issuance",
      "date": "2026-11-03",
      "timeSlot": "09:00 AM",
      "status": "PENDING",
      "tokenNumber": null,
      "createdAt": "2026-11-02T13:45:00+03:00"
    }
  }
  ```

#### 6.2. Public Tracking Search
- **`GET /api/v1/appointments/track`**
- **Access**: Public
- **Query Parameters**:
  - `ref`: Reference Number (`WRD-...`) OR Phone Number (`+2519...`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "referenceNumber": "WRD-20261101-001",
      "citizenName": "Bekele Tadesse Wolde",
      "serviceName": "Kebele Digital ID Registration & Issuance",
      "departmentName": "Kebele Administration & Vital Events",
      "date": "2026-11-02",
      "timeSlot": "09:00 AM",
      "status": "APPROVED",
      "tokenNumber": "KBL-01",
      "currentStageIndex": 1, // 0: Submitted, 1: Approved, 2: Checked In, 3: In Progress, 4: Delivered
      "officerNotes": "Documents pre-verified."
    }
  }
  ```

#### 6.3. Citizen Appointment History
- **`GET /api/v1/appointments/my`**
- **Access**: `CITIZEN`
- **Query Parameters**:
  - `tab`: `ALL` | `UPCOMING` | `COMPLETED` | `CANCELLED` (Default: `ALL`)
  - `search`: Search query string
- **Response** (`200 OK`): List of appointments belonging to current citizen.

#### 6.4. Department & Cross-Department Appointment Registry
- **`GET /api/v1/appointments`**
- **Access**: `OFFICER`, `ADMIN`
- **Query Parameters**:
  - `timeframe`: `TODAY` | `UPCOMING` | `ALL` (Strict client filter dropdown)
  - `status`: `PENDING` | `APPROVED` | `REJECTED` (Strict client filter dropdown)
  - `departmentId`: For Admin cross-department filtering (Officers automatically restricted to their own department)
  - `search`: Search citizen name, reference number, or phone
  - `page`: Integer (Default: 1)
  - `limit`: Integer (Default: 20)
- **Response** (`200 OK`): Returns paginated appointments strictly filtered by timeframe and status.

#### 6.5. Update Appointment Status (Approve / Reject)
- **`PATCH /api/v1/appointments/{id}/status`**
- **Access**: `OFFICER`, `ADMIN`
- **Description**: Action executed when the desk officer clicks **Approve** or **Reject**.
- **Request Body**:
  ```json
  {
    "status": "REJECTED", // "APPROVED" or "REJECTED"
    "officerNotes": "Citizen failed to bring original Kebele proof.",
    "rejectionReason": "Incomplete supporting documentation"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Appointment status updated to REJECTED.",
    "data": {
      "id": "apt-9",
      "referenceNumber": "WRD-20261102-099",
      "status": "REJECTED",
      "rejectionReason": "Incomplete supporting documentation"
    }
  }
  ```

#### 6.6. Reschedule Appointment
- **`POST /api/v1/appointments/{id}/reschedule`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`
- **Request Body**:
  ```json
  {
    "newDate": "2026-11-05",
    "newTimeSlot": "10:30 AM",
    "reason": "Citizen requested reschedule due to conflict"
  }
  ```
- **Response** (`200 OK`): Updates appointment date/slot and resets status to `APPROVED`.

#### 6.7. Cancel Appointment
- **`POST /api/v1/appointments/{id}/cancel`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`
- **Response** (`200 OK`): Sets status to `CANCELLED` and frees slot capacity.

#### 6.8. Generate Printable Slip Data
- **`GET /api/v1/appointments/{id}/slip`**
- **Access**: Public / Authenticated
- **Response** (`200 OK`): Returns slip structure including required documents, instructions, location barcode, and municipal seal data.

---

### Module 7: Desk Verification & Live Counter Queue (`/queue`)

#### 7.1. Citizen Arrival Check-In & Token Issuance
- **`POST /api/v1/queue/verify-checkin`**
- **Access**: `OFFICER`
- **Description**: Desk officer searches by Reference Number, verifies document checklist, marks appointment as `CHECKED_IN`, and generates a daily sequential queue token (e.g. `KBL-01`).
- **Request Body**:
  ```json
  {
    "appointmentId": "apt-1",
    "verifiedDocuments": [
      "Original Birth Certificate",
      "Passport-sized photographs"
    ],
    "notes": "Citizen verified at reception desk"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Citizen checked in and queue token issued.",
    "data": {
      "tokenNumber": "KBL-03",
      "appointmentId": "apt-1",
      "citizenName": "Bekele Tadesse Wolde",
      "serviceName": "Kebele Digital ID Registration & Issuance",
      "counterNumber": 1,
      "status": "WAITING",
      "estimatedWaitMinutes": 15
    }
  }
  ```

#### 7.2. Get Department Live Queue Board
- **`GET /api/v1/queue`**
- **Access**: `OFFICER`
- **Query Parameters**:
  - `departmentId`: Filter by department
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "nowServing": {
        "id": "q-1",
        "tokenNumber": "KBL-02",
        "citizenName": "Almaz Hailu Mengistu",
        "serviceName": "Residence Certificate (Melkeya)",
        "counterNumber": 1,
        "calledTime": "09:30 AM"
      },
      "waitingList": [
        {
          "id": "q-2",
          "tokenNumber": "KBL-01",
          "citizenName": "Bekele Tadesse Wolde",
          "serviceName": "Kebele Digital ID Registration",
          "checkedInTime": "09:20 AM",
          "estimatedMinutesRemaining": 15
        }
      ]
    }
  }
  ```

#### 7.3. Call Next Citizen
- **`POST /api/v1/queue/call-next`**
- **Access**: `OFFICER`
- **Description**: Moves next waiting citizen to `SERVING`, updates their appointment to `IN_PROGRESS`, and triggers audio chime announcement string.
- **Request Body**:
  ```json
  {
    "counterNumber": 1
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Token KBL-01 called to Counter #1.",
    "data": {
      "calledToken": "KBL-01",
      "citizenName": "Bekele Tadesse Wolde",
      "counterNumber": 1,
      "chimeText": "Chime: Token KBL-01 please proceed to Counter Desk #1"
    }
  }
  ```

#### 7.4. Finalize Token Counter Status (`COMPLETED` / `NO_SHOW`)
- **`PATCH /api/v1/queue/{id}/status`**
- **Access**: `OFFICER`
- **Request Body**:
  ```json
  {
    "status": "COMPLETED" // "COMPLETED" or "NO_SHOW"
  }
  ```
- **Response** (`200 OK`): Cascades status directly to corresponding appointment record.

---

### Module 8: Notifications Center (`/notifications`)

#### 8.1. List User Notifications
- **`GET /api/v1/notifications`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "unreadCount": 1,
      "notifications": [
        {
          "id": "notif-1",
          "title": "Appointment Confirmed",
          "message": "Your appointment on Nov 2, 2026 at 09:00 AM has been confirmed. Ref: WRD-20261101-001.",
          "type": "SUCCESS",
          "isRead": false,
          "createdAt": "2026-11-01T08:35:00Z"
        }
      ]
    }
  }
  ```

#### 8.2. Mark Notification Read
- **`PATCH /api/v1/notifications/{id}/read`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`

#### 8.3. Mark All Notifications Read
- **`PATCH /api/v1/notifications/read-all`**
- **Access**: `CITIZEN`, `OFFICER`, `ADMIN`

---

### Module 9: Staff Account Provisioning (`/admin/users`)

#### 9.1. List Provisioned Staff (Cursor-Paginated)
- **`GET /api/v1/admin/users`**
- **Access**: `ADMIN`
- **Query Parameters**:
  - `cursor`: Integer offset (Default: 0)
  - `pageSize`: Integer (Default: 5)
  - `search`: Search query string
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "usr-officer-1",
        "fullName": "W/ro Tigist Mulugeta",
        "email": "tigist.kbl@woreda.gov.et",
        "role": "Department Officer",
        "departmentName": "Kebele Administration & Vital Events",
        "isActive": true
      }
    ],
    "meta": {
      "cursor": {
        "current": 0,
        "pageSize": 5,
        "totalCount": 8,
        "hasPrev": false,
        "hasNext": true
      }
    }
  }
  ```

#### 9.2. Provision New Staff Account
- **`POST /api/v1/admin/users/provision`**
- **Access**: `ADMIN`
- **Request Body**:
  ```json
  {
    "fullName": "Ato Dawit Kebede",
    "email": "dawit.lnd@woreda.gov.et",
    "password": "Password@123",
    "role": "Department Officer", // "Department Officer" | "Central Administrator"
    "departmentId": "dept-2"
  }
  ```
- **Response** (`201 Created`)

#### 9.3. Toggle Staff User Status
- **`PATCH /api/v1/admin/users/{id}/status`**
- **Access**: `ADMIN`

#### 9.4. Delete Provisioned Account
- **`DELETE /api/v1/admin/users/{id}`**
- **Access**: `ADMIN`

---

### Module 10: Reports & Analytics Export (`/reports`)

#### 10.1. Get Analytics Summary
- **`GET /api/v1/reports/summary`**
- **Access**: `ADMIN`, `OFFICER`
- **Query Parameters**:
  - `period`: `THIS_MONTH` | `THIS_WEEK` | `TODAY`
  - `departmentId`: Optional department filter
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "totalAppointments": 128,
      "completedAppointments": 108,
      "noShowAppointments": 12,
      "cancelledAppointments": 8,
      "completionRate": 84,
      "noShowRate": 9
    }
  }
  ```

#### 10.2. Export Appointments CSV
- **`GET /api/v1/reports/export-csv`**
- **Access**: `ADMIN`, `OFFICER`
- **Response**: `text/csv; charset=utf-8` file stream (`Content-Disposition: attachment; filename="woreda_appointment_report.csv"`).

---

### Module 11: Security & Audit Trail (`/admin/audit-logs`)

#### 11.1. List Audit Logs
- **`GET /api/v1/admin/audit-logs`**
- **Access**: `ADMIN`
- **Query Parameters**:
  - `page`: Integer (Default: 1)
  - `limit`: Integer (Default: 25)
  - `action`: Filter by action (e.g. `STATUS_APPROVED`, `UPDATE_SCHEDULE`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "log-1",
        "userName": "Ato Kibreab Demissie",
        "userRole": "ADMIN",
        "action": "UPDATE_SCHEDULE",
        "entity": "Global Schedule",
        "details": "Modified operating hours or daily booking parameters",
        "ipAddress": "192.168.1.10",
        "timestamp": "2026-11-01T07:30:00Z"
      }
    ]
  }
  ```

---

### Module 12: Woreda Municipal Settings (`/admin/settings`)

#### 12.1. Get Municipal Configuration
- **`GET /api/v1/admin/settings`**
- **Access**: `ADMIN`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "woredaName": "Woreda 03 Public Administration",
      "cityRegion": "Addis Ababa City Administration",
      "hotline": "9840",
      "emergencyPhone": "+251 11 551 0000",
      "smsGatewayActive": true,
      "autoApproveBookings": false
    }
  }
  ```

#### 12.2. Update Municipal Configuration
- **`PUT /api/v1/admin/settings`**
- **Access**: `ADMIN`
- **Request Body**: Key-value settings to update.
- **Response** (`200 OK`)

---

## 3. Error Handling & Standard Status Codes

| HTTP Code | Error Code | Description |
|:---|:---|:---|
| **`400 Bad Request`** | `BAD_REQUEST` | Malformed JSON or invalid parameter syntax |
| **`401 Unauthorized`** | `UNAUTHORIZED` | Missing or expired JWT bearer token |
| **`403 Forbidden`** | `FORBIDDEN` | Insufficient RBAC role permissions |
| **`404 Not Found`** | `NOT_FOUND` | Requested entity does not exist |
| **`409 Conflict`** | `SLOT_FULL` | Desired time slot capacity reached maximum parallel limit |
| **`422 Unprocessable`** | `VALIDATION_ERROR` | Schema validation error on payload fields |
| **`429 Rate Limited`** | `TOO_MANY_REQUESTS` | Exceeded rate limits (e.g., 60 req/min for public booking) |
| **`500 Server Error`** | `INTERNAL_ERROR` | Unhandled server exception |

---

## 4. Rate Limiting & Security Defenses

1. **Public Booking & Tracking Rate Limits**:
   - `POST /api/v1/appointments`: 10 requests per minute per IP address.
   - `GET /api/v1/appointments/track`: 30 requests per minute per IP address.
2. **CORS & Headers**:
   - Strict origin validation, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`.
3. **Data Scrubbing**:
   - Automatic trimming and sanitation of all citizen notes and strings to protect against XSS/injection.
