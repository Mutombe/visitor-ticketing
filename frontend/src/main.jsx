import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { AuthProvider, RequireAuth } from "./auth.jsx";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import GateSale from "./pages/GateSale.jsx";
import TicketPage from "./pages/TicketPage.jsx";
import Scan from "./pages/Scan.jsx";
import Children from "./pages/Children.jsx";
import History from "./pages/History.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

const SELL = ["ADMIN", "MANAGER", "CASHIER"];
const REPORT = ["ADMIN", "MANAGER"];

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<App />}>
            <Route path="/login" element={<Login />} />
            <Route path="/t/:qr" element={<TicketPage />} />  {/* public visitor link */}
            <Route path="/" element={<RequireAuth roles={SELL}><GateSale /></RequireAuth>} />
            <Route path="/scan" element={<RequireAuth><Scan /></RequireAuth>} />
            <Route path="/children" element={<RequireAuth><Children /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth roles={REPORT}><Reports /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth roles={["ADMIN"]}><Settings /></RequireAuth>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
