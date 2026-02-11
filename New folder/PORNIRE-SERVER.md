# Pornire website pe IP (retea)

## Pas cu pas (dacă 192.168.1.6:8000 dă „refused” / ERR_CONNECTION_REFUSED)

1. **Permite portul în Firewall (o singură dată)**  
   Click dreapta pe **`firewall-allow-port-8000.bat`** → **Rulează ca administrator** → OK.  
   Astfel Windows nu mai blochează portul 8000.

2. **Pornește serverul pe acest PC**  
   Dublu-click pe **`start-server.bat`**.  
   **Nu închide fereastra** – atât timp cât e deschisă, serverul rulează.

3. **Deschide site-ul pe IP**  
   În browser: **http://192.168.1.6:8000** (sau adresa afișată în fereastra serverului).

---

## Metoda 1: Script rapid (recomandat)

1. Dublu-click pe **`start-server.bat`** (în folderul proiectului, pe acest PC).
2. În fereastra care se deschide vor apărea adresele de acces, de exemplu:
   - **Pe acest PC:** http://localhost:8000
   - **Din retea (telefon, alt PC):** http://192.168.1.6:8000 (IP-ul tău local)
3. Deschide **http://192.168.1.6:8000** (sau localhost:8000) în browser.

## Metoda 2: Linie de comandă

```bash
cd c:\xampp\htdocs\Web-Time-to-GO
php -S 0.0.0.0:8000
```

- **localhost:** http://localhost:8000 sau http://127.0.0.1:8000  
- **Pe IP (retea):** http://[IP-ul-tau]:8000 (află IP-ul cu `ipconfig` → „Adresa IPv4”)

## Dacă alte dispozitive nu văd site-ul

- **Windows Firewall:** la prima rulare, când apare fereastra „Windows Security”, bifează **Rețele private** și apasă **Permite acces**.
- Sau: *Setări → Actualizare și securitate → Windows Security → Firewall → Permiteți o aplicație prin firewall* → găsește **PHP** și permite pe rețea privată.
- Asigură-te că dispozitivul din retea este în aceeași rețea Wi-Fi/LAN (același router).

## Oprire server

În fereastra unde rulează serverul, apasă **Ctrl+C**.
