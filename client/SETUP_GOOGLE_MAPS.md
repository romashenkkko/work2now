# Cum obții cheia Google Maps (gratuit)

Harta din „Adaugă adresă” poate folosi Google Maps dacă adaugi o cheie API. Pașii sunt rapizi și **Google oferă credit gratuit lunar** pentru Maps.

## Pași (5 minute)

### 1. Intră în Google Cloud Console
- Deschide: **https://console.cloud.google.com/**
- Conectează-te cu contul tău Google (Gmail).

### 2. Creează un proiect (dacă nu ai)
- Sus în bara albastră: click pe **Select a project** → **New Project**.
- Nume: de ex. „Time2Go”.
- Click **Create**.

### 3. Activează Maps JavaScript API
- În meniul din stânga: **APIs & Services** → **Library** (Bibliotecă).
- Caută: **Maps JavaScript API**.
- Deschide-l și click **Enable** (Activează).

### 4. Creează cheia API
- **APIs & Services** → **Credentials** (Credențiale).
- **+ Create Credentials** → **API key**.
- Se creează o cheie (ex: `AIza...`). Poți să o copiezi direct sau să dai **Close**.

### 5. Pune cheia în proiect
- Deschide fișierul **`.env`** din folderul **`client`** (același nivel cu `package.json`).
- Adaugă o linie nouă (înlocuiește `CHEIA_TA` cu cheia copiată):

```
VITE_GOOGLE_MAPS_API_KEY=CHEIA_TA
```

- Salvează fișierul.

### 6. Repornește aplicația
- Oprește serverul (Ctrl+C) și rulează din nou: **npm run dev**.
- Deschide „Adaugă adresă” – harta va fi Google Maps.

---

**Fără cheie:** aplicația funcționează normal cu harta gratuită (OpenStreetMap). Cheia este opțională doar pentru a afișa Google Maps.

**Securitate:** nu pune cheia în cod sursă pe GitHub. Folosește doar în `.env` (fișierul `.env` nu se uploadează dacă e în `.gitignore`).
