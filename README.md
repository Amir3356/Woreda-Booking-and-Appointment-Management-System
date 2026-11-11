## Schedule Management (Admin Only)

Implement a centralized Schedule Management module exclusively within the Admin Dashboard.

The Admin must have complete authority to configure, manage, and monitor appointment schedules across all government departments.

### Sidebar Navigation

1. Operating Hours
2. Appointment Availability
3. Daily Appointment Capacity
4. Calendar Exceptions

### 1. Operating Hours

Allow Admin to configure government and department-specific operating hours.

Features:
- Configure working days (Monday–Sunday).
- Set opening and closing times.
- Configure different operating hours for individual departments.
- Enable or disable specific working days.
- Support different operating hours for different departments.

### 2. Appointment Availability

Allow Admin to manage appointment booking availability across all departments.

Features:
- View appointment availability using a monthly calendar.
- Enable or disable appointment booking for specific dates.
- Configure available booking dates for individual departments.
- View available and unavailable dates.
- Prevent citizens from booking appointments on unavailable dates.

### 3. Daily Appointment Capacity

Allow Admin to configure appointment booking limits for each department.

Features:
- Set maximum daily appointment capacity per department.
- Configure different daily capacities for different departments.
- View total booked appointments.
- View remaining appointment capacity.
- Automatically prevent additional bookings when capacity is reached.

### 4. Calendar Exceptions

Allow Admin to manage exceptional working and non-working days across the Woreda.

Features:
- Add public holidays.
- Configure government non-working days.
- Add department-specific non-working days.
- Configure exceptional working days.
- Block specific dates or date ranges.
- Provide a reason or description for each exception.
- Select the scope of an exception:
  - All Departments.
  - Individual Department.
  - Selected Departments.

### Important Business Rules

1. Only Admin can create, update, and delete schedule configurations.
2. Department Heads have read-only access to their respective department schedules.
3. Citizens can only view available appointment dates during booking.
4. Appointment bookings must follow the configured operating hours, availability, and daily capacity.
5. Calendar exceptions must override normal availability where applicable.
6. Exceptional working days must be explicitly configured with operating hours and appointment capacity.
7. The backend must validate all scheduling rules before accepting appointment requests.
8. Existing approved appointments must not be silently deleted when schedules are modified.

### UI/UX Requirements

- Create a professional calendar-based scheduling interface.
- Use monthly and weekly calendar views.
- Use clear status indicators for available, unavailable, and exceptional dates.
- Include department filters.
- Include date-range selection.
- Provide confirmation dialogs before modifying or deleting schedules.
- Display appointment capacity and availability clearly.
- Maintain a consistent design with the existing Admin Dashboard.

**Important:** Schedule Management must be an Admin-only configuration module. Do not give Department Heads permission to create or modify schedules.