# Time2Go API (Node.js + Express + MySQL)

## Pornire rapidă

### 1. Variabile de mediu

Copiază `.env.example` în `.env` și ajustează dacă e cazul:

```bash
cp .env.example .env
```

Implicit: `DB_HOST=localhost`, `DB_USER=root`, `DB_PASSWORD=` (gol), `DB_NAME=time2go`.

### 2. Baza de date MySQL

- Pornește MySQL (XAMPP: Apache + MySQL, sau doar MySQL).
- Creează baza de date și tabelul `users`:
  - **Opțiune A – phpMyAdmin:** Deschide http://localhost/phpmyadmin → Import → alege `server/database/schema.sql` → Execută.
  - **Opțiune B – linie de comandă:**  
    `C:\xampp\mysql\bin\mysql.exe -u root < database/schema.sql`  
    (sau `mysql -u root -p < database/schema.sql` dacă ai parolă pe root).

### 3. Pornire server

```bash
npm install
npm run dev
```

Serverul rulează pe http://localhost:3000. Frontend-ul (Vite) face proxy `/api` către 3000.

### Verificare

- **Health:** http://localhost:3000/api/health  
  - Răspuns `{ "ok": true }` = server + MySQL OK.  
  - Răspuns 503 = MySQL nu răspunde sau baza/tabelul lipsesc → rulează `schema.sql`.

## Endpoints

- `POST /api/auth/register` – înregistrare (body: name, email, password, role?)
- `POST /api/auth/login` – login (body: email, password)
- `GET /api/auth/me` – utilizator curent (Header: Authorization Bearer &lt;token&gt;)
