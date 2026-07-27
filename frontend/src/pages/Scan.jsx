import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  QrCode, CheckCircle, XCircle, Timer, CurrencyDollar, Camera,
  ArrowSquareOut, SignOut, HourglassHigh, UsersThree, Baby,
} from "@phosphor-icons/react";
import { api, fmtRemaining, fmtTime, money, remainingSecs, PAYMENTS } from "../api";
import { PayPicker, Stat } from "../components/ui.jsx";
import { getCached, setCached } from "../cache.js";

export default function Scan() {
  const [code, setCode] = useState("");
  const [t, setT] = useState(null);        // looked-up ticket
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feeMethod, setFeeMethod] = useState("CASH");
  const [done, setDone] = useState("");    // exit confirmation message
  const [stats, setStats] = useState(() => getCached("security"));
  const [, tick] = useState(0);

  const refreshStats = useCallback(() => {
    api.security().then((s) => { setCached("security", s); setStats(s); }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
    const sid = setInterval(refreshStats, 15000);
    const cid = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(sid); clearInterval(cid); };
  }, [refreshStats]);

  async function lookup(raw) {
    const ref = String(raw || code).trim().replace(/^GATEPASS:/, "");
    if (!ref) return;
    setErr(""); setDone(""); setT(null); setChecking(true);
    try {
      const found = await api.ticket(ref);
      setT(found);
      setFeeMethod(found.payment_method || "CASH");
    } catch (e) { setErr(e.message); }
    setChecking(false);
  }

  async function recordExit() {
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await api.exit(t.qr_token, { payment_method: feeMethod });
      setT(res.ticket);
      setDone(res.detail || "Exit recorded — gate open.");
      refreshStats();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const secs = t?.status === "ACTIVE" ? remainingSecs(t.expires_at) : 0;
  const expired = t?.status === "ACTIVE" && secs <= 0;
  const valid = t?.status === "ACTIVE" && secs > 0;
  const exited = t?.status === "EXITED";
  const feeDue = t && Number(t.overstay_due) > 0 && t.status === "ACTIVE";
  const unreturnedBands = (t?.bands || []).filter((b) => !b.returned);

  return (
    <div className="container section stack fade-in" style={{ maxWidth: 760, "--gap": "18px" }}>
      <div>
        <span className="eyebrow">Security dashboard</span>
        <h1>Exit gate</h1>
      </div>

      {stats && (
        <div className="stats">
          <Stat v={stats.inside_visitors} k={<><UsersThree size={13} weight="fill" /> Visitors inside</>} />
          <Stat v={stats.overdue_tickets} k={<><HourglassHigh size={13} weight="fill" /> Overdue inside</>} />
          <Stat v={stats.children_banded} k={<><Baby size={13} weight="fill" /> Kids on wristbands</>} />
          <Stat v={stats.exits_today} k={<><SignOut size={13} weight="bold" /> Exits today · {money(stats.overtime_today)} overtime</>} />
        </div>
      )}

      <div className="card card-p stack">
        <form className="row" onSubmit={(e) => { e.preventDefault(); lookup(); }}>
          <input className="input grow" autoFocus value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan QR or type ticket number (GP-…)" />
          <button className="btn btn-primary" type="submit"><QrCode weight="fill" /> Check</button>
        </form>
        <CameraScanner onScan={(text) => { setCode(text); lookup(text); }} />
      </div>

      {err && <div className="chip red">{err}</div>}

      {checking && <div className="skel" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />}

      {t && (
        <div className={`scan-result stack ${exited ? "neutral" : valid && !feeDue ? "ok" : feeDue ? "warn" : expired ? "bad" : "neutral"}`}
          style={{ "--gap": "14px" }}>
          <div className="spread">
            <span className="row" style={{ gap: 8, fontWeight: 700 }}>
              {exited ? <><CheckCircle weight="fill" /> Already exited</>
                : valid ? <><CheckCircle weight="fill" /> Valid ticket</>
                : expired ? <><XCircle weight="fill" /> Expired</>
                : <><XCircle weight="fill" /> {t.status}</>}
            </span>
            <span style={{ opacity: .85, fontWeight: 600 }}>{t.number}</span>
          </div>

          <div>
            <div style={{ opacity: .8, fontSize: ".9rem" }}>
              {t.package_emoji} {t.package_name} · {t.duration_label} · {t.adults} adult{t.adults === 1 ? "" : "s"}
              {t.children > 0 && ` + ${t.children} child${t.children === 1 ? "" : "ren"}`}
              {t.vehicle_reg && ` · ${t.vehicle_reg}`}
            </div>
            {valid && (
              <div className="scan-big countdown" style={{ marginTop: 6 }}>
                <Timer weight="fill" style={{ verticalAlign: "-4px" }} /> {fmtRemaining(secs)} left
              </div>
            )}
            {expired && (
              <div className="scan-big" style={{ marginTop: 6 }}>
                {t.overstay_minutes} min over
              </div>
            )}
            {exited && (
              <div style={{ marginTop: 6, opacity: .9 }}>
                Left at {fmtTime(t.exited_at)}
                {Number(t.overstay_fee) > 0 && ` · overstay fee ${money(t.overstay_fee, t.currency)} (${t.overstay_method})`}
              </div>
            )}
            <div style={{ opacity: .75, fontSize: ".85rem", marginTop: 4 }}>
              Entered {fmtTime(t.issued_at)} · expires {fmtTime(t.expires_at)}
            </div>
          </div>

          {unreturnedBands.length > 0 && t.status === "ACTIVE" && (
            <div className="chip" style={{ background: "rgba(255,255,255,.16)", color: "#fff", border: "none", alignSelf: "flex-start" }}>
              <Baby size={14} weight="fill" /> Collect wristband{unreturnedBands.length > 1 ? "s" : ""}:{" "}
              {unreturnedBands.map((b) => `${b.code} (${b.child_name})`).join(", ")}
            </div>
          )}

          {feeDue && (
            <div className="card card-p stack" style={{ color: "var(--ink)" }}>
              <div className="spread">
                <strong className="row"><CurrencyDollar weight="bold" /> Extra to pay</strong>
                <span className="tt-price" style={{ fontSize: "1.5rem" }}>{money(t.overstay_due, t.currency)}</span>
              </div>
              <p className="muted" style={{ fontSize: ".85rem" }}>
                {t.overstay_minutes} min past expiry — billed per started 30 min.
              </p>
              <PayPicker value={feeMethod} onChange={setFeeMethod} />
            </div>
          )}

          {done && <div className="chip green" style={{ alignSelf: "flex-start" }}>{done}</div>}

          {t.status === "ACTIVE" && (
            <button className="btn btn-lg btn-block" disabled={busy} onClick={recordExit}
              style={{ background: "#fff", color: "var(--ink)" }}>
              <SignOut weight="bold" />
              {busy ? "Recording…"
                : feeDue ? `Collect ${money(t.overstay_due, t.currency)} ${PAYMENTS[feeMethod]?.label || ""} & record exit`
                : "Record exit"}
            </button>
          )}
          <Link to={`/t/${t.qr_token}`} className="row" style={{ color: "#fff", opacity: .85, fontSize: ".88rem", gap: 6 }}>
            Open full ticket <ArrowSquareOut weight="bold" />
          </Link>
        </div>
      )}

      {stats?.overdue?.length > 0 && (
        <div className="card card-p stack">
          <h3 className="row"><HourglassHigh weight="fill" color="var(--clay)" /> Expired but still inside</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Ticket</th><th>Package</th><th>Party</th><th>Over by</th><th>Owes</th></tr></thead>
              <tbody>
                {stats.overdue.map((o) => (
                  <tr key={o.number} style={{ cursor: "pointer" }} onClick={() => lookup(o.qr_token)}>
                    <td style={{ color: "var(--green-700)", fontWeight: 700 }}>{o.number}</td>
                    <td>{o.package_emoji} {o.package_name}</td>
                    <td>{o.adults}A{o.children ? ` + ${o.children}C` : ""}</td>
                    <td>{fmtRemaining(o.overstay_minutes * 60)}</td>
                    <td><strong>{money(o.overstay_due, o.currency)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: ".8rem" }}>Tap a row to load it into the scanner.</p>
        </div>
      )}

      {stats?.recent_exits?.length > 0 && (
        <div className="card card-p stack">
          <h3>Recent exits</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Ticket</th><th>Package</th><th>Out</th><th>Overtime</th></tr></thead>
              <tbody>
                {stats.recent_exits.map((o) => (
                  <tr key={o.number}>
                    <td className="muted">{o.number}</td>
                    <td>{o.package_emoji} {o.package_name}</td>
                    <td>{fmtTime(o.exited_at)}</td>
                    <td>{Number(o.overstay_fee) > 0 ? money(o.overstay_fee, o.currency) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* Camera QR scanning via the native BarcodeDetector (Chrome/Edge/Android).
   Falls back silently to manual entry where unsupported. */
function CameraScanner({ onScan }) {
  const [on, setOn] = useState(false);
  const [supported] = useState(() => "BarcodeDetector" in window);
  const videoRef = useRef(null);
  const lastRef = useRef({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;   // keep the camera loop stable across re-renders

  useEffect(() => {
    if (!on || !supported) return;
    let stream, raf, stop = false;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const loop = async () => {
          if (stop) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const text = codes[0]?.rawValue;
            const now = Date.now();
            if (text && (text !== lastRef.current.text || now - lastRef.current.at > 4000)) {
              lastRef.current = { text, at: now };
              onScanRef.current(text);
            }
          } catch { /* frame not ready */ }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch { setOn(false); }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, supported]);

  if (!supported) return null;
  return (
    <div className="stack" style={{ "--gap": "10px" }}>
      {on && <video ref={videoRef} className="scan-video" muted playsInline />}
      <button type="button" className="btn btn-ghost" onClick={() => setOn((o) => !o)}>
        <Camera weight="fill" /> {on ? "Stop camera" : "Scan with camera"}
      </button>
    </div>
  );
}
