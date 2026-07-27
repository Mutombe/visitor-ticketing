import { useEffect, useState } from "react";
import {
  Storefront, Clock, UsersThree, MapPin, Watch, FloppyDisk, Plus, Trash,
  GearSix,
} from "@phosphor-icons/react";
import { api, ROLES } from "../api";
import { Spinner } from "../components/ui.jsx";

export default function Settings() {
  return (
    <div className="container section stack fade-in" style={{ maxWidth: 980, "--gap": "20px" }}>
      <div>
        <span className="eyebrow">Administration</span>
        <h1>Settings</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Packages, prices, staff, zones and wristbands — no code changes needed.
        </p>
      </div>
      <VenuePanel />
      <PackagesPanel />
      <TimesPanel />
      <StaffPanel />
      <ZonesPanel />
      <BandsPanel />
    </div>
  );
}

function Panel({ icon, title, hint, children }) {
  return (
    <div className="card card-p stack" style={{ "--gap": "14px" }}>
      <div>
        <h3 className="row">{icon} {title}</h3>
        {hint && <p className="muted" style={{ fontSize: ".85rem", marginTop: 4 }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  return <span className={`chip ${msg.ok ? "green" : "red"}`}>{msg.text}</span>;
}

const field = (label, input) => (
  <label className="field"><label>{label}</label>{input}</label>
);

/* ---- Venue -------------------------------------------------------------- */
function VenuePanel() {
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.admin.config().then(setC).catch(() => {}); }, []);
  if (!c) return <Panel icon={<GearSix weight="fill" />} title="Venue"><Spinner /></Panel>;

  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  async function save() {
    try {
      setC(await api.admin.saveConfig(c));
      setMsg({ ok: true, text: "Saved." });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  return (
    <Panel icon={<GearSix weight="fill" />} title="Venue"
      hint="The venue name appears on every ticket and receipt. Gateways authenticate with the gateway key.">
      <div className="grid-2">
        {field("Venue name", <input className="input" value={c.venue_name} onChange={set("venue_name")} />)}
        {field("City", <input className="input" value={c.venue_city} onChange={set("venue_city")} />)}
      </div>
      <div className="grid-2">
        {field("Closing time (full-day tickets expire)", <input className="input" type="time" value={c.closing_time} onChange={set("closing_time")} />)}
        {field("ZiG per USD", <input className="input" type="number" step="0.01" value={c.zig_per_usd} onChange={set("zig_per_usd")} />)}
      </div>
      {field("BLE gateway key (X-Gateway-Key header)",
        <input className="input" value={c.gateway_key} onChange={set("gateway_key")} style={{ fontFamily: "monospace" }} />)}
      <div className="row"><button className="btn btn-primary btn-sm" onClick={save}><FloppyDisk weight="fill" /> Save venue</button><Msg msg={msg} /></div>
    </Panel>
  );
}

/* ---- Generic list editor ------------------------------------------------- */
function useCrud(kind) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.admin.list(kind).then(setRows).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);   // eslint-disable-line
  async function save(row) {
    try {
      if (row.id) await api.admin.update(kind, row.id, row);
      else await api.admin.create(kind, row);
      setMsg({ ok: true, text: "Saved." });
      load();
      return true;
    } catch (e) { setMsg({ ok: false, text: e.message }); return false; }
  }
  async function remove(id) {
    try { await api.admin.remove(kind, id); setMsg({ ok: true, text: "Deleted." }); load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  return { rows, msg, save, remove, load, setMsg };
}

/* ---- Packages ------------------------------------------------------------ */
const EMPTY_PKG = {
  name: "", group: "Play", emoji: "🎟️", pricing: "HOURLY", fixed_minutes: "",
  adult_price_usd: "0", child_price_usd: "0", vehicle_fee_usd: "0",
  overstay_rate_usd: "2", description: "", active: true, sort: 0,
};

function PackagesPanel() {
  const { rows, msg, save, remove } = useCrud("packages");
  const [draft, setDraft] = useState(null);   // row being edited (copy) or new

  function PkgForm({ row, onDone }) {
    const [p, setP] = useState({ ...row, fixed_minutes: row.fixed_minutes ?? "" });
    const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
    return (
      <div className="stack" style={{ "--gap": "10px", background: "var(--paper)", borderRadius: 12, padding: 14 }}>
        <div className="grid-2">
          {field("Name", <input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} />)}
          {field("Group (section at the gate)", <input className="input" value={p.group} onChange={(e) => set("group", e.target.value)} />)}
        </div>
        <div className="grid-2">
          {field("Emoji", <input className="input" value={p.emoji} onChange={(e) => set("emoji", e.target.value)} />)}
          {field("Pricing", (
            <select className="select" value={p.pricing} onChange={(e) => set("pricing", e.target.value)}>
              <option value="HOURLY">Per hour (pick hours at gate)</option>
              <option value="FIXED">Flat price</option>
            </select>
          ))}
        </div>
        <div className="grid-2">
          {field("Adult price USD" + (p.pricing === "HOURLY" ? " (per hour)" : ""),
            <input className="input" type="number" step="0.01" value={p.adult_price_usd} onChange={(e) => set("adult_price_usd", e.target.value)} />)}
          {field("Child price USD" + (p.pricing === "HOURLY" ? " (per hour)" : ""),
            <input className="input" type="number" step="0.01" value={p.child_price_usd} onChange={(e) => set("child_price_usd", e.target.value)} />)}
        </div>
        <div className="grid-2">
          {field("Fixed minutes (flat only — blank = until closing)",
            <input className="input" type="number" value={p.fixed_minutes} onChange={(e) => set("fixed_minutes", e.target.value)}
              disabled={p.pricing === "HOURLY"} placeholder="e.g. 180" />)}
          {field("Overstay per 30 min USD (flat packages)",
            <input className="input" type="number" step="0.01" value={p.overstay_rate_usd} onChange={(e) => set("overstay_rate_usd", e.target.value)} />)}
        </div>
        {field("Description", <input className="input" value={p.description} onChange={(e) => set("description", e.target.value)} />)}
        <div className="row wrap">
          <label className="row" style={{ gap: 6, fontSize: ".9rem" }}>
            <input type="checkbox" checked={p.active} onChange={(e) => set("active", e.target.checked)} /> Active
          </label>
          <span className="grow" />
          <button className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={async () => {
            const ok = await save({ ...p, fixed_minutes: p.fixed_minutes === "" ? null : Number(p.fixed_minutes) });
            if (ok) onDone();
          }}><FloppyDisk weight="fill" /> Save</button>
        </div>
      </div>
    );
  }

  return (
    <Panel icon={<Storefront weight="fill" />} title="Packages"
      hint="Add, change or retire packages any time — the gate screen updates immediately.">
      {!rows ? <Spinner /> : (
        <div className="stack" style={{ "--gap": "8px" }}>
          {rows.map((p) => draft?.id === p.id
            ? <PkgForm key={p.id} row={draft} onDone={() => setDraft(null)} />
            : (
              <div key={p.id} className="tt-row">
                <span style={{ fontSize: "1.3rem" }}>{p.emoji}</span>
                <span className="tt-info">
                  <strong className="name">{p.name} {!p.active && <span className="chip red" style={{ marginLeft: 6 }}>off</span>}</strong>
                  <span className="desc">{p.group} · {p.pricing === "HOURLY" ? `$${p.adult_price_usd}/hr`
                    : `$${Math.max(Number(p.adult_price_usd), Number(p.child_price_usd))}${p.fixed_minutes ? ` · ${p.fixed_minutes / 60}hrs` : " · until close"}`}</span>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setDraft(p)}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--clay)" }} onClick={() => remove(p.id)}><Trash /></button>
              </div>
            ))}
          {draft && !draft.id && <PkgForm row={draft} onDone={() => setDraft(null)} />}
          <div className="row">
            {(!draft || draft.id) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setDraft({ ...EMPTY_PKG })}>
                <Plus weight="bold" /> Add package
              </button>
            )}
            <Msg msg={msg} />
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---- Time options -------------------------------------------------------- */
function TimesPanel() {
  const { rows, msg, save, remove } = useCrud("time-options");
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");
  return (
    <Panel icon={<Clock weight="fill" />} title="Hour options"
      hint="The durations offered for per-hour packages.">
      {!rows ? <Spinner /> : (
        <>
          <div className="row wrap">
            {rows.map((t) => (
              <span key={t.id} className="chip" style={{ gap: 8 }}>
                {t.label} ({t.minutes} min)
                <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--clay)", fontWeight: 700 }}
                  onClick={() => remove(t.id)}>×</button>
              </span>
            ))}
          </div>
          <div className="row wrap">
            <input className="input" style={{ maxWidth: 140 }} placeholder="Label (2 hours)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className="input" style={{ maxWidth: 120 }} type="number" placeholder="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={!label || !minutes}
              onClick={async () => { if (await save({ label, minutes: Number(minutes), sort: rows.length })) { setLabel(""); setMinutes(""); } }}>
              <Plus weight="bold" /> Add
            </button>
            <Msg msg={msg} />
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---- Staff ---------------------------------------------------------------- */
function StaffPanel() {
  const { rows, msg, save, setMsg, load } = useCrud("staff");
  const [draft, setDraft] = useState({ username: "", name: "", role: "CASHIER", password: "" });
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  return (
    <Panel icon={<UsersThree weight="fill" />} title="Staff accounts"
      hint="Roles: Administrator (everything) · Manager (reports + gate) · Gate cashier (sell + scan) · Security (scan + children).">
      {!rows ? <Spinner /> : (
        <div className="stack" style={{ "--gap": "8px" }}>
          {rows.map((u) => <StaffRow key={u.id} u={u} save={save} />)}
          <div className="hair" />
          <strong style={{ fontSize: ".9rem" }}>Add staff member</strong>
          <div className="grid-2">
            {field("Username", <input className="input" autoCapitalize="none" value={draft.username} onChange={set("username")} />)}
            {field("Display name", <input className="input" value={draft.name} onChange={set("name")} />)}
          </div>
          <div className="grid-2">
            {field("Role", (
              <select className="select" value={draft.role} onChange={set("role")}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ))}
            {field("Password", <input className="input" value={draft.password} onChange={set("password")} placeholder="Set an initial password" />)}
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={!draft.username || !draft.password}
              onClick={async () => {
                if (await save(draft)) { setDraft({ username: "", name: "", role: "CASHIER", password: "" }); load(); }
              }}>
              <Plus weight="bold" /> Create account
            </button>
            <Msg msg={msg} />
          </div>
        </div>
      )}
    </Panel>
  );
}

function StaffRow({ u, save }) {
  const [pw, setPw] = useState("");
  return (
    <div className="tt-row" style={{ flexWrap: "wrap" }}>
      <span className="tt-info" style={{ minWidth: 140 }}>
        <strong className="name">{u.name || u.username}</strong>
        <span className="desc">@{u.username}</span>
      </span>
      <select className="select" style={{ minHeight: 40, maxWidth: 170 }} value={u.role}
        onChange={(e) => save({ id: u.id, role: e.target.value })}>
        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input className="input" style={{ minHeight: 40, maxWidth: 160 }} placeholder="New password"
        value={pw} onChange={(e) => setPw(e.target.value)} />
      {pw && (
        <button className="btn btn-primary btn-sm" onClick={async () => { if (await save({ id: u.id, password: pw })) setPw(""); }}>
          Set
        </button>
      )}
      <label className="row" style={{ gap: 5, fontSize: ".85rem" }}>
        <input type="checkbox" checked={u.is_active}
          onChange={(e) => save({ id: u.id, is_active: e.target.checked })} /> active
      </label>
    </div>
  );
}

/* ---- Zones ---------------------------------------------------------------- */
function ZonesPanel() {
  const { rows, msg, save, remove } = useCrud("zones");
  const [name, setName] = useState("");
  return (
    <Panel icon={<MapPin weight="fill" />} title="Tracking zones"
      hint="Each BLE gateway reports into one of these zones (Museum Hall, Indoor Play…).">
      {!rows ? <Spinner /> : (
        <>
          <div className="row wrap">
            {rows.map((z) => (
              <span key={z.id} className="chip green" style={{ gap: 8 }}>
                <MapPin size={13} weight="fill" /> {z.name}
                <button style={{ border: "none", background: "none", cursor: "pointer", color: "var(--clay)", fontWeight: 700 }}
                  onClick={() => remove(z.id)}>×</button>
              </span>
            ))}
          </div>
          <div className="row">
            <input className="input" style={{ maxWidth: 220 }} placeholder="New zone name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={!name}
              onClick={async () => { if (await save({ name, sort: rows.length })) setName(""); }}>
              <Plus weight="bold" /> Add
            </button>
            <Msg msg={msg} />
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---- Wristbands ------------------------------------------------------------ */
function BandsPanel() {
  const { rows, msg, save, load, setMsg } = useCrud("wristbands");
  const [codes, setCodes] = useState("");
  return (
    <Panel icon={<Watch weight="fill" />} title="Wristband pool"
      hint="Register the codes printed on your BLE wristbands. Paste many at once, comma-separated.">
      {!rows ? <Spinner /> : (
        <>
          <div className="row wrap">
            {rows.map((w) => (
              <button key={w.id} className={`chip ${w.in_use ? "gold" : w.active ? "" : "red"}`}
                title={w.in_use ? "On a child now" : w.active ? "Available — click to retire" : "Retired — click to activate"}
                style={{ cursor: "pointer", border: "1px solid var(--line)" }}
                onClick={() => save({ id: w.id, active: !w.active })}>
                {w.code}{w.in_use ? " · worn" : w.active ? "" : " · retired"}
              </button>
            ))}
          </div>
          <div className="row wrap">
            <input className="input grow" placeholder="MFB-013, MFB-014, MFB-015…"
              value={codes} onChange={(e) => setCodes(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={!codes.trim()}
              onClick={async () => {
                try {
                  await api.admin.create("wristbands", { codes });
                  setCodes(""); setMsg({ ok: true, text: "Registered." }); load();
                } catch (e) { setMsg({ ok: false, text: e.message }); }
              }}>
              <Plus weight="bold" /> Register
            </button>
            <Msg msg={msg} />
          </div>
        </>
      )}
    </Panel>
  );
}
