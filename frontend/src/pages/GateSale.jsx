import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Baby, Car, Phone, Ticket as TicketIcon, ArrowRight, Clock,
} from "@phosphor-icons/react";
import { api, money } from "../api";
import { PayPicker, Qty, Spinner } from "../components/ui.jsx";

export default function GateSale() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState("");

  const [pkg, setPkg] = useState(null);
  const [opt, setOpt] = useState(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reg, setReg] = useState("");
  const [vtype, setVtype] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState("CASH");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.config().then((c) => {
      setCfg(c);
      setPkg(c.packages[0] || null);
      setOpt(c.time_options[0] || null);
    }).catch((e) => setErr(e.message));
  }, []);

  const totalUsd = useMemo(() => {
    if (!pkg) return 0;
    return (
      Number(pkg.adult_price_usd) * adults
      + Number(pkg.child_price_usd) * children
      + (reg.trim() ? Number(pkg.vehicle_fee_usd) : 0)
    );
  }, [pkg, adults, children, reg]);

  const total = currency === "ZIG" && cfg ? totalUsd * Number(cfg.zig_per_usd) : totalUsd;

  async function issue() {
    if (!pkg || !opt || busy) return;
    setBusy(true);
    setErr("");
    try {
      const t = await api.issueTicket({
        package: pkg.id, time_option: opt.id,
        adults, children,
        visitor_name: name.trim(), phone: phone.trim(),
        vehicle_reg: reg.trim(), vehicle_type: vtype.trim(),
        currency, payment_method: method,
      });
      nav(`/t/${t.qr_token}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (err && !cfg) return (
    <div className="container section"><div className="chip red">{err}</div></div>
  );
  if (!cfg) return <Spinner />;

  return (
    <div className="container section stack fade-in" style={{ "--gap": "22px" }}>
      <div>
        <span className="eyebrow">At the gate</span>
        <h1>New entry</h1>
      </div>

      <div className="grid-cols">
        {/* Left: the sale form */}
        <div className="stack" style={{ "--gap": "18px" }}>
          <div className="card card-p stack">
            <h3>1 · Package</h3>
            <div className="dist-grid">
              {cfg.packages.map((p) => (
                <button key={p.id} type="button"
                  className={`dist ${pkg?.id === p.id ? "selected" : ""}`}
                  onClick={() => setPkg(p)}>
                  <span className="dist-badge" style={{ fontSize: "1.5rem" }}>{p.emoji}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <strong className="clamp-1">{p.name}</strong>
                    <span className="muted clamp-1" style={{ display: "block", fontSize: ".82rem" }}>
                      {p.description}
                    </span>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <span className="price">{money(p.adult_price_usd)}</span>
                    <span className="muted" style={{ display: "block", fontSize: ".76rem" }}>
                      child {money(p.child_price_usd)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card card-p stack">
            <h3>2 · Time &amp; party</h3>
            <div className="row wrap" style={{ gap: 8 }}>
              {cfg.time_options.map((o) => (
                <button key={o.id} type="button"
                  className={`cat-chip ${opt?.id === o.id ? "active" : ""}`}
                  onClick={() => setOpt(o)}>
                  <Clock size={15} weight="bold" /> {o.label}
                </button>
              ))}
            </div>
            {opt && !opt.minutes && (
              <p className="muted" style={{ fontSize: ".85rem" }}>
                Full day tickets expire at closing time ({cfg.closing_time}).
              </p>
            )}
            <div className="grid-2">
              <div className="tt-row">
                <span className="tt-info row" style={{ gap: 10 }}>
                  <User size={20} weight="fill" color="var(--green-600)" />
                  <span><strong className="name">Adults</strong>
                    <span className="desc" style={{ display: "block" }}>{money(pkg?.adult_price_usd || 0)} each</span></span>
                </span>
                <Qty value={adults} onChange={setAdults} />
              </div>
              <div className="tt-row">
                <span className="tt-info row" style={{ gap: 10 }}>
                  <Baby size={20} weight="fill" color="var(--green-600)" />
                  <span><strong className="name">Children</strong>
                    <span className="desc" style={{ display: "block" }}>{money(pkg?.child_price_usd || 0)} each</span></span>
                </span>
                <Qty value={children} onChange={setChildren} />
              </div>
            </div>
          </div>

          <div className="card card-p stack">
            <h3>3 · Visitor details <span className="muted" style={{ fontWeight: 400, fontSize: ".85rem" }}>(optional)</span></h3>
            <div className="grid-2">
              <label className="field">
                <label>Visitor name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tendai Moyo" />
              </label>
              <label className="field">
                <label><Phone size={12} weight="fill" /> Phone (for WhatsApp / SMS)</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 …" />
              </label>
            </div>
            <div className="grid-2">
              <label className="field">
                <label><Car size={12} weight="fill" /> Vehicle registration</label>
                <input className="input" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="e.g. ABZ 4521" />
              </label>
              <label className="field">
                <label>Vehicle type</label>
                <input className="input" value={vtype} onChange={(e) => setVtype(e.target.value)} placeholder="Sedan / SUV / Bus" />
              </label>
            </div>
            {reg.trim() && Number(pkg?.vehicle_fee_usd) > 0 && (
              <span className="chip gold">Vehicle fee {money(pkg.vehicle_fee_usd)} added</span>
            )}
          </div>

          <div className="card card-p stack">
            <div className="spread">
              <h3>4 · Payment</h3>
              <div className="seg">
                {["USD", "ZIG"].map((c) => (
                  <button key={c} type="button" className={currency === c ? "on" : ""}
                    onClick={() => setCurrency(c)}>{c === "ZIG" ? "ZiG" : "USD"}</button>
                ))}
              </div>
            </div>
            <PayPicker value={method} onChange={setMethod} />
          </div>
        </div>

        {/* Right: sticky summary */}
        <div className="summary">
          <div className="card card-p stack">
            <h3 className="row"><TicketIcon weight="fill" color="var(--green-600)" /> Summary</h3>
            <div className="info-list">
              <Row k="Package" v={pkg ? `${pkg.emoji} ${pkg.name}` : "—"} />
              <Row k="Time" v={opt?.label || "—"} />
              <Row k="Party" v={`${adults} adult${adults === 1 ? "" : "s"}${children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}`} />
              {reg.trim() && <Row k="Vehicle" v={`${reg.toUpperCase()}${vtype ? ` · ${vtype}` : ""}`} />}
            </div>
            <div className="hair" />
            <div className="spread">
              <span className="muted">Total</span>
              <span className="tt-price" style={{ fontSize: "1.7rem" }}>{money(total, currency)}</span>
            </div>
            {currency === "ZIG" && (
              <span className="muted" style={{ fontSize: ".8rem" }}>
                ≈ {money(totalUsd)} at {Number(cfg.zig_per_usd)} ZiG/USD
              </span>
            )}
            {err && <span className="chip red">{err}</span>}
            <button className="btn btn-gold btn-lg btn-block" disabled={busy || !pkg || !opt || adults + children < 1}
              onClick={issue}>
              {busy ? "Issuing…" : <>Issue ticket <ArrowRight weight="bold" /></>}
            </button>
            <p className="muted center" style={{ fontSize: ".8rem" }}>
              Generates a QR ticket with number &amp; expiry — print or send via WhatsApp/SMS on the next screen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="info-row">
      <div className="grow"><div className="k">{k}</div><div className="v">{v}</div></div>
    </div>
  );
}
