import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider, RequireAuth } from "./auth.jsx";
import App from "./App.jsx";
import Buy from "./pages/Buy.jsx";
import MyTickets from "./pages/MyTickets.jsx";
import GateSale from "./pages/GateSale.jsx";
import TicketPage from "./pages/TicketPage.jsx";
import Scan from "./pages/Scan.jsx";
import Children from "./pages/Children.jsx";
import History from "./pages/History.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

const STAFF = ["ADMIN", "MANAGER", "CASHIER", "SECURITY"];
const SELL = ["ADMIN", "MANAGER", "CASHIER"];
const REPORT = ["ADMIN", "MANAGER"];

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<App />}>
            {/* public */}
            <Route path="/" element={<Buy />} />
            <Route path="/tickets" element={<MyTickets />} />
            <Route path="/t/:qr" element={<TicketPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            {/* staff */}
            <Route path="/gate" element={<RequireAuth roles={SELL}><GateSale /></RequireAuth>} />
            <Route path="/scan" element={<RequireAuth roles={STAFF}><Scan /></RequireAuth>} />
            <Route path="/children" element={<RequireAuth roles={STAFF}><Children /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth roles={STAFF}><History /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth roles={REPORT}><Reports /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth roles={["ADMIN"]}><Settings /></RequireAuth>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
