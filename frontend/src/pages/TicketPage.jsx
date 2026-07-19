import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle, Timer, WhatsappLogo, FilePdf, ImageSquare, Printer,
  ChatText, MagnifyingGlass, Plus,
} from "@phosphor-icons/react";
import { api, fmtDate, fmtTime, fmtRemaining, money, remainingSecs, ticketUrl, waShare, waTo, smsTo } from "../api";
import { Empty } from "../components/ui.jsx";
import { TicketSkeleton } from "../components/skeletons.jsx";
import { useCached } from "../useCached.js";

export default function TicketPage() {
  const { qr } = useParams();
  const { data: t, error } = useCached(`ticket:${qr}`, () => api.ticket(qr));
  const [busy, setBusy] = useState("");
  const [, tick] = useState(0);
  const ref = useRef(null);

  // live countdown
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  // Measure the tear line and cut the mask notches exactly there.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !t) return;
    const place = () => {
      const perf = el.querySelector(".perf");
      if (!perf) return;
      const y = perf.getBoundingClientRect().top - el.getBoundingClientRect().top;
      el.style.setProperty("--perf-y", `${Math.round(y)}px`);
    };
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", place); };
  }, [t]);

  async function download(kind) {
    const el = ref.current;
    if (!el) return;
    setBusy(kind);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const bibRect = el.getBoundingClientRect();
      const perfY = el.querySelector(".perf").getBoundingClientRect().top - bibRect.top;
      // html2canvas can't render CSS masks → capture unmasked, then punch notches on the canvas
      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor: "#F5F8FD", useCORS: true, logging: false,
        onclone: (_doc, clone) => { clone.style.mask = "none"; clone.style.webkitMask = "none"; },
      });
      const ctx = canvas.getContext("2d");
      const sx = canvas.width / bibRect.width, sy = canvas.height / bibRect.height;
      ctx.fillStyle = "#F5F8FD";
      for (const cx of [0, canvas.width]) {
        ctx.beginPath(); ctx.arc(cx, perfY * sy, 11 * sx, 0, Math.PI * 2); ctx.fill();
      }
      const name = `gatepass-${t.number}`;
      if (kind === "png") {
        const a = document.createElement("a");
        a.download = `${name}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const img = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "px",
          format: [canvas.width, canvas.height] });
        pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`${name}.pdf`);
      }
    } catch (e) { console.error(e); }
    setBusy("");
  }

  if (error && !t) return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <Empty icon={<MagnifyingGlass size={26} weight="bold" />} title="Ticket not found"
        action={<Link to="/history" className="btn btn-primary">Search history</Link>}>
        This ticket link may be wrong. Look it up by number, name or plate in history.
      </Empty>
    </div>
  );
  if (!t) return <TicketSkeleton />;

  const secs = t.status === "ACTIVE" ? remainingSecs(t.expires_at) : 0;
  const expired = t.status === "ACTIVE" && secs <= 0;
  const exited = t.status === "EXITED";
  const share = `${t.venue_name} — ticket ${t.number} (${t.package_name}, ${t.duration_label}, `
    + `${t.adults} adult${t.adults === 1 ? "" : "s"}${t.children ? ` + ${t.children} kids` : ""}). `
    + `Expires ${fmtTime(t.expires_at)}. ${ticketUrl(t.qr_token)}`;

  return (
    <div className="container section fade-in" style={{ maxWidth: 520 }}>
      {/* The ticket (this exact element is what downloads) */}
      <div className="bib-wrap">
      <div className="bib" ref={ref}>
        <div className="bib-top">
          <img src="/t-favicon.png" alt="" className="bib-mark" aria-hidden="true" />
          <div className="spread" style={{ marginBottom: 16 }}>
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#fff", letterSpacing: "-.02em" }}>
              Gate<span style={{ color: "var(--brass-bright)" }}>pass</span>
            </span>
            <StateChip t={t} secs={secs} expired={expired} exited={exited} />
          </div>
          <span className="eyebrow" style={{ color: "var(--brass-bright)" }}>
            {t.package_emoji} {t.package_name} · {t.duration_label}
          </span>
          <div className="bib-number">{t.number}</div>
          <strong style={{ color: "#fff" }}>
            {t.adults} adult{t.adults === 1 ? "" : "s"}
            {t.children > 0 && ` · ${t.children} child${t.children === 1 ? "" : "ren"}`}
            {t.visitor_name && ` · ${t.visitor_name}`}
          </strong>
        </div>

        <div className="perf" />

        <div className="bib-body">
          <div className="bib-grid">
            <div className="stack" style={{ "--gap": "13px", flex: 1, minWidth: 0 }}>
              <Field label="Venue" value={`${t.venue_name}, ${t.venue_city}`} />
              <Field label="Entered" value={`${fmtDate(t.issued_at)} · ${fmtTime(t.issued_at)}`} />
              <Field label="Expires" value={`${fmtTime(t.expires_at)} (${t.duration_label})`} />
              {t.vehicle_reg && <Field label="Vehicle" value={`${t.vehicle_reg}${t.vehicle_type ? ` · ${t.vehicle_type}` : ""}`} />}
              <Field label="Paid" value={`${money(t.total, t.currency)} · ${t.payment_method}`} />
            </div>
            <div className="bib-qr">
              <div className="qr-wrap">
                <QRCodeSVG value={`GATEPASS:${t.qr_token}`} size={124} fgColor="#001850" level="M" />
              </div>
              <span className="muted" style={{ fontSize: ".72rem" }}>Scan at the exit gate</span>
            </div>
          </div>
        </div>

        <div className="bib-foot">{t.venue_name} · keep this ticket until you exit</div>
      </div>
      </div>

      {/* Actions (not part of the download) */}
      <div className="stack" style={{ marginTop: 16, "--gap": "10px" }}>
        <button className="btn btn-gold btn-lg btn-block" onClick={() => window.print()}>
          <Printer weight="fill" /> Print receipt
        </button>
        <div className="grid-2" style={{ gap: 10 }}>
          <button className="btn btn-primary" disabled={!!busy} onClick={() => download("pdf")}>
            <FilePdf weight="fill" /> {busy === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
          <button className="btn btn-ghost" disabled={!!busy} onClick={() => download("png")}>
            <ImageSquare weight="fill" /> {busy === "png" ? "Preparing…" : "Download image"}
          </button>
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <a className="btn btn-ghost" target="_blank" rel="noreferrer"
            href={t.phone ? waTo(t.phone, share) : waShare(share)}>
            <WhatsappLogo weight="fill" color="#25D366" /> WhatsApp
          </a>
          <a className="btn btn-ghost" href={smsTo(t.phone, share)}>
            <ChatText weight="fill" /> SMS
          </a>
        </div>
        <Link to="/" className="btn btn-ghost btn-block"><Plus weight="bold" /> New entry</Link>
      </div>

      {/* 80mm thermal receipt — visible only when printing */}
      <ThermalReceipt t={t} />
    </div>
  );
}

function StateChip({ t, secs, expired, exited }) {
  if (exited) return <span className="chip green"><CheckCircle weight="fill" size={13} /> Exited</span>;
  if (t.status === "CANCELLED") return <span className="chip red">Cancelled</span>;
  if (expired) return <span className="chip red">Expired</span>;
  return (
    <span className="chip gold countdown">
      <Timer weight="fill" size={13} /> {fmtRemaining(secs)} left
    </span>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <strong style={{ fontSize: ".92rem" }}>{value}</strong>
    </div>
  );
}

function ThermalReceipt({ t }) {
  return (
    <div className="receipt">
      <div className="r-center">
        <div className="r-title">{t.venue_name.toUpperCase()}</div>
        <div>{t.venue_city}</div>
        <div>VISITOR ENTRY RECEIPT</div>
      </div>
      <div className="r-rule" />
      <div className="r-row"><span>Ticket</span><span className="r-big">{t.number}</span></div>
      <div className="r-row"><span>Date</span><span>{fmtDate(t.issued_at, { day: "2-digit", month: "2-digit", year: "numeric" })} {fmtTime(t.issued_at)}</span></div>
      <div className="r-row"><span>Package</span><span>{t.package_name}</span></div>
      <div className="r-row"><span>Time</span><span>{t.duration_label}</span></div>
      <div className="r-rule" />
      <div className="r-row"><span>Adults</span><span>x{t.adults}</span></div>
      {t.children > 0 && <div className="r-row"><span>Children</span><span>x{t.children}</span></div>}
      {t.vehicle_reg && <div className="r-row"><span>Vehicle</span><span>{t.vehicle_reg}</span></div>}
      {t.visitor_name && <div className="r-row"><span>Visitor</span><span>{t.visitor_name}</span></div>}
      <div className="r-rule" />
      <div className="r-row r-big"><span>TOTAL</span><span>{money(t.total, t.currency)}</span></div>
      <div className="r-row"><span>Paid by</span><span>{t.payment_method}</span></div>
      <div className="r-rule" />
      <div className="r-center r-big">EXPIRES {fmtTime(t.expires_at)}</div>
      <div className="r-qr">
        <QRCodeSVG value={`GATEPASS:${t.qr_token}`} size={140} fgColor="#000" level="M" />
      </div>
      <div className="r-center">Scan at the exit gate.</div>
      <div className="r-center">Overstay is billed per started 30 min.</div>
      <div className="r-rule" />
      <div className="r-center">Thank you for visiting!</div>
    </div>
  );
}
