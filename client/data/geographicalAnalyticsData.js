// Geographical Usage Analytics Dataset for Woreda Booking & Appointment System

export const geographicalSummary = {
  totalRegisteredUsers: 8420,
  totalBookings: 16150,
  activeLocationsCount: 8,
  activeWoredasCount: 24,
  activeKebelesCount: 68,
  mostActiveLocation: {
    name: "Bole Sub-City",
    users: 2840,
    bookings: 5620,
    share: "34.8%",
  },
  woredaExtremes: {
    highest: {
      name: "Bole Woreda 03",
      location: "Bole",
      users: 1450,
      bookings: 2890,
    },
    lowest: {
      name: "Akaki Woreda 07",
      location: "Akaki-Kality",
      users: 280,
      bookings: 510,
    },
  },
  kebeleExtremes: {
    highest: {
      name: "Kebele 02",
      woreda: "Bole Woreda 03",
      users: 640,
      bookings: 1310,
    },
    lowest: {
      name: "Kebele 21",
      woreda: "Akaki Woreda 07",
      users: 95,
      bookings: 160,
    },
  },
  mostActiveArea: {
    title: "Bole Sub-City · Woreda 03 · Kebele 02",
    badge: "Highest System Traffic",
    summary: "Leading across registered citizens, appointment slots, and online service completions.",
  },
};

// Location Usage: Registered Users & Appointment Bookings
export const locationUsageData = [
  { location: "Bole", users: 2840, bookings: 5620, fulfillmentRate: 94 },
  { location: "Kirkos", users: 1720, bookings: 3340, fulfillmentRate: 91 },
  { location: "Yeka", users: 1480, bookings: 2790, fulfillmentRate: 89 },
  { location: "Nifas Silk", users: 1120, bookings: 2180, fulfillmentRate: 88 },
  { location: "Arada", users: 710, bookings: 1390, fulfillmentRate: 86 },
  { location: "Gullele", users: 550, bookings: 830, fulfillmentRate: 84 },
];

// Location Booking Share (Pie / Donut Chart)
export const locationShareData = [
  { name: "Bole", value: 5620, color: "#0b2545" },
  { name: "Kirkos", value: 3340, color: "#1d4ed8" },
  { name: "Yeka", value: 2790, color: "#059669" },
  { name: "Nifas Silk", value: 2180, color: "#d97706" },
  { name: "Arada", value: 1390, color: "#7c3aed" },
  { name: "Gullele", value: 830, color: "#64748b" },
];

// Woreda Usage: Ranked from Highest to Lowest
export const woredaUsageData = [
  { woreda: "Bole W03 (Highest)", users: 1450, bookings: 2890, rank: "Highest" },
  { woreda: "Kirkos W02", users: 1290, bookings: 2460, rank: "High" },
  { woreda: "Yeka W08", users: 1150, bookings: 2210, rank: "High" },
  { woreda: "Nifas Silk W05", users: 1080, bookings: 2050, rank: "Moderate" },
  { woreda: "Bole W06", users: 980, bookings: 1950, rank: "Moderate" },
  { woreda: "Arada W01", users: 710, bookings: 1390, rank: "Moderate" },
  { woreda: "Gullele W09", users: 550, bookings: 830, rank: "Low" },
  { woreda: "Akaki W07 (Lowest)", users: 280, bookings: 510, rank: "Lowest" },
];

// Kebele Usage Extremes: Highest to Lowest comparison
export const kebeleUsageData = [
  { kebele: "Kebele 02 (Highest)", users: 640, bookings: 1310, status: "Highest Active" },
  { kebele: "Kebele 05", users: 540, bookings: 1090, status: "High Active" },
  { kebele: "Kebele 08", users: 490, bookings: 970, status: "Moderate Active" },
  { kebele: "Kebele 14", users: 380, bookings: 720, status: "Moderate Active" },
  { kebele: "Kebele 17", users: 210, bookings: 430, status: "Low Active" },
  { kebele: "Kebele 21 (Lowest)", users: 95, bookings: 160, status: "Lowest Active" },
];

// Service Fulfillment Breakdown (Pie Chart)
export const fulfillmentStatusData = [
  { name: "Completed Desk Visits", value: 11480, color: "#10b981" },
  { name: "Pending / Upcoming", value: 3240, color: "#3b82f6" },
  { name: "Cancelled / No-Show", value: 1430, color: "#f43f5e" },
];

