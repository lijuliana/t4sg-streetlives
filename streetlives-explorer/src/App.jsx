import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "./supabaseClient";
// ============================================================
// STREETLIVES SERVICE EXPLORER
// A Supabase-powered service directory for NYC
// ============================================================

// --- Supabase Client Setup ---
// In production, replace with your actual Supabase URL and anon key
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Minimal Supabase-like client for demo purposes
// Replace this section with: import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// DUMMY DATA (mirrors what would be seeded in Supabase)
// ============================================================

const CATEGORIES = [
  { id: "c1", slug: "housing", name: "Housing", created_at: "2024-01-01" },
  { id: "c2", slug: "food", name: "Food", created_at: "2024-01-01" },
  { id: "c3", slug: "legal", name: "Legal", created_at: "2024-01-01" },
  { id: "c4", slug: "health", name: "Health", created_at: "2024-01-01" },
  { id: "c5", slug: "safety", name: "Safety", created_at: "2024-01-01" },
  { id: "c6", slug: "employment", name: "Employment", created_at: "2024-01-01" },
];

const SERVICES = [
  {
    id: "s1", name: "Beacon Youth Shelter Intake", borough: "Manhattan",
    description: "Open intake for youth ages 16–24 experiencing homelessness. Provides emergency overnight beds, case management referrals, and connection to transitional housing programs. Walk-ins accepted daily from 4 PM–8 PM. Staff fluent in English and Spanish.",
    address: "412 W 129th St, New York, NY 10027", phone: "212-555-0101",
    website: "https://example.org/beacon-youth", eligibility: "Youth ages 16–24. No ID required for initial intake.",
    hours: "Mon–Sun 4:00 PM – 8:00 PM (intake), 24hr shelter", last_verified_date: "2025-11-15",
    is_active: true, updated_at: "2025-11-15", created_at: "2024-06-01",
    category_ids: ["c1"],
  },
  {
    id: "s2", name: "Flatbush Community Pantry", borough: "Brooklyn",
    description: "Weekly food distribution serving 500+ families. Fresh produce, shelf-stable goods, and hygiene kits available. No documentation required. Culturally diverse offerings including halal and Caribbean staples.",
    address: "1820 Flatbush Ave, Brooklyn, NY 11210", phone: "718-555-0202",
    website: null, eligibility: "Open to all. No documentation required.",
    hours: "Saturdays 9:00 AM – 1:00 PM", last_verified_date: "2025-12-01",
    is_active: true, updated_at: "2025-12-01", created_at: "2024-03-15",
    category_ids: ["c2"],
  },
  {
    id: "s3", name: "Queens Legal Aid Clinic", borough: "Queens",
    description: "Free legal consultations for housing court, immigration, and benefits appeals. Attorneys available for same-day walk-in appointments. Interpretation services in 12 languages. Can assist with SNAP, Medicaid, and SSI applications.",
    address: "89-14 Parsons Blvd, Jamaica, NY 11432", phone: "718-555-0303",
    website: "https://example.org/queens-legal", eligibility: "NYC residents with income below 200% FPL.",
    hours: "Mon–Fri 9:00 AM – 5:00 PM", last_verified_date: "2025-10-20",
    is_active: true, updated_at: "2025-10-20", created_at: "2024-02-01",
    category_ids: ["c3"],
  },
  {
    id: "s4", name: "Bronx Mobile Health Van", borough: "Bronx",
    description: "Free mobile clinic offering primary care, vaccinations, blood pressure screenings, and rapid HIV/STI testing. No appointment needed. The van rotates between four Bronx locations weekly. Staffed by licensed nurse practitioners.",
    address: null, phone: "718-555-0404",
    website: "https://example.org/bronx-health-van", eligibility: "Open to all. No insurance required.",
    hours: "Tue & Thu 10:00 AM – 4:00 PM (rotating locations)", last_verified_date: "2025-12-10",
    is_active: true, updated_at: "2025-12-10", created_at: "2024-04-01",
    category_ids: ["c4"],
  },
  {
    id: "s5", name: "Safe Sleep Hotline", borough: "Manhattan",
    description: "24/7 phone line connecting individuals to emergency overnight shelter beds across NYC. Operators can locate available beds in real-time and arrange transportation via city services. Multilingual operators available.",
    address: null, phone: "212-555-0505",
    website: null, eligibility: "Anyone in NYC experiencing homelessness.",
    hours: "24/7", last_verified_date: "2025-11-28",
    is_active: true, updated_at: "2025-11-28", created_at: "2024-01-15",
    category_ids: ["c5"],
  },
  {
    id: "s6", name: "Benefits Navigator Desk", borough: "Brooklyn",
    description: "One-on-one assistance applying for public benefits including Medicaid, SNAP, HEAP, and Cash Assistance. Trained navigators help with paperwork, recertifications, and appeals. Also provides health insurance enrollment support during open enrollment.",
    address: "250 Livingston St, Brooklyn, NY 11201", phone: "718-555-0606",
    website: "https://example.org/benefits-nav", eligibility: "NYC residents. Priority for uninsured individuals.",
    hours: "Mon–Fri 8:30 AM – 4:30 PM", last_verified_date: "2025-09-30",
    is_active: true, updated_at: "2025-09-30", created_at: "2024-05-01",
    category_ids: ["c3", "c4"],
  },
  {
    id: "s7", name: "Job Readiness Lab", borough: "Queens",
    description: "Free computer lab and career coaching center. Offers resume building workshops, interview prep, digital literacy classes, and direct connections to employers hiring for entry-level positions. Includes a professional clothing closet.",
    address: "37-02 Northern Blvd, Long Island City, NY 11101", phone: "718-555-0707",
    website: "https://example.org/job-lab", eligibility: "Adults 18+. Must complete intake form.",
    hours: "Mon–Fri 10:00 AM – 6:00 PM, Sat 10:00 AM – 2:00 PM", last_verified_date: "2025-11-05",
    is_active: true, updated_at: "2025-11-05", created_at: "2024-07-01",
    category_ids: ["c6"],
  },
  {
    id: "s8", name: "Concourse Drop-In Center", borough: "Bronx",
    description: "Low-barrier drop-in center providing showers, laundry, meals, mail services, and a safe indoor space. Social workers on-site for case management. Connects guests to shelter placement, medical care, and mental health services. Harm reduction supplies available.",
    address: "880 Grand Concourse, Bronx, NY 10451", phone: "718-555-0808",
    website: "https://example.org/concourse-dropin", eligibility: "Open to all adults. No sobriety requirement.",
    hours: "Mon–Sat 7:00 AM – 7:00 PM", last_verified_date: "2025-12-05",
    is_active: true, updated_at: "2025-12-05", created_at: "2024-03-01",
    category_ids: ["c1", "c4", "c5"],
  },
  {
    id: "s9", name: "SI Street Outreach Team", borough: "Staten Island",
    description: "Mobile outreach workers canvassing Staten Island to connect unsheltered individuals with services. Team provides water, snacks, hygiene kits, and warm clothing. Can facilitate immediate shelter placement and transportation to intake centers.",
    address: null, phone: "718-555-0909",
    website: null, eligibility: "Individuals living unsheltered on Staten Island.",
    hours: "Mon–Fri 6:00 AM – 2:00 PM", last_verified_date: "2025-10-15",
    is_active: true, updated_at: "2025-10-15", created_at: "2024-08-01",
    category_ids: ["c1", "c5"],
  },
  {
    id: "s10", name: "ID Replacement Pop-Up", borough: "Manhattan",
    description: "Monthly pop-up event helping individuals obtain replacement birth certificates, state IDs, and Social Security cards. Photographers on-site for ID photos. Staff assists with form completion and fee waivers. Partnered with NYC HRA.",
    address: "33 Beaver St, New York, NY 10004", phone: "212-555-1010",
    website: "https://example.org/id-popup", eligibility: "NYC residents without valid ID. Fee waivers available.",
    hours: "First Saturday of each month, 9:00 AM – 3:00 PM", last_verified_date: "2025-11-02",
    is_active: true, updated_at: "2025-11-02", created_at: "2024-09-01",
    category_ids: ["c3"],
  },
];

