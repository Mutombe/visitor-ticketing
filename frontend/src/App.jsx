import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Storefront, QrCode, ClockCounterClockwise, ChartBar, IdentificationBadge,
  GearSix, SignOut, CaretDown, Detective,
} from "@phosphor-icons/react";
import { api, PAYMENTS, ROLES, canReport, canSell, isAdmin } from "./api";
import { setCached } from "./cache";
import { useAuth } from "./auth.jsx";

export default function App() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  // Warm the API (free-tier backends sleep) and pre-fill the config cache.
  useEffect(() => {
    if (user && canSell(user.role)) {
      api.config().then((c) => setCached("config", c)).catch(() => {});
    }
  }, [user]);

  const role = user?.role;
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to={user ? (canSell(role) ? "/" : "/scan") : "/login"} className="brand">
            <img src="/t-favicon.png" alt="" className="brand-logo" />
            <span>Gate<span className="brand-boy">pass</span></span>
          </Link>
          {user && (
            <div className="row" style={{ gap: 10 }}>
              <nav className="nav-links">
                {canSell(role) && (
                  <NavLink to="/" end>
                    <Storefront size={20} weight="fill" /> <span className="label">Gate</span>
                  </NavLink>
                )}
                <NavLink to="/scan">
                  <QrCode size={20} weight="fill" /> <span className="label">Security</span>
                </NavLink>
                <NavLink to="/children">
                  <Detective size={20} weight="fill" /> <span className="label">Children</span>
                </NavLink>
                <NavLink to="/history">
                  <ClockCounterClockwise size={20} weight="bold" /> <span className="label">History</span>
                </NavLink>
                {canReport(role) && (
                  <NavLink to="/reports">
                    <ChartBar size={20} weight="fill" /> <span className="label">Reports</span>
                  </NavLink>
                )}
                {isAdmin(role) && (
                  <NavLink to="/settings">
                    <GearSix size={20} weight="fill" /> <span className="label">Settings</span>
                  </NavLink>
                )}
              </nav>
              <UserMenu />
            </div>
          )}
        </div>
      </header>

      <main><Outlet /></main>

      <footer className="footer">
        <div className="container stack" style={{ "--gap": "16px" }}>
          <div className="hair" />
          <div className="footer-row footer-bottom">
            <div className="row">
              <img src="/t-favicon.png" alt="" className="brand-logo" />
              <strong style={{ color: "var(--green-900)" }}>Gate<span className="brand-boy">pass</span></strong>
              <span className="muted hide-mobile">· Visitor management, ticketing &amp; child safety</span>
            </div>
            <div className="pay-strip">
              {Object.values(PAYMENTS).filter((p) => p.logo).map((p) => (
                <span className="pay-badge" key={p.label}><img src={p.logo} alt={p.label} /></span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const initials = (user.name || user.username || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="row" onClick={() => setOpen((o) => !o)}
        style={{ border: "none", background: "none", cursor: "pointer", gap: 6, padding: 0 }}>
        <div className="avatar">{initials}</div>
        <CaretDown size={13} weight="bold" className="hide-mobile" />
      </button>
      {open && (
        <div className="menu fade-in">
          <div style={{ padding: "8px 12px" }}>
            <strong style={{ display: "block", fontSize: ".92rem" }}>{user.name}</strong>
            <span className="muted row" style={{ fontSize: ".8rem", gap: 5 }}>
              <IdentificationBadge size={14} /> {ROLES[user.role] || user.role}
            </span>
          </div>
          <div className="divider" />
          <button onClick={logout}><SignOut size={17} /> Sign out</button>
        </div>
      )}
    </div>
  );
}
