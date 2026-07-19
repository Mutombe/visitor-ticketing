// Gatepass API client — visitor gate ticketing.
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || (Array.isArray(body) ? body[0] : JSON.stringify(body));
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

const qs = (params) => {
  const s = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null && v !== "")
  ).toString();
  return s ? `?${s}` : "";
};

export const api = {
  config: () => req("/config/"),
  issueTicket: (payload) => req("/tickets/", { method: "POST", body: JSON.stringify(payload) }),
  tickets: (params) => req(`/tickets/${qs(params)}`),
  ticket: (ref) => req(`/tickets/${ref}/`),
  exit: (ref, payload) =>
    req(`/tickets/${ref}/exit/`, { method: "POST", body: JSON.stringify(payload || {}) }),
  reports: (params) => req(`/reports/${qs(params)}`),
};

// --- helpers -----------------------------------------------------------------
export const money = (amount, currency = "USD") =>
  currency === "ZIG"
    ? `ZiG ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `$${Number(amount).toFixed(Number(amount) % 1 ? 2 : 0)}`;

export const PAYMENTS = {
  CASH:     { label: "Cash",     color: "#0B7A3E", short: "$" },
  ECOCASH:  { label: "EcoCash",  color: "#0A8A3D", short: "EC", logo: "/payment/ecocash.png" },
  ONEMONEY: { label: "OneMoney", color: "#E85D04", short: "1$", logo: "/payment/one-money.png" },
  INNBUCKS: { label: "InnBucks", color: "#6A3FB0", short: "IB", logo: "/payment/innbucks.png" },
  OMARI:    { label: "O'mari",   color: "#1F8A70", short: "OM", logo: "/payment/omari.png" },
  ZIPIT:    { label: "ZimSwitch", color: "#1F5FA8", short: "ZS", logo: "/payment/zimswitch.png" },
  CARD:     { label: "Visa / Mastercard", color: "#1A1F71", short: "VM", logo: "/payment/visa-mastercard.png" },
};

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");
export const ticketUrl = (qr) => `${origin()}/t/${qr}`;
export const waShare = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const waTo = (phone, text) =>
  `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
export const smsTo = (phone, text) =>
  `sms:${phone || ""}?body=${encodeURIComponent(text)}`;

export const fmtDate = (iso, opts) =>
  new Date(iso).toLocaleDateString("en-GB", opts || {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/* "1h 24m" / "37m" — remaining time from seconds */
export const fmtRemaining = (secs) => {
  if (secs <= 0) return "0m";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

/* live remaining seconds from an expires_at ISO string */
export const remainingSecs = (expiresAt) =>
  Math.max(Math.floor((new Date(expiresAt) - Date.now()) / 1000), 0);