const BOROUGHS = ["All", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

// ============================================================
// STYLES
// ============================================================

const theme = {
  yellow: "#FFD200",
  black: "#111111",
  white: "#FFFFFF",
  gray50: "#FAFAFA",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  radius: "10px",
  radiusSm: "6px",
  radiusLg: "14px",
  shadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
  shadowLg: "0 10px 30px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)",
};

// ============================================================
// UTILITY HOOKS
// ============================================================

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// ============================================================
// ICONS (inline SVG components)
// ============================================================

const Icons = {
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  X: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Phone: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  MapPin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Globe: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Shield: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Calendar: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

// ============================================================
// CATEGORY CHIP
// ============================================================

function CategoryChip({ name, active, onClick, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "3px 10px" : "6px 16px",
        fontSize: small ? "11px" : "13px",
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        borderRadius: "100px",
        border: `2px solid ${theme.yellow}`,
        background: active ? theme.yellow : theme.white,
        color: active ? theme.black : theme.gray600,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </button>
  );
}

// ============================================================
// SERVICE CARD
// ============================================================

function ServiceCard({ service, categories, onClick }) {
  const [hovered, setHovered] = useState(false);
  const cats = categories.filter((c) => service.category_ids.includes(c.id));

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: theme.white,
        borderRadius: theme.radiusLg,
        padding: "24px",
        cursor: "pointer",
        border: `1.5px solid ${hovered ? theme.yellow : theme.gray200}`,
        boxShadow: hovered ? theme.shadowMd : theme.shadow,
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: theme.black, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.3 }}>
          {service.name}
        </h3>
        <span style={{
          fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "100px",
          background: theme.gray100, color: theme.gray600, whiteSpace: "nowrap",
          fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
        }}>
          {service.borough}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {cats.map((c) => (
          <CategoryChip key={c.id} name={c.name} active={false} small />
        ))}
      </div>

      <p style={{
        margin: 0, fontSize: "13.5px", color: theme.gray500, lineHeight: 1.55,
        fontFamily: "'DM Sans', sans-serif",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {service.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "auto" }}>
        <Icons.Calendar />
        <span style={{ fontSize: "12px", color: theme.gray400, fontFamily: "'DM Sans', sans-serif" }}>
          Verified {service.last_verified_date}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// SERVICE DETAIL MODAL / DRAWER
// ============================================================

function ServiceDetail({ service, categories, onClose, isDesktop }) {
  const cats = categories.filter((c) => service.category_ids.includes(c.id));
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const overlayStyle = {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: isDesktop ? "flex-end" : "center",
    alignItems: isDesktop ? "stretch" : "flex-end",
    animation: "fadeIn 0.2s ease",
  };

  const panelStyle = {
    background: theme.white,
    width: isDesktop ? "480px" : "100%",
    maxHeight: isDesktop ? "100vh" : "90vh",
    borderRadius: isDesktop ? 0 : "20px 20px 0 0",
    overflow: "auto",
    boxShadow: theme.shadowLg,
    animation: isDesktop ? "slideInRight 0.25s ease" : "slideUp 0.25s ease",
  };

  const InfoRow = ({ icon, children }) => (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "10px 0" }}>
      <span style={{ color: theme.gray400, flexShrink: 0, marginTop: "2px" }}>{icon}</span>
      <div style={{ flex: 1, fontSize: "14px", color: theme.gray600, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );

  const CopyBtn = ({ text, field }) => (
    <button
      onClick={(e) => { e.stopPropagation(); copyToClipboard(text, field); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        fontSize: "12px", color: copiedField === field ? "#16a34a" : theme.gray400,
        background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
        fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
      }}
    >
      {copiedField === field ? <Icons.Check /> : <Icons.Copy />}
      {copiedField === field ? "Copied" : "Copy"}
    </button>
  );

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${theme.gray200}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: theme.white, zIndex: 1,
        }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: theme.gray400, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
            Service Details
          </span>
          <button onClick={onClose} style={{
            background: theme.gray100, border: "none", cursor: "pointer", borderRadius: "50%",
            width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center",
            color: theme.gray500,
          }}>
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 800, color: theme.black, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.25 }}>
            {service.name}
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
            <span style={{
              fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "100px",
              background: theme.gray100, color: theme.gray600, fontFamily: "'DM Sans', sans-serif",
            }}>
              {service.borough}
            </span>
            {cats.map((c) => (
              <CategoryChip key={c.id} name={c.name} active small />
            ))}
          </div>

          <p style={{ margin: "0 0 24px", fontSize: "14.5px", color: theme.gray600, lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
            {service.description}
          </p>

          <div style={{ borderTop: `1px solid ${theme.gray200}`, paddingTop: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {service.address && (
              <InfoRow icon={<Icons.MapPin />}>
                <div>
                  <span>{service.address}</span>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(service.address)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: "12px", color: theme.black, fontWeight: 600, textDecoration: "none",
                        padding: "4px 12px", borderRadius: "6px", background: theme.yellow,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Open in Maps
                    </a>
                    <CopyBtn text={service.address} field="address" />
                  </div>
                </div>
              </InfoRow>
            )}

            {service.phone && (
              <InfoRow icon={<Icons.Phone />}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <a href={`tel:${service.phone}`} style={{ color: theme.black, fontWeight: 600, textDecoration: "none" }}>
                    {service.phone}
                  </a>
                  <CopyBtn text={service.phone} field="phone" />
                </div>
              </InfoRow>
            )}

            {service.website && (
              <InfoRow icon={<Icons.Globe />}>
                <a href={service.website} target="_blank" rel="noopener noreferrer"
                  style={{ color: theme.black, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "3px" }}>
                  Visit Website
                </a>
              </InfoRow>
            )}

            {service.eligibility && (
              <InfoRow icon={<Icons.Shield />}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: theme.gray400, textTransform: "uppercase", letterSpacing: "0.05em" }}>Eligibility</span>
                  <div style={{ marginTop: "4px" }}>{service.eligibility}</div>
                </div>
              </InfoRow>
            )}

            {service.hours && (
              <InfoRow icon={<Icons.Clock />}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: theme.gray400, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hours</span>
                  <div style={{ marginTop: "4px" }}>{service.hours}</div>
                </div>
              </InfoRow>
            )}
          </div>

          <div style={{
            marginTop: "24px", padding: "12px 16px", borderRadius: theme.radius,
            background: theme.gray50, fontSize: "12px", color: theme.gray400,
            fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "6px",
          }}>
            <Icons.Calendar />
            Last verified: {service.last_verified_date || "Unknown"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOGIN PAGE
// ============================================================

function LoginPage({ onLogin, onBack }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    let result;
    if (isSignUp) {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (isSignUp && !result.data.session) {
      setError("Check your email to confirm your account before signing in.");
      return;
    }

    onLogin({ email, session: result.data.session });
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", fontSize: "15px",
    border: `1.5px solid ${theme.gray200}`, borderRadius: theme.radius,
    outline: "none", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.15s ease", boxSizing: "border-box",
    background: theme.white,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: theme.gray50, padding: "24px", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: "400px", background: theme.white,
        borderRadius: theme.radiusLg, padding: "40px 32px",
        boxShadow: theme.shadowMd, border: `1px solid ${theme.gray200}`,
      }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "none", border: "none", cursor: "pointer",
          color: theme.gray500, fontSize: "13px", fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif", marginBottom: "24px", padding: 0,
        }}>
          <Icons.ArrowLeft /> Back to Explorer
        </button>

        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: theme.yellow, display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "20px", fontSize: "22px", fontWeight: 800, color: theme.black,
        }}>
          S
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: theme.black }}>
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: "14px", color: theme.gray500, lineHeight: 1.5 }}>
          {isSignUp ? "Sign up to manage services" : "Sign in to access the admin panel"}
        </p>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: theme.radiusSm, marginBottom: "16px",
            background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626",
            fontSize: "13px", fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: theme.gray600, marginBottom: "6px" }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = theme.yellow}
              onBlur={(e) => e.target.style.borderColor = theme.gray200}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: theme.gray600, marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = theme.yellow}
              onBlur={(e) => e.target.style.borderColor = theme.gray200}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "13px", fontSize: "15px", fontWeight: 700,
              background: theme.yellow, color: theme.black, border: "none",
              borderRadius: theme.radius, cursor: loading ? "wait" : "pointer",
              fontFamily: "'DM Sans', sans-serif", marginTop: "4px",
              opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
            }}
          >
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </div>

        <p style={{ margin: "20px 0 0", fontSize: "13px", color: theme.gray500, textAlign: "center" }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: theme.black, fontWeight: 700, fontSize: "13px", textDecoration: "underline",
              textUnderlineOffset: "3px", fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>

      </div>
    </div>
  );
}

