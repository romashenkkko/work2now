# Setup Time2Go – tot ce este nevoie

## Ce este deja făcut

- **Dependențe** – instalate (root, server, client)
- **Conexiune MySQL** – la pornirea serverului se creează automat baza `time2go` și tabelul `users`
- **Cont admin** – se creează automat: **admin@admin.com** / **admin1**
- **Porturi** – backend: **5175**, frontend: **5174** (conflictul de port este evitat)

## Ce trebuie să faci tu (2 pași)

### 1. Pornește MySQL în XAMPP

- Deschide **XAMPP Control Panel**
- Apasă **Start** la **MySQL**

Fără MySQL, conturile se salvează doar în memorie (se pierd la repornire).

### 2. Pornește aplicația

În rădăcina proiectului (`Web-Time-to-GO`):

```bash
npm run dev
```

Apoi deschide în browser:

- **Site:** http://localhost:5174
- **API:** http://localhost:5175

## Dacă portul 5174 e ocupat

Închide programul care îl folosește sau schimbă portul în `client/vite.config.ts` (câmpul `port`).

## Setări MySQL (opțional)

În `server/.env`:

- `DB_HOST=localhost`
- `DB_USER=root`
- `DB_PASSWORD=` (gol pentru XAMPP implicit)
- `DB_NAME=time2go`

Dacă ai alt user/parolă, modifică acolo.
