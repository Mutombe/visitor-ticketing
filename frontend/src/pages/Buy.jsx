import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Baby, Phone, EnvelopeSimple, Ticket as TicketIcon, ArrowRight, Clock,
  ShieldCheck, QrCode, Timer,
} from "@phosphor-icons/react";
import { api, money } from "../api";
import { useAuth } from "../auth.jsx";
import { PayPicker, Qty } from "../components/ui.jsx";
import { GateSkeleton } from "../components/skeletons.jsx";
import { useCached } from "../useCached.js";
import { setCached } from "../cache.js";

export default function Buy() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: cfg, error: cfgErr } = useCached("public-config", api.publicConfig);
  const [err, setErr] = useState("");

  const [pkg, setPkg] = useState(null);
  const [opt, setOpt] = useState(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState("ECOCASH");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    setPkg((p) => p || cfg.packages[0] || null);
    setOpt((o) => o || cfg.time_options[0] || null);
  }, [cfg]);

  useEffect(() => {
    if (user) {
      setName((n) => n || user.name || "");
      setEmail((e) => e || user.email || "");
    }
  }, [user]);

  const hourly = pkg?.pricing === "HOURLY";
  const groups = useMemo(() => {
    const g = {};
    (cfg?.packages || []).forEach((p) => (g[p.group] = g[p.group] || []).push(p));
    return g;
  }, [cfg]);

  const totalUsd = useMemo(() => {
    if (!pkg) return 0;
    let perPerson = Number(pkg.adult_price_usd) * adults + Number(pkg.child_price_usd) * children;
    if (hourly) perPerson *= (opt?.minutes || 60) / 60;
    return perPerson;
  }, [pkg, opt, hourly, adults, children]);
  const total = currency === "ZIG" && cfg ? totalUsd * Number(cfg.zig_per_usd) : totalUsd;

  async function pay() {
    if (!pkg || busy) return;
    setBusy(true); setErr("");
    try {
      const t = await api.publicOrder({
        package: pkg.id, time_option: hourly ? opt.id : null,
        adults, children,
        visitor_name: name.trim(), phone: phone.trim(), email: email.trim(),
        currency, payment_method: method,
      });
      setCached(`ticket:${t.qr_token}`, t);
      nav(`/t/${t.qr_token}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  if (cfgErr && !cfg) return (
    <div className="container section"><div className="chip red">{cfgErr.message}</div></div>
  );
  if (!cfg) return <GateSkeleton />;

  return (
    <div className="container section stack fade-in" style={{ "--gap": "26px" }}>
      {/* Hero */}
      <div className="hero">
        <img src="/t-favicon.png" alt="" className="hero-mark" aria-hidden="true" />
        <div className="hero-content stack" style={{ "--gap": "14px" }}>
          <span className="eyebrow" style={{ color: "var(--brass-bright)" }}>{cfg.venue_name} · {cfg.venue_city}</span>
          <h1>Skip the queue — <em>get your ticket now</em></h1>
          <p>
            Pick a package, pay with EcoCash or card, and walk in with a QR ticket
            on your phone. No app, no account needed.
          </p>
          <div className="meta">
            <span className="row"><QrCode size={17} weight="fill" /> QR entry</span>
            <span className="row"><Timer size={17} weight="fill" /> Timed tickets</span>
            <span className="row"><ShieldCheck size={17} weight="fill" /> Child safety wristbands at the gate</span>
          </div>
        </div>
      </div>

      <div className="grid-cols">
        <div className="stack" style={{ "--gap": "18px" }}>
          <div className="card card-p stack">
            <h3>Choose your package</h3>
            {Object.entries(groups).map(([group, list]) => (
              <div key={group} className="stack" style={{ "--gap": "10px" }}>
                <span className="eyebrow">{group}</span>
                <div className="dist-grid">
                  {list.map((p) => (
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
                        <span className="price">{priceMain(p)}</span>
                        <span className="muted" style={{ display: "block", fontSize: ".76rem" }}>
                          {priceSub(p)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card card-p stack">
            <h3>Time &amp; tickets</h3>
            {hourly ? (
              <div className="row wrap" style={{ gap: 8 }}>
                {cfg.time_options.map((o) => (
                  <button key={o.id} type="button"
                    className={`cat-chip ${opt?.id === o.id ? "active" : ""}`}
                    onClick={() => setOpt(o)}>
                    <Clock size={15} weight="bold" /> {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="chip gold" style={{ alignSelf: "flex-start" }}>
                <Clock size={14} weight="bold" />
                {pkg?.fixed_minutes
                  ? `${pkg.fixed_minutes / 60} hours included`
                  : `Valid all day until closing (${cfg.closing_time})`}
              </span>
            )}
            <div className="grid-2">
              <div className="tt-row">
                <span className="tt-info row" style={{ gap: 10 }}>
                  <User size={20} weight="fill" color="var(--green-600)" />
                  <span><strong className="name">Adults</strong>
                    <span className="desc" style={{ display: "block" }}>{eachLabel(pkg?.adult_price_usd, hourly)}</span></span>
                </span>
                <Qty value={adults} onChange={setAdults} />
              </div>
              <div className="tt-row">
                <span className="tt-info row" style={{ gap: 10 }}>
                  <Baby size={20} weight="fill" color="var(--green-600)" />
                  <span><strong className="name">Children</strong>
                    <span className="desc" style={{ display: "block" }}>{eachLabel(pkg?.child_price_usd, hourly)}</span></span>
                </span>
                <Qty value={children} onChange={setChildren} />
              </div>
            </div>
          </div>

          <div className="card card-p stack">
            <h3>Your details</h3>
            <label className="field">
              <label>Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Who is this ticket for?" />
            </label>
            <div className="grid-2">
              <label className="field">
                <label><Phone size={12} weight="fill" /> Phone (WhatsApp/SMS ticket)</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 …" />
              </label>
              <label className="field">
                <label><EnvelopeSimple size={12} weight="fill" /> Email (optional)</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
            </div>
          </div>

          <div className="card card-p stack">
            <div className="spread">
              <h3>Pay with</h3>
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

        {/* Sticky order summary */}
        <div className="summary">
          <div className="card card-p stack">
            <h3 className="row"><TicketIcon weight="fill" color="var(--green-600)" /> Your ticket</h3>
            <div className="info-list">
              <Row k="Package" v={pkg ? `${pkg.emoji} ${pkg.name}` : "—"} />
              <Row k="Time" v={!pkg ? "—" : hourly ? (opt?.label || "—")
                : pkg.fixed_minutes ? `${pkg.fixed_minutes / 60} hours` : "Until closing"} />
              <Row k="Party" v={`${adults} adult${adults === 1 ? "" : "s"}${children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}`} />
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
            <button className="btn btn-gold btn-lg btn-block"
              disabled={busy || !pkg || (hourly && !opt) || adults + children < 1}
              onClick={pay}>
              {busy ? "Processing…" : <>Pay {money(total, currency)} <ArrowRight weight="bold" /></>}
            </button>
            <p className="muted center" style={{ fontSize: ".8rem" }}>
              Your QR ticket appears instantly — save it, print it, or get it on
              WhatsApp, SMS or email.
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

function priceMain(p) {
  const top = Math.max(Number(p.adult_price_usd), Number(p.child_price_usd));
  return p.pricing === "HOURLY" ? `${money(top)}/hr` : money(top);
}

function priceSub(p) {
  const a = Number(p.adult_price_usd), c = Number(p.child_price_usd);
  const parts = [];
  if (a === 0) parts.push("per child");
  else if (c === 0) parts.push("per adult");
  else if (a !== c) parts.push(`child ${money(c)}`);
  else parts.push("per person");
  if (p.pricing === "FIXED" && p.fixed_minutes) parts.push(`${p.fixed_minutes / 60} hrs`);
  return parts.join(" · ");
}

function eachLabel(price, hourly) {
  const n = Number(price || 0);
  if (n === 0) return "free";
  return hourly ? `${money(n)}/hr each` : `${money(n)} each`;
}
