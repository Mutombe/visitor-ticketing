import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Ticket as TicketIcon } from "@phosphor-icons/react";
import { api, fmtDate, fmtTime, money, remainingSecs, fmtRemaining } from "../api";
import { useAuth } from "../auth.jsx";
import { Empty } from "../components/ui.jsx";
import { TableSkeleton } from "../components/skeletons.jsx";

export default function MyTickets() {
  const { user, openSignIn } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (user) api.myTickets().then(setRows).catch(() => setRows([]));
  }, [user]);

  if (!user) return (
    <div className="container section" style={{ maxWidth: 460 }}>
      <Empty icon={<TicketIcon size={26} weight="fill" />} title="Your tickets, in one place"
        action={<button className="btn btn-primary" onClick={openSignIn}>Sign in</button>}>
        Sign in with Google when you buy and every ticket will be saved here.
      </Empty>
    </div>
  );

  return (
    <div className="container section stack fade-in" style={{ maxWidth: 640, "--gap": "16px" }}>
      <h1>My tickets</h1>
      {!rows ? <TableSkeleton rows={4} /> : rows.length === 0 ? (
        <Empty icon={<TicketIcon size={26} weight="fill" />} title="No tickets yet"
          action={<Link to="/" className="btn btn-primary">Buy a ticket</Link>}>
          Tickets you buy while signed in will appear here.
        </Empty>
      ) : rows.map((t) => {
        const secs = t.status === "ACTIVE" ? remainingSecs(t.expires_at) : 0;
        return (
          <Link key={t.number} to={`/t/${t.qr_token}`} className="tkt-wrap">
            <div className="tkt">
              <div className="stub">
                <div className="qr-wrap">
                  <QRCodeSVG value={`GATEPASS:${t.qr_token}`} size={84} fgColor="#001850" level="M" />
                </div>
                <span className="muted" style={{ fontSize: ".72rem" }}>{t.number}</span>
              </div>
              <div className="body stack" style={{ "--gap": "7px" }}>
                <div className="tkt-chips">
                  <span className="chip">{t.package_emoji} {t.package_name}</span>
                  {t.status === "EXITED" ? <span className="chip">Used</span>
                    : secs > 0 ? <span className="chip green">⏳ {fmtRemaining(secs)} left</span>
                    : <span className="chip red">Expired</span>}
                </div>
                <strong>{t.duration_label} · {t.adults}A{t.children ? ` + ${t.children}C` : ""}</strong>
                <span className="muted" style={{ fontSize: ".85rem" }}>
                  {fmtDate(t.issued_at)} · {fmtTime(t.issued_at)} · {money(t.total, t.currency)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
