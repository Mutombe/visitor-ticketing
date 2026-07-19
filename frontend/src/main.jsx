import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import GateSale from "./pages/GateSale.jsx";
import TicketPage from "./pages/TicketPage.jsx";
import Scan from "./pages/Scan.jsx";
import History from "./pages/History.jsx";
import Reports from "./pages/Reports.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<GateSale />} />
          <Route path="/t/:qr" element={<TicketPage />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
