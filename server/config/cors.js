// Cross-Origin Resource Sharing (the `cors` package): which frontend origins may call the API.
// The web app sends the sign-in cookie, so origins are listed explicitly (credentials cannot use "*").
// Add the production frontend's origin here when the app is deployed.
export const allowedOrigins = [
  "http://localhost:3000", // Vite dev server (client/)
  "http://localhost:5173", // Vite's default port
];

export const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Request-ID", "X-CSRF-Token"],
  exposedHeaders: ["X-Request-ID", "Content-Disposition", "X-CSRF-Token"],
  maxAge: 600, // browsers may cache a preflight answer for 10 minutes
  optionsSuccessStatus: 204,
};
