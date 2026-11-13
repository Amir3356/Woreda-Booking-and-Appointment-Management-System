import Link from "@/components/ui/Link";
import { usePathname, useRouter } from "@/hooks";
import {
  Landmark,
  Building2,
  FileText,
  Calendar,
  ListOrdered,
  MonitorSpeaker,
  Clock,
  UserCog,
  Users,
  ShieldCheck,
  User,
  LogOut,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";
import { useStore } from "@/context";
import { EthiopianFlag } from "@/components/ui";

const ROLE_LABELS = { ADMIN: "Admin", OFFICER: "Officer", CITIZEN: "Citizen" };

export default function DashboardSidebar({ role = "ADMIN" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, appointments, setCurrentUser } = useStore();

  const pendingAppointmentsCount = appointments.filter((a) => a.status === "PENDING").length;

  // Navigation, grouped into labelled sections per role.
  const sectionsByRole = {
    ADMIN: [
      {
        label: "Overview",
        items: [
          { href: "/admin", label: "Geography Analysis", icon: LayoutDashboard },
        ],
      },
      {
        label: "Accounts",
        items: [
          { href: "/admin/account-provision", label: "Account Provision", icon: UserCog },
          { href: "/admin/citizens", label: "Citizen Management", icon: Users },
        ],
      },
      {
        label: "Service Setup",
        items: [
          { href: "/admin/departments", label: "Department Management", icon: Building2 },
          { href: "/admin/services", label: "Service Management", icon: FileText },
          { href: "/admin/schedule", label: "Schedule Management", icon: Clock },
        ],
      },
      {
        label: "Reports & Analytics",
        items: [
          { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3 },
        ],
      },
      {
        label: "Audit",
        items: [{ href: "/admin/audit", label: "Audit Trail", icon: ShieldCheck }],
      },
    ],
    OFFICER: [
      {
        label: "Main Menu",
        items: [
          {
            href: "/officer/appointments",
            label: "Appointment",
            icon: Calendar,
            badge: pendingAppointmentsCount > 0 ? pendingAppointmentsCount : null,
          },
          { href: "/officer/queue", label: "Queue", icon: MonitorSpeaker },
        ],
      },
    ],
    CITIZEN: [
      {
        label: "Main Menu",
        items: [
          { href: "/citizen/book", label: "Appointment", icon: Calendar },
          { href: "/citizen/queue", label: "My Queue", icon: ListOrdered },
        ],
      },
    ],
  };

  const sections = sectionsByRole[role] || sectionsByRole.ADMIN;
  // Same as the Role column of Admin > Account Provision: a department officer's role is their department.
  const roleLabel = role === "OFFICER" ? currentUser?.departmentName || ROLE_LABELS.OFFICER : ROLE_LABELS[role] || role;
  const subtitle =
    role === "OFFICER"
      ? currentUser?.departmentName || "Kebele Office"
      : role === "CITIZEN"
        ? "Public Self-Service"
        : "Woreda Public Administration";
  const brandHref = role === "ADMIN" ? "/admin" : role === "OFFICER" ? "/officer/appointments" : "/citizen/book";

  const handleSignOut = () => {
    setCurrentUser(null);
    router.push("/login");
  };

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Brand */}
      <Link href={brandHref} className="sidebar-brand">
        <span className="sidebar-logo-tile" aria-hidden="true">
          <Landmark />
        </span>
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">WoredaCare</span>
          <span className="sidebar-brand-sub" title={subtitle}>{subtitle}</span>
        </span>
      </Link>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label} className="sidebar-section">
            <p className="sidebar-section-label">{section.label}</p>
            <ul className="sidebar-list">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link${isActive ? " is-active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="sidebar-link-icon" aria-hidden="true" />
                      <span className="sidebar-link-label">{item.label}</span>
                      {item.badge && (
                        <span className="sidebar-badge" aria-label={`${item.badge} pending`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Signed-in user */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-avatar" aria-hidden="true">
            <User />
          </span>
          <span className="sidebar-user-text">
            <span className="sidebar-user-name" title={currentUser?.fullName || "Signed-in User"}>
              {currentUser?.fullName || "Signed-in User"}
            </span>
            <span className="sidebar-user-role" title={roleLabel}>
              {roleLabel}
            </span>
            <span className="sidebar-user-email" title={currentUser?.phone || (role === "ADMIN" ? "+251911223344" : role === "OFFICER" ? "+251911334455" : subtitle)}>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <EthiopianFlag className="w-3.5 h-2.5 shrink-0 shadow-2xs" />
                <span>{currentUser?.phone || (role === "ADMIN" ? "+251911223344" : role === "OFFICER" ? "+251911334455" : subtitle)}</span>
              </span>
            </span>
          </span>
        </div>
        <button type="button" onClick={handleSignOut} className="sidebar-signout">
          <LogOut aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
