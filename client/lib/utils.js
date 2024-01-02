import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatETB(amount) {
  if (amount === undefined || amount === null || amount === 0) return "Free";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(timeString) {
  if (!timeString) return "N/A";
  return timeString;
}

export const APPOINTMENT_STATUS_CONFIG = {
  PENDING: {
    label: "Pending Review",
    bg: "bg-amber-50 text-amber-700 border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Approved",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  CHECKED_IN: {
    label: "Checked In",
    bg: "bg-blue-50 text-blue-700 border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-purple-50 text-purple-700 border-purple-200",
    badge: "bg-purple-100 text-purple-800",
    dot: "bg-purple-500",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-slate-100 text-slate-700 border-slate-300",
    badge: "bg-slate-200 text-slate-800",
    dot: "bg-slate-500",
  },
  REJECTED: {
    label: "Rejected",
    bg: "bg-rose-50 text-rose-700 border-rose-200",
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-gray-100 text-gray-700 border-gray-300",
    badge: "bg-gray-200 text-gray-800",
    dot: "bg-gray-500",
  },
  NO_SHOW: {
    label: "No Show",
    bg: "bg-red-50 text-red-700 border-red-200",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
};
