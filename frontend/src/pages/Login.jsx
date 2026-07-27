import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SignIn } from "@phosphor-icons/react";
import { useAuth } from "../auth.jsx";
import { canSell } from "../api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const user = await login(username.trim(), password);
      nav(state?.from || (canSell(user.role) ? "/" : "/scan"), { replace: true });
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="container section fade-in" style={{ maxWidth: 420 }}>
      <div className="card card-p stack" style={{ "--gap": "16px", marginTop: 40 }}>
        <div className="center stack" style={{ "--gap": "6px", alignItems: "center" }}>
          <img src="/t-favicon.png" alt="" style={{ height: 52 }} />
          <h2>Staff sign in</h2>
          <p className="muted" style={{ fontSize: ".9rem" }}>
            Gate, security and management access.
          </p>
        </div>
        <form className="stack" style={{ "--gap": "12px" }} onSubmit={go}>
          <label className="field">
            <label>Username</label>
            <input className="input" autoFocus autoCapitalize="none" value={username}
              onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <label>Password</label>
            <input className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {err && <span className="chip red">{err}</span>}
          <button className="btn btn-gold btn-lg btn-block" disabled={busy || !username || !password}>
            <SignIn weight="bold" /> {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
