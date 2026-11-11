// Admin > Schedule Management: one sidebar entry, with its sections as tabs.
import { NavLink, Outlet } from "react-router-dom";
import { CalendarX2, Clock } from "lucide-react";

const TABS = [
  ["hours", "Working Hours", Clock],
  ["exceptions", "Calendar Exceptions", CalendarX2],
];

export default function ScheduleSection() {
  return (
    <div className="sm-section">
      <nav className="sm-tabs justify-center items-center" aria-label="Schedule Management">
        {TABS.map(([path, label, Icon]) => (
          <NavLink key={path} to={path} className={({ isActive }) => `sm-tab${isActive ? " is-active" : ""}`}>
            <Icon aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
