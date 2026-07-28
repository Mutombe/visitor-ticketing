import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, ClockCounterClockwise } from "@phosphor-icons/react";
import { api, fmtTime, money, remainingSecs, fmtRemaining } from "../api";
import { Empty } from "../components/ui.jsx";
import { TableSkeleton } from "../components/skeletons.jsx";
import { useCached } from "../useCached.js";

const STATES = [
  ["", "All"], ["VALID", "Inside"], ["EXPIRED", "Overdue"], ["EXITED", "Exited"],
];

export default function History() {
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");   // debounced search term
  const [state, setState] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const id = setTimeout(() => setQd(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  const { data: rows } = useCached(
    `hist:${date}:${state}:${qd}`,
    () => api.tickets({ q: qd, state, date })
  );

  return (
    <div className="container section stack fade-in" style={{ "--gap": "18px" }}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Visitor history</span>
          <h1>Tickets</h1>
        </div>
        <input type="date" className="select" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="card card-p stack">
        <div className="row wrap">
          <div className="hero-search grow" style={{ maxWidth: "none", boxShadow: "none", border: "1px solid var(--line-2)" }}>
            <MagnifyingGlass size={19} color="var(--muted)" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, name, phone or plate…" />
          </div>
          <div className="seg">
            {STATES.map(([v, label]) => (
              <button key={v} className={state === v ? "on" : ""} onClick={() => setState(v)}>{label}</button>
            ))}
          </div>
        </div>

        {!rows ? <TableSkeleton /> : rows.length === 0 ? (
          <Empty icon={<ClockCounterClockwise size={26} weight="bold" />} title="No tickets">
            Nothing matches this search for {date}.
          </Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ticket</th><th>Package</th><th>Party</th>
                  <th className="col-desktop">Vehicle</th>
                  <th>Paid</th><th>Status</th><th className="col-desktop">Entered</th>
                </tr>
              </thead>
              <tbody className="cascade">
                {rows.map((t) => <RowT key={t.number} t={t} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RowT({ t }) {
  const secs = t.status === "ACTIVE" ? remainingSecs(t.expires_at) : 0;
  const chip = t.status === "EXITED"
    ? <span className="chip">Exited {fmtTime(t.exited_at)}</span>
    : t.status === "CANCELLED"
    ? <span className="chip red">Cancelled</span>
    : secs > 0
    ? <span className="chip green">⏳ {fmtRemaining(secs)} left</span>
    : <span className="chip red">Expired · owes {money(t.overstay_due, t.currency)}</span>;
  return (
    <tr>
      <td><Link to={`/t/${t.qr_token}`} style={{ color: "var(--green-700)", fontWeight: 700 }}>{t.number}</Link></td>
      <td>{t.package_emoji} {t.package_name}</td>
      <td>{t.adults}A{t.children ? ` + ${t.children}C` : ""}</td>
      <td className="col-desktop muted">{t.vehicle_reg || "—"}</td>
      <td>{money(t.total, t.currency)}{Number(t.overstay_fee) > 0 && <span className="muted"> +{money(t.overstay_fee, t.currency)}</span>}</td>
      <td>{chip}</td>
      <td className="col-desktop muted">{fmtTime(t.issued_at)}</td>
    </tr>
  );
}
