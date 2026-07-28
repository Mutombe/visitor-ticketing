import { useState } from "react";
import {
  Ticket as TicketIcon, UsersThree, CurrencyDollar, Car, HourglassHigh, HouseLine,
} from "@phosphor-icons/react";
import { api, fmtTime, money, PAYMENTS } from "../api";
import { MixBar, Stat } from "../components/ui.jsx";
import { ReportsSkeleton } from "../components/skeletons.jsx";
import { useCached } from "../useCached.js";

const today = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const { data: d, error } = useCached(`reports:${from}:${to}`, () => api.reports({ from, to }));

  return (
    <div className="container section stack fade-in" style={{ "--gap": "20px" }}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Reports</span>
          <h1>Gate performance</h1>
        </div>
        <div className="row">
          <input type="date" className="select" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted">→</span>
          <input type="date" className="select" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {!d && !error && <ReportsSkeleton />}
      {error && !d && <div className="chip red">Could not load reports.</div>}
      {d && (
        <>
          <div className="stats">
            <Stat v={d.tickets} k={<><TicketIcon size={13} weight="fill" /> Tickets</>} />
            <Stat v={d.visitors} k={<><UsersThree size={13} weight="fill" /> Visitors ({d.adults}A / {d.children}C)</>} />
            <Stat v={money(d.revenue.USD)} k={<><CurrencyDollar size={13} weight="fill" /> Revenue + {money(d.revenue.ZIG, "ZIG")}</>} />
            <Stat v={d.inside_now} k={<><HouseLine size={13} weight="fill" /> Inside now</>} />
          </div>
          <div className="stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <Stat v={`${money(d.overstay.USD)} · ${money(d.overstay.ZIG, "ZIG")}`}
              k={<><HourglassHigh size={13} weight="fill" /> Overstay fees collected</>} />
            <Stat v={d.vehicles} k={<><Car size={13} weight="fill" /> Vehicles</>} />
          </div>
          <div className="stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <Stat v={d.children_banded_now} k="Children on wristbands now" />
            <Stat v={d.bands_used} k="Wristbands used in range" />
          </div>

          <div className="grid-2">
            <div className="card card-p stack cascade">
              <h3>Package mix</h3>
              {d.package_mix.length === 0 && <p className="muted">No sales in this range.</p>}
              {d.package_mix.map((p) => (
                <MixBar key={p.name}
                  left={<strong>{p.emoji} {p.name}</strong>}
                  right={`${p.tickets} tickets · ${p.visitors} visitors · ${money(p.revenue_usd)}`}
                  pct={(p.tickets / (d.tickets || 1)) * 100} />
              ))}
            </div>
            <div className="card card-p stack cascade">
              <h3>Payment mix</h3>
              {Object.entries(d.payment_mix).sort((a, b) => b[1] - a[1]).map(([m, n]) => {
                const p = PAYMENTS[m] || { label: m, color: "#999", short: "?" };
                const total = Object.values(d.payment_mix).reduce((a, b) => a + b, 0) || 1;
                return (
                  <MixBar key={m} color={p.color}
                    left={<>
                      <span className="logo" style={{ background: p.color, width: 24, height: 24, fontSize: ".65rem" }}>{p.short}</span>
                      {p.label}
                    </>}
                    right={`${n} · ${Math.round((n / total) * 100)}%`}
                    pct={(n / total) * 100} />
                );
              })}
            </div>
          </div>

          <div className="card card-p stack cascade">
            <h3>Staff activity</h3>
            {(d.staff_activity || []).map((s) => (
              <MixBar key={s.name}
                left={<strong>{s.name}</strong>}
                right={`${s.tickets} tickets · ${money(s.revenue_usd)}`}
                pct={(s.tickets / (d.tickets || 1)) * 100} />
            ))}
          </div>

          <div className="card card-p stack">
            <h3>Entries by hour</h3>
            <div className="row" style={{ alignItems: "flex-end", gap: 6, height: 120 }}>
              {d.hourly.map((h) => {
                const max = Math.max(...d.hourly.map((x) => x.count), 1);
                return (
                  <div key={h.hour} className="grow center" style={{ minWidth: 0 }}>
                    <div title={`${h.count} at ${h.hour}:00`} style={{
                      height: `${(h.count / max) * 90}px`,
                      background: h.count ? "linear-gradient(180deg, var(--green-500), var(--green-600))" : "var(--paper-2)",
                      borderRadius: 6, minHeight: 4,
                    }} />
                    <span className="muted" style={{ fontSize: ".62rem" }}>{h.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card card-p stack">
            <h3>Recent tickets</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th>Ticket</th><th>Package</th><th>Party</th><th>Paid</th><th className="hide-mobile">Time</th></tr></thead>
                <tbody className="cascade">
                  {d.recent.map((t) => (
                    <tr key={t.number}>
                      <td className="muted">{t.number}</td>
                      <td><strong>{t.package_emoji} {t.package_name}</strong></td>
                      <td>{t.adults}A{t.children ? ` + ${t.children}C` : ""}</td>
                      <td>{money(t.total, t.currency)}</td>
                      <td className="hide-mobile muted">{fmtTime(t.issued_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
