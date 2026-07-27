import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MagnifyingGlass, MapPin, Baby, ArrowCounterClockwise, Phone, Detective,
} from "@phosphor-icons/react";
import { api, fmtTime } from "../api";
import { Empty } from "../components/ui.jsx";
import { TableSkeleton } from "../components/skeletons.jsx";

export default function Children() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [busyBand, setBusyBand] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () => api.children({ q }).then((r) => alive && setRows(r)).catch(() => {});
    const id = setTimeout(load, q ? 250 : 0);
    const iv = setInterval(load, 10000);   // zones update as gateways report
    return () => { alive = false; clearTimeout(id); clearInterval(iv); };
  }, [q]);

  async function returnBand(code) {
    setBusyBand(code);
    try {
      await api.returnBand(code);
      setRows((r) => r.filter((c) => c.band_code !== code));
    } catch { /* refresh will fix it */ }
    setBusyBand("");
  }

  return (
    <div className="container section stack fade-in" style={{ maxWidth: 860, "--gap": "18px" }}>
      <div>
        <span className="eyebrow">Child safety</span>
        <h1>Children on wristbands</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: "60ch" }}>
          Bluetooth gateways update each child's zone as they move. If a child is
          separated from their guardian, search here for their last detected location.
        </p>
      </div>

      <div className="hero-search" style={{ maxWidth: "none", border: "1px solid var(--line-2)", boxShadow: "var(--shadow)" }}>
        <MagnifyingGlass size={19} color="var(--muted)" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Find a child — name, wristband code, guardian or ticket…" />
      </div>

      {!rows ? <div className="card card-p"><TableSkeleton rows={5} /></div>
        : rows.length === 0 ? (
          <Empty icon={<Detective size={26} weight="fill" />} title="No children on wristbands">
            {q ? "Nothing matches this search." : "Wristbands assigned at the gate will appear here with their live zone."}
          </Empty>
        ) : (
          <div className="ev-grid">
            {rows.map((c) => (
              <div key={c.id} className="card card-p stack" style={{ "--gap": "10px" }}>
                <div className="spread">
                  <strong className="row" style={{ gap: 8 }}>
                    <span className="empty-icon" style={{ width: 38, height: 38, borderRadius: 12, marginBottom: 0 }}>
                      <Baby size={20} weight="fill" />
                    </span>
                    {c.child_name}
                  </strong>
                  <span className="chip blue">{c.band_code}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {c.zone
                    ? <span className="chip green"><MapPin size={13} weight="fill" /> {c.zone}</span>
                    : <span className="chip">No sighting yet</span>}
                  {c.last_seen && (
                    <span className="muted" style={{ fontSize: ".8rem" }}>seen {timeAgo(c.last_seen)}</span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: ".85rem" }}>
                  Guardian: <strong style={{ color: "var(--ink)" }}>{c.guardian || "—"}</strong>
                  {c.guardian_phone && (
                    <a className="row" style={{ display: "inline-flex", gap: 4, color: "var(--green-700)", marginLeft: 8 }}
                      href={`tel:${c.guardian_phone}`}><Phone size={13} weight="fill" />{c.guardian_phone}</a>
                  )}
                  {" · "}
                  <Link to={`/t/${c.qr_token}`} style={{ color: "var(--green-700)" }}>{c.ticket_number}</Link>
                  {" · in since "}{fmtTime(c.assigned_at)}
                </div>
                <button className="btn btn-ghost btn-sm" disabled={busyBand === c.band_code}
                  onClick={() => returnBand(c.band_code)}>
                  <ArrowCounterClockwise weight="bold" />
                  {busyBand === c.band_code ? "Returning…" : "Band returned"}
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function timeAgo(iso) {
  const mins = Math.max(Math.round((Date.now() - new Date(iso)) / 60000), 0);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}
