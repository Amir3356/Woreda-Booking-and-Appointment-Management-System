import { useState } from "react";
import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";
import { useStore } from "@/context";
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const { departments = [] } = useStore();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "", category: "General Inquiry" });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[11px] uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Citizen Support & Inquiries
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
            Helpdesk & Contact Information
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Have questions regarding document requirements, appointment scheduling, or service delays? Reach out directly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contact Details Column */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                Municipal Headquarters
              </h3>

              <div className="flex items-start gap-3 text-slate-600">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Woreda Administration Complex</p>
                  <p>Central Main Avenue, Addis Ababa, Ethiopia</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-600">
                <Phone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Toll-Free Hotline</p>
                  <p>9840 (Free for all callers)</p>
                  <p>Direct: +251 11 551 2341</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-600">
                <Mail className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Support Email</p>
                  <p>support@woreda.gov.et</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-600">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Office Working Hours</p>
                  <p>Monday – Friday: 08:30 – 17:30</p>
                  <p className="text-[10px] text-slate-400">Lunch: 12:30 – 13:30 (Desks Closed)</p>
                </div>
              </div>
            </div>

            {/* Department Desk Contacts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                Department Direct Lines
              </h3>
              <div className="space-y-2">
                {departments.length === 0 ? (
                  <p className="text-slate-400 text-[11px] italic">No department lines configured yet.</p>
                ) : (
                  departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between text-slate-600 gap-2">
                      <span className="font-medium truncate max-w-[130px]" title={dept.name}>
                        {dept.name}
                      </span>
                      <span className="font-mono text-[10px] text-blue-700 shrink-0 font-semibold">
                        {dept.contactPhone}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Feedback & Inquiries Form */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-base mb-2">
                Submit an Inquiry or Feedback
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Our citizen relations officer will review and respond within 24 business hours.
              </p>

              {submitted ? (
                <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="font-bold text-emerald-900 text-sm">Message Successfully Submitted!</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    Thank you. Ticket #TKT-{Date.now().toString().slice(-5)} has been logged.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Your Name *</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Abebe Bikila"
                        className="w-full px-3 py-2 border rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+251 9XX XXX XXX"
                        className="w-full px-3 py-2 border rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Inquiry Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
                    >
                      <option>General Inquiry</option>
                      <option>Document Requirements Question</option>
                      <option>Appointment Rescheduling Assistance</option>
                      <option>Service Officer Complaint / Delay</option>
                      <option>Technical Issue with Portal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Your Message *</label>
                    <textarea
                      rows={4}
                      required
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Describe your inquiry or case in detail..."
                      className="w-full px-3 py-2 border rounded-lg text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-300" />
                    <span>Send Message</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

