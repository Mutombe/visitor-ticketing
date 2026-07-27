import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { SignIn, X } from "@phosphor-icons/react";
import { api, setToken } from "./api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gp_user") || "null"); }
    catch { return null; }
  });
  const [modal, setModal] = useState(false);

  const remember = (res) => {
    setToken(res.token);
    localStorage.setItem("gp_user", JSON.stringify(res.user));
    setUser(res.user);
    setModal(false);
    return res.user;
  };

  async function login(username, password) {
    return remember(await api.login(username, password));
  }

  // payload is { credential } (id token) or { access_token } (popup flow)
  const handleGoogle = useCallback(async (payload) => {
    remember(await api.googleLogin(payload));
  }, []);

  function logout() {
    api.logout().catch(() => {});
    setToken(null);
    localStorage.removeItem("gp_user");
    sessionStorage.clear();   // drop cached data from the previous session
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{
      user, login, logout, handleGoogle,
      clientId: GOOGLE_CLIENT_ID,
      openSignIn: () => setModal(true),
    }}>
      {children}
      {modal && <SignInModal onClose={() => setModal(false)} />}
    </AuthCtx.Provider>
  );
}

/* Inline prompt shown where a staff-only page would render. */
export function RequireAuth({ children, roles }) {
  const { user, openSignIn } = useAuth();
  if (!user || (roles && !roles.includes(user.role))) {
    return (
      <div className="container section" style={{ maxWidth: 460 }}>
        <div className="empty" style={{ marginTop: 30 }}>
          <span className="empty-icon"><SignIn size={26} weight="bold" /></span>
          <h3>{user ? "Staff access only" : "Staff sign in required"}</h3>
          <p className="muted">
            {user
              ? "Your account does not have access to this screen."
              : "This screen is for gate, security and management staff."}
          </p>
          {!user && (
            <button className="btn btn-primary" onClick={openSignIn}>
              <SignIn weight="bold" /> Sign in
            </button>
          )}
        </div>
      </div>
    );
  }
  return children;
}

/* ---- Sign-in modal ---------------------------------------------------------- */
function SignInModal({ onClose }) {
  const { login, clientId } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(username.trim(), password); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <div className="modal-overlay fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card stack" style={{ "--gap": "14px" }}>
        <div className="spread">
          <div className="row">
            <img src="/t-favicon.png" alt="" style={{ height: 34 }} />
            <h3>Sign in</h3>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
        </div>

        {clientId && (
          <>
            <GoogleButton block />
            <div className="row" style={{ gap: 10 }}>
              <span className="hair grow" />
              <span className="muted" style={{ fontSize: ".78rem" }}>or staff sign in</span>
              <span className="hair grow" />
            </div>
          </>
        )}

        <form className="stack" style={{ "--gap": "10px" }} onSubmit={go}>
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
          <button className="btn btn-primary btn-block" disabled={busy || !username || !password}>
            <SignIn weight="bold" /> {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted center" style={{ fontSize: ".78rem" }}>
          Visitors don't need an account to buy tickets — Google sign-in just keeps
          your tickets in one place.
        </p>
      </div>
    </div>
  );
}

/* ---- Google ------------------------------------------------------------------ */
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/* Our own Google button (SVG logo) — opens the OAuth popup ourselves so it
   always renders, even if GIS would refuse to draw its button. */
export function GoogleButton({ block = false }) {
  const { handleGoogle, clientId } = useAuth();
  const [err, setErr] = useState("");
  const clientRef = useRef(null);

  useEffect(() => {
    if (!clientId) return;
    let tries = 0;
    const init = () => {
      if (!window.google?.accounts?.oauth2) {
        if (tries++ < 60) return setTimeout(init, 100);
        return;
      }
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: (resp) => {
          if (resp?.access_token) {
            handleGoogle({ access_token: resp.access_token }).catch((e) => setErr(e.message));
          }
        },
      });
    };
    init();
  }, [clientId, handleGoogle]);

  if (!clientId) return null;
  return (
    <div className="stack" style={{ "--gap": "8px" }}>
      <button type="button" className="gbtn" style={block ? { width: "100%" } : undefined}
        onClick={() => clientRef.current
          ? clientRef.current.requestAccessToken()
          : setErr("Google sign-in is still loading — try again in a second.")}>
        <GoogleG /> Continue with Google
      </button>
      {err && <span className="chip red">{err}</span>}
    </div>
  );
}
