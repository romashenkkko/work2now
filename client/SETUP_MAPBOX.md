# Hărți Mapbox (Time2Work)

Aplicația folosește **Mapbox GL JS** pentru hărți. Stilul custom: `mapbox://styles/vasilepopovici/cmlqvsvuc001601scb2aocofg`.

## Configurare

1. **Token Mapbox**  
   Obține un token public de pe [Mapbox Account → Access tokens](https://account.mapbox.com/access-tokens/).

2. **În proiect**  
   În folderul `client` creează sau editează fișierul **`.env`** și adaugă:

   ```
   VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1...your_token...
   ```

3. **Repornește**  
   Oprește serverul (Ctrl+C) și rulează din nou: `npm run dev`.

Fără token, harta nu se încarcă și se afișează un mesaj să adaugi `VITE_MAPBOX_ACCESS_TOKEN` în `client/.env`.

**Securitate:** nu pune token-ul în cod sursă pe GitHub. Folosește doar în `.env` (fișierul `.env` nu se uploadează dacă e în `.gitignore`).
