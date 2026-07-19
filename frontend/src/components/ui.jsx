export function Spinner() {
  return <div className="spinner" />;
}

export function Empty({ icon, title, children, action }) {
  return (
    <div className="empty">
      {icon && <span className="empty-icon">{icon}</span>}
      {title && <h3>{title}</h3>}
      {children && <p className="muted">{children}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function Stat({ v, k }) {
  return (
    <div className="stat">
      <div className="v">{v}</div>
      <div className="k">{k}</div>
    </div>
  );
}

/* Labelled progress bar used in report mixes */
export function MixBar({ left, right, pct, color }) {
  return (
    <div className="stack" style={{ "--gap": "6px" }}>
      <div className="spread">
        <span className="row" style={{ gap: 8 }}>{left}</span>
        <span className="muted" style={{ fontSize: ".85rem" }}>{right}</span>
      </div>
      <div className="bar"><span style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} /></div>
    </div>
  );
}

/* +/- stepper for party counts (reuses .qty from the design system) */
export function Qty({ value, onChange, min = 0, max = 200 }) {
  return (
    <span className="qty">
      <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span className="n">{value}</span>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

/* Payment method grid (reuses .pay from the design system) */
import { PAYMENTS } from "../api";
export function PayPicker({ value, onChange }) {
  return (
    <div className="pay">
      {Object.entries(PAYMENTS).map(([key, p]) => (
        <button key={key} type="button" className={value === key ? "selected" : ""}
          onClick={() => onChange(key)} title={p.label}>
          {p.logo
            ? <img src={p.logo} alt={p.label} />
            : <span className="row" style={{ gap: 8 }}>
                <span className="logo" style={{ background: p.color }}>{p.short}</span>
                <strong style={{ fontSize: ".95rem" }}>{p.label}</strong>
              </span>}
        </button>
      ))}
    </div>
  );
}
