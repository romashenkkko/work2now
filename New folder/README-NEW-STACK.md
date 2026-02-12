# Work2Now – React + Node.js (TypeScript)

Proiectul a fost migrat la:

- **Frontend (client):** TypeScript + React, Vite (build), Tailwind CSS, i18n (JSON: ro, en, ru)
- **Backend (server):** TypeScript + Node.js (Express), MySQL, JWT pentru autentificare
- **Baza de date:** MySQL – schema în `server/database/schema.sql`

---

## Cerințe

- **Node.js** 18+
- **MySQL** (XAMPP sau standalone) – baza `work2now` și tabelul `users` create din `server/database/schema.sql`
- **npm** sau **yarn**

---

## Instalare și rulare

### 1. Baza de date

În MySQL (phpMyAdmin sau CLI):

```sql
-- Rulează conținutul din:
-- server/database/schema.sql
CREATE DATABASE IF NOT EXISTS work2now CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE work2now;
CREATE TABLE IF NOT EXISTS users ( ... );
```

### 2. Backend (API)

```bash
cd server
cp .env.example .env
# Editează .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
npm install
npm run dev
```

API rulează pe **http://localhost:3000**. Rute: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (cu header `Authorization: Bearer <token>`).

### 3. Frontend (React)

```bash
cd client
npm install
npm run dev
```

Interfața rulează pe **http://localhost:5173**. Vite face proxy la `/api` către `http://localhost:3000`.

### 4. Producție

```bash
# Build client
cd client && npm run build

# Pornește doar serverul (servește și build-ul React din server + client/dist)
cd server && npm run build && npm start
```

Serverul va servi și fișierele statice din `client/dist` și va răspunde la `/api/*`. Deschide **http://localhost:3000**.

---

## Structură

```
Web-Time-to-GO/
├── client/                 # React + Vite + TypeScript + Tailwind
│   ├── public/             # Logo, Illustration (static)
│   ├── src/
│   │   ├── api/            # client API (auth)
│   │   ├── components/     # Layout, Header, Footer
│   │   ├── hooks/          # useAuth
│   │   ├── locales/        # ro.json, en.json, ru.json (i18n)
│   │   ├── pages/          # Home, FindJobs, FindStaff, Contact, Blog, Login, Register, Dashboard
│   │   ├── App.tsx, main.tsx, i18n.ts, index.css
│   ├── package.json, vite.config.ts, tailwind.config.js
├── server/                  # Node.js + Express + TypeScript
│   ├── database/schema.sql  # MySQL schema
│   ├── src/
│   │   ├── routes/auth.ts   # register, login, me
│   │   ├── middleware/auth.ts  # JWT
│   │   ├── db.ts           # MySQL pool
│   │   ├── index.ts        # Express app
│   ├── .env.example, package.json, tsconfig.json
└── README-NEW-STACK.md      # acest fișier
```

---

## Limbaje (i18n)

Traducerile sunt în `client/src/locales/` (ro.json, en.json, ru.json). Schimbarea limbii se face din header (dropdown RO/EN/RU). Implicit: română.

---

## PHP (vechi)

Fișierele PHP din rădăcină (index.php, login.php, etc.) au rămas pentru referință. Pentru noul stack folosești doar **client** + **server** conform pașilor de mai sus.
