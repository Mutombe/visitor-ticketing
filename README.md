# Gatepass — visitor gate ticketing

Web app for ticketing visitors at a gate — no app install needed. The attendant
enters the party (adults / children), package, time purchased and optional
vehicle; the system issues a **QR ticket** with a **ticket number** and
**expiry time**, delivered as a **printed thermal receipt**, on **WhatsApp**,
or by **SMS**. On the way out the QR is scanned: ✅ valid, ⏳ time remaining,
❌ expired — with the **overstay fee auto-calculated** (per started 30 minutes,
set per package).

Built with **Django + DRF** (SQLite dev / **PostgreSQL** via `DATABASE_URL`)
and **React + Vite**. Design and receipting copied from the Ticketboy design
system: bright blue `#0068F8` + navy `#001850`, Grift display over Inter, the
perforated QR ticket card with PDF/PNG download.

---

## Run it locally

Two terminals.

### Backend (Django, :8000)
```powershell
cd backend
# first time: python -m venv .venv ; .\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed     # 4 packages, time options, demo tickets
.\.venv\Scripts\python.exe manage.py runserver 8000
```
For PostgreSQL, copy `.env.example` → `.env` and set `DATABASE_URL`.

### Frontend (React, :5180)
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5180.

---

## The product

- **Gate** (`/`) — the sale screen: pick a package, time (1h/2h/4h/full day),
  adults/children steppers, optional vehicle & phone, currency (USD/ZiG) and
  payment method (Cash, EcoCash, OneMoney, InnBucks, O'mari, ZimSwitch, card).
  Issues the ticket and opens it.
- **Ticket** (`/t/<qr>`) — the perforated QR ticket with live countdown.
  Actions: **Print receipt** (80mm thermal via the browser print dialog),
  Download PDF / image, WhatsApp, SMS.
- **Scan exit** (`/scan`) — camera QR scanning (native BarcodeDetector, with
  manual entry fallback). Shows Valid / time remaining / Expired / extra to
  pay, collects the overstay fee and records the exit.
- **History** (`/history`) — search by number, name, phone or plate; filter
  inside / overdue / exited, by day.
- **Reports** (`/reports`) — date range: tickets, visitors, revenue (USD +
  ZiG), overstay fees collected, vehicles, inside-now, package mix, payment
  mix, entries by hour, recent tickets.

## Architecture

```
backend/
  config/               Django project (settings, urls)
  gate/                 THE core app
    models.py           GateConfig · Package · TimeOption · Ticket
    serializers.py      issue ticket, live ticket state
    views.py            config, issue/history, lookup, exit, reports
    management/commands/seed.py   demo data

frontend/src/
  api.js                fetch client + helpers (money, share, countdown)
  App.jsx               nav shell (Gate / Scan / History / Reports)
  index.css             Ticketboy design system + thermal receipt print CSS
  components/ui.jsx     Qty stepper, PayPicker, Stat, MixBar, Empty
  pages/                GateSale, TicketPage, Scan, History, Reports
```

### Key API endpoints
| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/config/` | venue, packages, time options, ZiG rate |
| POST | `/api/tickets/` | issue a ticket → number + QR + expiry |
| GET  | `/api/tickets/?q=&date=&state=` | history / search |
| GET  | `/api/tickets/{qr-or-number}/` | live lookup: state, remaining, fee due |
| POST | `/api/tickets/{qr-or-number}/exit/` | collect overstay fee + record exit |
| GET  | `/api/reports/?from=&to=` | daily/range totals and mixes |

### Notes
- Packages, prices, overstay rates, time options, venue name and closing time
  are editable in Django admin (`/admin/`, create a superuser first).
- Payments are recorded at the gate (POS-style), not processed online — wire
  Paynow/EcoCash later if needed.
- WhatsApp/SMS use share links (`wa.me` / `sms:`) — no gateway required; wire
  an SMS/WhatsApp Business API for automatic sending.
- Full-day tickets expire at the venue closing time (default 18:00).
