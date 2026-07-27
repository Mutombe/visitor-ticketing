import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Storefront, QrCode, ClockCounterClockwise, ChartBar, IdentificationBadge,
  GearSix, SignOut, SignIn, CaretDown, Detective, Ticket as TicketIcon,
  ShoppingBagOpen,
} from "@phosphor-icons/react";
import { api, PAYMENTS, ROLES, canReport, canSell, isAdmin, isStaff } from "./api";
import { setCached } from "./cache";
import { useAuth } from "./auth.jsx";

export default function App() {
  const { pathname } = useLocation();
  const { user, openSignIn } = useAuth();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  // Warm the API (free-tier backends sleep) and pre-fill caches.
  useEffect(() => {
    api.publicConfig().then((c) => setCached("public-config", c)).catch(() => {});
    if (user && canSell(user.role)) {
      api.config().then((c) => setCached("config", c)).catch(() => {});
    }
  }, [user]);

  const role = user?.role;
  const staff = isStaff(role);
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <img src="/t-favicon.png" alt="" className="brand-logo" />
            <span>Gate<span className="brand-boy">pass</span></span>
          </Link>
          <div className="row" style={{ gap: 10 }}>
            <nav className="nav-links">
              {!staff && (
                <>
                  <NavLink to="/" end>
                    <ShoppingBagOpen size={20} weight="fill" /> <span className="label">Buy tickets</span>
                  </NavLink>
                  <NavLink to="/tickets">
                    <TicketIcon size={20} weight="fill" /> <span className="label">My tickets</span>
                  </NavLink>
                </>
              )}
              {staff && canSell(role) && (
                <NavLink to="/gate">
                  <Storefront size={20} weight="fill" /> <span className="label">Gate</span>
                </NavLink>
              )}
              {staff && (
                <>
                  <NavLink to="/scan">
                    <QrCode size={20} weight="fill" /> <span className="label">Security</span>
                  </NavLink>
                  <NavLink to="/children">
                    <Detective size={20} weight="fill" /> <span className="label">Children</span>
                  </NavLink>
                  <NavLink to="/history">
                    <ClockCounterClockwise size={20} weight="bold" /> <span className="label">History</span>
                  </NavLink>
                </>
              )}
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
            {user ? <UserMenu /> : (
              <button className="btn btn-ghost btn-sm" onClick={openSignIn}>
                <SignIn weight="bold" /> <span className="hide-mobile">Sign in</span>
              </button>
            )}
          </div>
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
        {user.avatar_url
          ? <img className="avatar" src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
          : <div className="avatar">{initials}</div>}
        <CaretDown size={13} weight="bold" className="hide-mobile" />
      </button>
      {open && (
        <div className="menu fade-in">
          <div style={{ padding: "8px 12px" }}>
            <strong style={{ display: "block", fontSize: ".92rem" }}>{user.name}</strong>
            <span className="muted row" style={{ fontSize: ".8rem", gap: 5 }}>
              <IdentificationBadge size={14} /> {ROLES[user.role] || user.email || "Visitor"}
            </span>
          </div>
          <div className="divider" />
          {!isStaff(user.role) && (
            <Link to="/tickets" onClick={() => setOpen(false)}>
              <TicketIcon size={17} /> My tickets
            </Link>
          )}
          <button onClick={logout}><SignOut size={17} /> Sign out</button>
        </div>
      )}
    </div>
  );
}
