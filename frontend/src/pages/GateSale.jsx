import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Baby, Car, Phone, Ticket as TicketIcon, ArrowRight, Clock,
} from "@phosphor-icons/react";
import { api, money } from "../api";
import { PayPicker, Qty } from "../components/ui.jsx";
import { PackageBadge, PackageMark, packageArt } from "../packageArt.jsx";
import { ChipsSkeleton, PackageRowsSkeleton } from "../components/skeletons.jsx";
import { useCached } from "../useCached.js";
import { setCached } from "../cache.js";

export default function GateSale() {
  const nav = useNavigate();
  const { data: cfg, error: cfgErr } = useCached("config", api.config);
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
  const [bands, setBands] = useState([]);   // [{code, child_name}] child wristbands
  const [busy, setBusy] = useState(false);

  // default selections once config lands (instant from cache on revisit)
  useEffect(() => {
    if (!cfg) return;
    setPkg((p) => p || cfg.packages[0] || null);
    setOpt((o) => o || cfg.time_options[0] || null);
  }, [cfg]);

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
    return perPerson + (reg.trim() ? Number(pkg.vehicle_fee_usd) : 0);
  }, [pkg, opt, hourly, adults, children, reg]);

  const total = currency === "ZIG" && cfg ? totalUsd * Number(cfg.zig_per_usd) : totalUsd;

  async function issue() {
    if (!pkg || !opt || busy) return;
    setBusy(true);
    setErr("");
    try {
      const t = await api.issueTicket({
        package: pkg.id, time_option: hourly ? opt.id : null,
        adults, children,
        visitor_name: name.trim(), phone: phone.trim(),
        vehicle_reg: reg.trim(), vehicle_type: vtype.trim(),
        currency, payment_method: method,
        bands: bands.filter((b) => b.code.trim()),
      });
      setCached(`ticket:${t.qr_token}`, t);   // ticket page paints instantly
      nav(`/t/${t.qr_token}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  // Static shell renders instantly; only data-driven areas skeleton below.
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
            {cfgErr && !cfg && <span className="chip red">{cfgErr.message}</span>}
            {!cfg && !cfgErr && <PackageRowsSkeleton count={5} />}
            {cfg && Object.entries(groups).map(([group, list]) => (
              <div key={group} className="stack" style={{ "--gap": "10px" }}>
                <span className="eyebrow">{group} packages</span>
                <div className="dist-grid cascade">
                  {list.map((p) => (
                    <button key={p.id} type="button"
                      className={`dist ${pkg?.id === p.id ? "selected" : ""}`}
                      style={{ "--pkg-tint": packageArt(p).tint }}
                      onClick={() => setPkg(p)}>
                      <PackageMark pkg={p} />
                      <PackageBadge pkg={p} />
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
            <h3>2 · Time &amp; party</h3>
            {!pkg ? <ChipsSkeleton /> : hourly ? (
              <div className="row wrap cascade" style={{ gap: 8 }}>
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
                  : `Valid until closing (${cfg.closing_time})`}
              </span>
            )}
            <div className="grid-2">
              <div className="tt-row">
                <span className="tt-info row" style={{ gap: 10 }}>
                  <User size={20} weight="fill" color="var(--green-600)" />
                  <span><strong className="name">Adults</strong>
                    <span className="desc" style={{ display: "block" }}>{pkg ? eachLabel(pkg.adult_price_usd, hourly) : "—"}</span></span>
                </span>
                <Qty value={adults} onChange={setAdults} />
              </div>
              <div className="tt-row">
                <span className="tt-info row" style={{ gap: 10 }}>
                  <Baby size={20} weight="fill" color="var(--green-600)" />
                  <span><strong className="name">Children</strong>
                    <span className="desc" style={{ display: "block" }}>{pkg ? eachLabel(pkg.child_price_usd, hourly) : "—"}</span></span>
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

            {children > 0 && (
              <>
                <div className="hair" />
                <div className="spread">
                  <strong className="row" style={{ gap: 8 }}>
                    <Baby size={18} weight="fill" color="var(--green-600)" />
                    Child safety wristbands
                    <span className="muted" style={{ fontWeight: 400, fontSize: ".82rem" }}>(optional)</span>
                  </strong>
                  {bands.length < children && (
                    <button type="button" className="link-btn" style={{ padding: 0 }}
                      onClick={() => setBands((b) => [...b, { code: "", child_name: "" }])}>
                      + Add wristband
                    </button>
                  )}
                </div>
                {bands.map((b, i) => (
                  <div key={i} className="row" style={{ gap: 8 }}>
                    <input className="input" style={{ maxWidth: 150 }} placeholder="Band code"
                      value={b.code}
                      onChange={(e) => setBands((all) =>
                        all.map((x, j) => j === i ? { ...x, code: e.target.value.toUpperCase() } : x))} />
                    <input className="input grow" placeholder="Child's name"
                      value={b.child_name}
                      onChange={(e) => setBands((all) =>
                        all.map((x, j) => j === i ? { ...x, child_name: e.target.value } : x))} />
                    <button type="button" className="qty" style={{ border: "1px solid var(--line-2)" }}
                      onClick={() => setBands((all) => all.filter((_, j) => j !== i))}>
                      <span style={{ padding: "0 12px", color: "var(--clay)", fontWeight: 700 }}>×</span>
                    </button>
                  </div>
                ))}
                {bands.length > 0 && (
                  <p className="muted" style={{ fontSize: ".8rem" }}>
                    Bluetooth gateways will track each band's zone — find any child on the Children screen.
                  </p>
                )}
              </>
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
              <Row k="Time" v={!pkg ? "—" : hourly ? (opt?.label || "—")
                : pkg.fixed_minutes ? `${pkg.fixed_minutes / 60} hours` : "Until closing"} />
              <Row k="Party" v={`${adults} adult${adults === 1 ? "" : "s"}${children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}`} />
              {reg.trim() && <Row k="Vehicle" v={`${reg.toUpperCase()}${vtype ? ` · ${vtype}` : ""}`} />}
            </div>
            <div className="hair" />
            <div className="spread">
              <span className="muted">Total</span>
              <span className="tt-price" style={{ fontSize: "1.7rem" }}>{money(total, currency)}</span>
            </div>
            {currency === "ZIG" && cfg && (
              <span className="muted" style={{ fontSize: ".8rem" }}>
                ≈ {money(totalUsd)} at {Number(cfg.zig_per_usd)} ZiG/USD
              </span>
            )}
            {err && <span className="chip red">{err}</span>}
            <button className="btn btn-gold btn-lg btn-block"
              disabled={busy || !pkg || (hourly && !opt) || adults + children < 1}
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

/* "$10/hr" · "$15" · "$18" — headline price on a package card */
function priceMain(p) {
  const top = Math.max(Number(p.adult_price_usd), Number(p.child_price_usd));
  return p.pricing === "HOURLY" ? `${money(top)}/hr` : money(top);
}

/* "per person" · "per child · 6 hrs" · "3 hrs" — the fine print */
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
