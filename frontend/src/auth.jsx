import { createContext, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, setToken } from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gp_user") || "null"); }
    catch { return null; }
  });

  async function login(username, password) {
    const res = await api.login(username, password);
    setToken(res.token);
    localStorage.setItem("gp_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }

  function logout() {
    api.logout().catch(() => {});
    setToken(null);
    localStorage.removeItem("gp_user");
    sessionStorage.clear();   // drop cached data from the previous session
    setUser(null);
  }

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

/* Route guard — sends signed-out staff to /login (public ticket links skip this). */
export function RequireAuth({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/scan" replace />;
  return children;
}
