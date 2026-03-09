# Work2Now

## Development

**1. Pornește MySQL** (XAMPP: Apache nu e obligatoriu; MySQL trebuie să fie pornit pentru API).

**2. Pornește aplicația (obligatoriu din rădăcina proiectului):**

**Variantă 1 – dublu-clic:**  
Deschide folderul `work2now` în Explorer și dă dublu-clic pe **`Pornește Work2Now.bat`**.

**Variantă 2 – din terminal:**
```bash
cd c:\xampp\htdocs\work2now
npm run dev
```

**Important:** Rulează întotdeauna din **rădăcina** `work2now` (unde se află `package.json` și `Pornește Work2Now.bat`). Dacă rulezi doar `cd client` și `npm run dev`, pornește doar frontend-ul și vei primi **503** la `/api/...` (backend-ul nu rulează).

După pornire, în terminal apare adresa (ex. `http://localhost:5500` sau `5501`). Deschide-o în browser.
