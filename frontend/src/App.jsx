import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Storefront, QrCode, ClockCounterClockwise, ChartBar,
} from "@phosphor-icons/react";
import { PAYMENTS } from "./api";

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <img src="/t-favicon.png" alt="" className="brand-logo" />
            <span>Gate<span className="brand-boy">pass</span></span>
          </Link>
          <nav className="nav-links">
            <NavLink to="/" end>
              <Storefront size={20} weight="fill" /> <span className="label">Gate</span>
            </NavLink>
            <NavLink to="/scan">
              <QrCode size={20} weight="fill" /> <span className="label">Scan exit</span>
            </NavLink>
            <NavLink to="/history">
              <ClockCounterClockwise size={20} weight="bold" /> <span className="label">History</span>
            </NavLink>
            <NavLink to="/reports">
              <ChartBar size={20} weight="fill" /> <span className="label">Reports</span>
            </NavLink>
          </nav>
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
              <span className="muted hide-mobile">· Visitor gate ticketing</span>
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
