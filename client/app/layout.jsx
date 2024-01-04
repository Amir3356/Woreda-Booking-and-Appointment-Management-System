import "./globals.css";

export const metadata = {
  title: "Woreda Booking & Appointment Management System",
  description: "Modern public appointment and queue management platform for Ethiopian Woreda government offices.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}

