// Gatepass API client — visitor gate ticketing.
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const TOKEN_KEY = "gp_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function req(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (res.status === 401 && token && !path.startsWith("/auth/")) {
    // session expired — clear it and go back to login
    setToken(null);
    localStorage.removeItem("gp_user");
    window.location.assign("/login");
    throw new Error("Session expired — please sign in again.");
  }
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
  // auth
  login: (username, password) =>
    req("/auth/login/", { method: "POST", body: JSON.stringify({ username, password }) }),
  googleLogin: (payload) =>
    req("/auth/google/", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => req("/auth/logout/", { method: "POST" }),
  me: () => req("/auth/me/"),
  // public storefront
  publicConfig: () => req("/public/config/"),
  publicOrder: (payload) =>
    req("/public/orders/", { method: "POST", body: JSON.stringify(payload) }),
  myTickets: () => req("/tickets/mine/"),
  // gate
  config: () => req("/config/"),
  issueTicket: (payload) => req("/tickets/", { method: "POST", body: JSON.stringify(payload) }),
  tickets: (params) => req(`/tickets/${qs(params)}`),
  ticket: (ref) => req(`/tickets/${ref}/`),
  exit: (ref, payload) =>
    req(`/tickets/${ref}/exit/`, { method: "POST", body: JSON.stringify(payload || {}) }),
  // security + child safety
  security: () => req("/security/"),
  children: (params) => req(`/children/${qs(params)}`),
  assignBand: (ref, payload) =>
    req(`/tickets/${ref}/bands/`, { method: "POST", body: JSON.stringify(payload) }),
  returnBand: (code) => req(`/bands/${code}/return/`, { method: "POST" }),
  // management
  reports: (params) => req(`/reports/${qs(params)}`),
  // admin
  admin: {
    list: (kind) => req(`/admin/${kind}/`),
    create: (kind, payload) =>
      req(`/admin/${kind}/`, { method: "POST", body: JSON.stringify(payload) }),
    update: (kind, id, payload) =>
      req(`/admin/${kind}/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (kind, id) => req(`/admin/${kind}/${id}/`, { method: "DELETE" }),
    config: () => req("/admin/config/"),
    saveConfig: (payload) =>
      req("/admin/config/", { method: "PATCH", body: JSON.stringify(payload) }),
  },
};

// role helpers
export const ROLES = {
  ADMIN: "Administrator", MANAGER: "Manager", CASHIER: "Gate cashier", SECURITY: "Security",
};
export const isStaff = (r) => ["ADMIN", "MANAGER", "CASHIER", "SECURITY"].includes(r);
export const canSell = (r) => ["ADMIN", "MANAGER", "CASHIER"].includes(r);
export const canReport = (r) => ["ADMIN", "MANAGER"].includes(r);
export const isAdmin = (r) => r === "ADMIN";

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
