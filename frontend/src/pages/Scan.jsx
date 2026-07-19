import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  QrCode, CheckCircle, XCircle, Timer, CurrencyDollar, Camera,
  ArrowSquareOut, SignOut,
} from "@phosphor-icons/react";
import { api, fmtRemaining, fmtTime, money, remainingSecs, PAYMENTS } from "../api";
import { PayPicker } from "../components/ui.jsx";

export default function Scan() {
  const [code, setCode] = useState("");
  const [t, setT] = useState(null);        // looked-up ticket
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [feeMethod, setFeeMethod] = useState("CASH");
  const [done, setDone] = useState("");    // exit confirmation message
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [checking, setChecking] = useState(false);

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
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const secs = t?.status === "ACTIVE" ? remainingSecs(t.expires_at) : 0;
  const expired = t?.status === "ACTIVE" && secs <= 0;
  const valid = t?.status === "ACTIVE" && secs > 0;
  const exited = t?.status === "EXITED";
  const feeDue = t && Number(t.overstay_due) > 0 && t.status === "ACTIVE";

  return (
    <div className="container section stack fade-in" style={{ maxWidth: 640, "--gap": "18px" }}>
      <div>
        <span className="eyebrow">Exit gate</span>
        <h1>Scan ticket</h1>
      </div>

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
        <div className={`scan-result stack ${exited ? "neutral" : valid && !feeDue ? "ok" : expired || feeDue ? (feeDue ? "warn" : "bad") : "neutral"}`}
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
              onScan(text);
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
  }, [on, supported, onScan]);

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
