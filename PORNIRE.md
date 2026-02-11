# Pornire Time2Go

## O singură comandă (obligatoriu)

Din **rădăcina proiectului** (folderul `Web-Time-to-GO`), rulează:

```bash
npm run dev
```

Aceasta pornește **în același timp**:
- **Backend** (API) pe portul **5175** – răspunde la `/api/auth/register`, `/api/auth/login`, etc.
- **Frontend** (site) pe portul **5173** sau **5174** – aici deschizi aplicația în browser.

## Cum sunt legate

- Când deschizi site-ul (ex. http://localhost:5173), requesturile către **/api** sunt trimise automat de la frontend la backend (proxy Vite → localhost:5175).
- **Trebuie să ruleze ambele.** Dacă rulezi doar frontend-ul, butonul „Inregistrare” va da eroare de server.

## După pornire

1. Deschide în browser:
   - **Pe același PC:** http://localhost:5173 (sau 5174)
   - **Pe rețea (telefon/alt PC):** http://192.168.1.6:5173 (înlocuiește cu IP-ul afișat la „Network” în terminal)
2. Mergi la **Creaza cont** → completează formularul → **Inregistrare**.
3. Apoi **Autentificare** cu același email și parolă → vei fi dus la **Dashboard**.

**Crearea de cont pe IP:** dacă deschizi site-ul la adresa de rețea (ex. http://192.168.1.6:5173), formularul „Creaza cont” și login-ul funcționează la fel – requesturile /api merg automat la backend-ul de pe același calculator.

## MySQL (salvare persistentă a conturilor)

Pentru ca conturile să se salveze în baza de date (nu doar în memorie):

1. **Pornește MySQL** – în XAMPP apasă **Start** la **MySQL**.
2. **Pornește aplicația** – `npm run dev` din rădăcina proiectului.

La primul start, serverul creează automat baza `time2go` și tabelul `users` dacă nu există. Setările sunt în `server/.env` (implicit: `localhost`, user `root`, parolă goală, baza `time2go`).

Dacă MySQL nu rulează, conturile sunt salvate temporar în memorie (se pierd la repornirea serverului).