// ============================================================
// ADMIN PAGE
// ============================================================

const formInputStyle = {
  width: "100%", padding: "10px 14px", fontSize: "14px",
  border: `1.5px solid ${theme.gray200}`, borderRadius: theme.radiusSm,
  outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
  background: theme.white,
};

const formLabelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: theme.gray500, marginBottom: "4px", fontFamily: "'DM Sans', sans-serif" };

function FormFields({ form, setForm, categories }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={formLabelStyle}>Name *</label>
        <input style={formInputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={formLabelStyle}>Description</label>
        <textarea style={{ ...formInputStyle, minHeight: "80px", resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label style={formLabelStyle}>Borough</label>
        <select style={formInputStyle} value={form.borough} onChange={(e) => setForm({ ...form, borough: e.target.value })}>
          {BOROUGHS.slice(1).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label style={formLabelStyle}>Phone</label>
        <input style={formInputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <label style={formLabelStyle}>Address</label>
        <input style={formInputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div>
        <label style={formLabelStyle}>Website</label>
        <input style={formInputStyle} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={formLabelStyle}>Eligibility</label>
        <input style={formInputStyle} value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
      </div>
      <div>
        <label style={formLabelStyle}>Hours</label>
        <input style={formInputStyle} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={formLabelStyle}>Categories</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
          {categories.map((c) => {
            const active = form.category_ids?.includes(c.id);
            return (
              <CategoryChip key={c.id} name={c.name} active={active} onClick={() => {
                const ids = active ? form.category_ids.filter((x) => x !== c.id) : [...(form.category_ids || []), c.id];
                setForm({ ...form, category_ids: ids });
              }} small />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminPage({ user, services: initialServices, categories, onLogout, onBack }) {
  const [services, setServices] = useState(initialServices);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "", description: "", borough: "Manhattan", address: "", phone: "",
    website: "", eligibility: "", hours: "", category_ids: [],
  });
  const [saveSuccess, setSaveSuccess] = useState(null);

  const startEdit = (svc) => { setEditingId(svc.id); setEditForm({ ...svc }); setShowAdd(false); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const saveEdit = () => {
    setServices((prev) =>
      prev.map((s) => s.id === editingId ? { ...editForm, updated_at: new Date().toISOString().split("T")[0] } : s)
    );
    setSaveSuccess(editingId);
    setTimeout(() => setSaveSuccess(null), 1500);
    setEditingId(null);
  };
  const addService = () => {
    const svc = {
      ...newForm, id: "s" + Date.now(), is_active: true,
      last_verified_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString().split("T")[0],
    };
    setServices((prev) => [svc, ...prev]);
    setShowAdd(false);
    setNewForm({ name: "", description: "", borough: "Manhattan", address: "", phone: "", website: "", eligibility: "", hours: "", category_ids: [] });
    setSaveSuccess(svc.id);
    setTimeout(() => setSaveSuccess(null), 1500);
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.gray50, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Admin Header */}
      <div style={{
        background: theme.black, color: theme.white, padding: "16px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer",
            borderRadius: "8px", padding: "8px 12px", display: "flex", alignItems: "center",
            gap: "6px", color: theme.white, fontSize: "13px", fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <Icons.ArrowLeft /> Explorer
          </button>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
            Admin <span style={{ color: theme.yellow }}>Panel</span>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: theme.gray400 }}>{user.email}</span>
          <button onClick={onLogout} style={{
            background: theme.yellow, border: "none", cursor: "pointer", borderRadius: "8px",
            padding: "8px 16px", fontSize: "13px", fontWeight: 700, color: theme.black,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        {/* Add service button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: theme.black }}>
            All Services ({services.length})
          </h2>
          <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); }} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: showAdd ? theme.gray200 : theme.yellow,
            border: "none", cursor: "pointer", borderRadius: theme.radius,
            padding: "10px 18px", fontSize: "14px", fontWeight: 700, color: theme.black,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {showAdd ? <><Icons.X /> Cancel</> : <><Icons.Plus /> Add Service</>}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{
            background: theme.white, borderRadius: theme.radiusLg, padding: "24px",
            marginBottom: "20px", border: `2px solid ${theme.yellow}`, boxShadow: theme.shadow,
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>New Service</h3>
            <FormFields form={newForm} setForm={setNewForm} categories={categories} />
            <button onClick={addService} disabled={!newForm.name} style={{
              marginTop: "16px", background: theme.yellow, border: "none", cursor: "pointer",
              borderRadius: theme.radius, padding: "10px 24px", fontSize: "14px", fontWeight: 700,
              color: theme.black, fontFamily: "'DM Sans', sans-serif",
              opacity: newForm.name ? 1 : 0.5,
            }}>
              Save Service
            </button>
          </div>
        )}

        {/* Service list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {services.map((svc) => {
            const isEditing = editingId === svc.id;
            const justSaved = saveSuccess === svc.id;

            return (
              <div key={svc.id} style={{
                background: theme.white, borderRadius: theme.radiusLg, padding: "20px",
                border: `1.5px solid ${justSaved ? "#16a34a" : isEditing ? theme.yellow : theme.gray200}`,
                boxShadow: theme.shadow, transition: "border-color 0.3s ease",
              }}>
                {isEditing ? (
                  <>
                    <FormFields form={editForm} setForm={setEditForm} categories={categories} />
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                      <button onClick={saveEdit} style={{
                        background: theme.yellow, border: "none", cursor: "pointer",
                        borderRadius: theme.radiusSm, padding: "8px 20px", fontSize: "13px",
                        fontWeight: 700, color: theme.black, fontFamily: "'DM Sans', sans-serif",
                      }}>Save</button>
                      <button onClick={cancelEdit} style={{
                        background: theme.gray100, border: "none", cursor: "pointer",
                        borderRadius: theme.radiusSm, padding: "8px 20px", fontSize: "13px",
                        fontWeight: 600, color: theme.gray600, fontFamily: "'DM Sans', sans-serif",
                      }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: theme.black }}>
                          {svc.name}
                        </h3>
                        {justSaved && (
                          <span style={{
                            fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px",
                            background: "#F0FDF4", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>Saved</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", color: theme.gray400 }}>{svc.borough}</span>
                        <span style={{ fontSize: "12px", color: theme.gray300 }}>·</span>
                        {categories.filter((c) => svc.category_ids?.includes(c.id)).map((c) => (
                          <span key={c.id} style={{ fontSize: "11px", color: theme.gray500, fontWeight: 500 }}>{c.name}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button onClick={() => startEdit(svc)} style={{
                        background: theme.gray100, border: "none", cursor: "pointer",
                        borderRadius: theme.radiusSm, padding: "6px 12px",
                        display: "flex", alignItems: "center", gap: "4px",
                        fontSize: "12px", fontWeight: 600, color: theme.gray600,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        <Icons.Edit /> Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [page, setPage] = useState("explore"); // explore | login | admin
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [borough, setBorough] = useState("All");
  const [selectedCats, setSelectedCats] = useState([]);
  const [sort, setSort] = useState("recent");
  const [selectedService, setSelectedService] = useState(null);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Restore session on page load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser({ email: session.user.email, session });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser({ email: session.user.email, session });
      } else {
        setUser(null);
      }
    });

  return () => subscription.unsubscribe();
}, []);

  // Fetch services and categories from Supabase
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      const { data: svcs } = await supabase
        .from("services")
        .select("*")
        .order("updated_at", { ascending: false });

      const { data: links } = await supabase
        .from("service_categories")
        .select("*");

      const servicesWithCats = (svcs || []).map((s) => ({
        ...s,
        category_ids: (links || [])
          .filter((l) => l.service_id === s.id)
          .map((l) => l.category_id),
      }));

      setCategories(cats || []);
      setServices(servicesWithCats);
      setLoading(false);
    }

    fetchData();
  }, []);

  // Filtered services
  const filteredServices = useMemo(() => {
    let result = services.filter((s) => s.is_active);

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }

    if (borough !== "All") {
      result = result.filter((s) => s.borough === borough);
    }

    if (selectedCats.length > 0) {
      result = result.filter((s) =>
        selectedCats.some((cid) => s.category_ids.includes(cid))
      );
    }

    if (sort === "recent") {
      result.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [services, debouncedSearch, borough, selectedCats, sort]);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage("admin");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPage("explore");
  };

  const toggleCat = (id) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ---- LOGIN PAGE ----
  if (page === "login") {
    return <LoginPage onLogin={handleLogin} onBack={() => setPage("explore")} />;
  }

  // ---- ADMIN PAGE ----
  if (page === "admin") {
    if (!user) { setPage("login"); return null; }
    return (
      <AdminPage
        user={user} services={services} categories={categories}
        onLogout={handleLogout} onBack={() => setPage("explore")}
      />
    );
  }

  // ---- EXPLORE PAGE ----
  return (
    <div style={{ minHeight: "100vh", background: theme.gray50, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        input:focus, select:focus, textarea:focus { border-color: #FFD200 !important; outline: none; }
        ::selection { background: #FFD200; color: #111; }
      `}</style>

      {/* HEADER */}
      <header style={{
        background: theme.white, borderBottom: `1px solid ${theme.gray200}`,
        padding: "0 24px", height: "64px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: theme.yellow, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 800, color: theme.black,
          }}>
            S
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? "17px" : "14px", fontWeight: 800, color: theme.black }}>
            Streetlives <span style={{ fontWeight: 500, color: theme.gray500 }}>Service Explorer</span>
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {user && (
            <button onClick={() => setPage("admin")} style={{
              background: theme.black, color: theme.yellow, border: "none", cursor: "pointer",
              borderRadius: theme.radiusSm, padding: "7px 14px", fontSize: "13px", fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Admin
            </button>
          )}
          <button onClick={() => { user ? handleLogout() : setPage("login"); }} style={{
            background: user ? theme.gray100 : theme.yellow, border: "none", cursor: "pointer",
            borderRadius: theme.radiusSm, padding: "7px 14px", fontSize: "13px", fontWeight: 700,
            color: theme.black, fontFamily: "'DM Sans', sans-serif",
          }}>
            {user ? "Logout" : "Login"}
          </button>
        </div>
      </header>

      {/* HERO */}
      <div style={{
        background: theme.black, padding: isDesktop ? "48px 24px 40px" : "32px 20px 28px",
        textAlign: "center",
      }}>
        <h2 style={{
          margin: "0 0 8px", fontSize: isDesktop ? "32px" : "24px", fontWeight: 800,
          color: theme.white, lineHeight: 1.2,
        }}>
          Find <span style={{ color: theme.yellow }}>services</span> near you
        </h2>
        <p style={{ margin: 0, fontSize: "15px", color: theme.gray400, maxWidth: "440px", marginInline: "auto", lineHeight: 1.5 }}>
          Browse housing, food, legal, health, and employment services across all five NYC boroughs.
        </p>
      </div>

      {/* FILTERS */}
      <div style={{
        background: theme.white, borderBottom: `1px solid ${theme.gray200}`,
        padding: "20px 24px",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Row 1: Search + Borough + Sort */}
          <div style={{
            display: "flex", gap: "10px", flexWrap: "wrap",
          }}>
            <div style={{ position: "relative", flex: "1 1 280px", minWidth: "200px" }}>
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: theme.gray400 }}>
                <Icons.Search />
              </span>
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services..."
                style={{
                  width: "100%", padding: "11px 14px 11px 42px", fontSize: "14px",
                  border: `1.5px solid ${theme.gray200}`, borderRadius: theme.radius,
                  outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ position: "relative", flex: "0 0 auto" }}>
              <select
                value={borough} onChange={(e) => setBorough(e.target.value)}
                style={{
                  padding: "11px 36px 11px 14px", fontSize: "14px",
                  border: `1.5px solid ${theme.gray200}`, borderRadius: theme.radius,
                  outline: "none", fontFamily: "'DM Sans', sans-serif",
                  appearance: "none", background: theme.white, cursor: "pointer",
                  fontWeight: 600, color: borough === "All" ? theme.gray500 : theme.black,
                }}
              >
                {BOROUGHS.map((b) => <option key={b} value={b}>{b === "All" ? "All Boroughs" : b}</option>)}
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: theme.gray400 }}>
                <Icons.ChevronDown />
              </span>
            </div>

            <div style={{ position: "relative", flex: "0 0 auto" }}>
              <select
                value={sort} onChange={(e) => setSort(e.target.value)}
                style={{
                  padding: "11px 36px 11px 14px", fontSize: "14px",
                  border: `1.5px solid ${theme.gray200}`, borderRadius: theme.radius,
                  outline: "none", fontFamily: "'DM Sans', sans-serif",
                  appearance: "none", background: theme.white, cursor: "pointer",
                  fontWeight: 600, color: theme.gray500,
                }}
              >
                <option value="recent">Recently Updated</option>
                <option value="az">A – Z</option>
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: theme.gray400 }}>
                <Icons.ChevronDown />
              </span>
            </div>
          </div>

          {/* Row 2: Category chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: theme.gray400, marginRight: "4px" }}>Categories:</span>
            {categories.map((c) => (
              <CategoryChip
                key={c.id} name={c.name}
                active={selectedCats.includes(c.id)}
                onClick={() => toggleCat(c.id)}
              />
            ))}
            {selectedCats.length > 0 && (
              <button onClick={() => setSelectedCats([])} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 600, color: theme.gray400,
                fontFamily: "'DM Sans', sans-serif", textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
        <div style={{ marginBottom: "16px", fontSize: "13px", color: theme.gray500, fontWeight: 500 }}>
          {filteredServices.length} service{filteredServices.length !== 1 ? "s" : ""} found
        </div>

        {filteredServices.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px", color: theme.gray400,
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔍</div>
            <p style={{ fontSize: "16px", fontWeight: 600, color: theme.gray500, margin: "0 0 6px" }}>No services found</p>
            <p style={{ fontSize: "14px", margin: 0 }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(320px, 1fr))" : "1fr",
            gap: "16px",
          }}>
            {filteredServices.map((svc) => (
              <ServiceCard
                key={svc.id} service={svc} categories={categories}
                onClick={() => setSelectedService(svc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${theme.gray200}`, padding: "24px",
        textAlign: "center", fontSize: "12px", color: theme.gray400,
        background: theme.white, marginTop: "40px",
      }}>
        <span style={{ fontWeight: 700, color: theme.gray500 }}>Streetlives Service Explorer</span>
        <span style={{ margin: "0 8px" }}>·</span>
        Built with Supabase
        <span style={{ margin: "0 8px" }}>·</span>
        NYC 2025
      </footer>

      {/* Service Detail Modal/Drawer */}
      {selectedService && (
        <ServiceDetail
          service={selectedService} categories={categories}
          onClose={() => setSelectedService(null)} isDesktop={isDesktop}
        />
      )}
    </div>
  );
}