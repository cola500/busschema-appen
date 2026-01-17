# 🚌 Busschema-app för Västtrafik

En enkel webapp som visar realtidsavgångar från Västtrafiks hållplatser. Byggd för att köras på Raspberry Pi med pekskärm.

## Funktioner

- ✅ Realtidsavgångar från Västtrafik
- ✅ Sök och välj hållplats
- ✅ **Favoritfunktion** - Spara upp till 5 favorithållplatser
- ✅ **Touch-optimerad** - Stora klickbara ytor (60x60px minimum)
- ✅ Automatisk uppdatering var 30:e sekund
- ✅ Färgkodade linjenummer
- ✅ Visar minuter kvar eller avgångstid
- ✅ Touchvänligt gränssnitt med visuell feedback
- ✅ Sparar vald hållplats och favoriter i localStorage
- ✅ Responsiv design för mobil och desktop

## Tech Stack

- **Frontend**: Vanilla JavaScript + Vite
- **Backend**: Node.js + Express
- **API**: Västtrafik API Planera Resa v4

## Kom igång

### 1. Skaffa API-nycklar från Västtrafik

1. Gå till [developer.vasttrafik.se](https://developer.vasttrafik.se/)
2. Skapa konto och logga in
3. Skapa en ny app
4. Prenumerera på "API Planera Resa v4" (eller "Reseplaneraren v2")
5. Kopiera ditt **Client ID** och **Client Secret**

### 2. Installera dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Konfigurera backend

```bash
cd backend
cp .env.example .env
```

Redigera `.env` och lägg till dina API-nycklar:

```
VASTTRAFIK_CLIENT_ID=ditt_client_id
VASTTRAFIK_CLIENT_SECRET=ditt_client_secret
PORT=3001
FRONTEND_URL=http://localhost:5173
STOP_NAME=Betaniagatan
```

### 4. Starta applikationen

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Öppna webbläsaren på: **http://localhost:5173**

## Deployment till Vercel (Rekommenderat)

Denna app är fullständigt konfigurerad för Vercel deployment med både frontend och backend i samma projekt.

### Steg 1: Logga in på Vercel
1. Gå till [vercel.com](https://vercel.com)
2. Klicka "Sign Up" eller "Log In"
3. Logga in med GitHub (rekommenderat)

### Steg 2: Importera Project
1. Klicka "Add New..." → "Project"
2. Hitta `busschema-app` i listan över GitHub repos
3. Klicka "Import"

### Steg 3: Konfigurera Project Settings
Vercel ska automatiskt detektera:
- **Framework Preset:** Vite
- **Root Directory:** `./` (lämna tomt)
- **Build Command:** `cd frontend && npm install && npm run build`
- **Output Directory:** `frontend/dist`

**Om Vercel inte fyller i automatiskt:**
- Välj "Vite" som Framework Preset
- Övriga settings ska fyllas i automatiskt

### Steg 4: Lägg till Environment Variables
I "Environment Variables" sektionen, lägg till:

| Name | Value |
|------|-------|
| `VASTTRAFIK_CLIENT_ID` | Ditt Client ID från Västtrafik |
| `VASTTRAFIK_CLIENT_SECRET` | Ditt Client Secret från Västtrafik |

**VIKTIGT:** Klicka på alla 3 checkboxes (Production, Preview, Development)

### Steg 5: Deploy!
1. Klicka "Deploy"
2. Vänta medan Vercel bygger projektet (tar ca 1-2 minuter)
3. När det står "Congratulations!" - klicka på preview-länken

### Steg 6: Testa Appen
1. Öppna deployed URL (t.ex. `busschema-app.vercel.app`)
2. Testa söka efter "Brunnsparken"
3. Klicka på en hållplats
4. Verifiera att avgångar visas
5. Testa favoritfunktionen

### Troubleshooting

#### Problem: "Failed to fetch"
**Orsak:** API endpoints fungerar inte
**Lösning:**
1. Gå till Vercel Dashboard → Functions
2. Klicka på en function och kolla logs
3. Verifiera att environment variables är satta

#### Problem: "401 Unauthorized" från Västtrafik
**Orsak:** Felaktiga API-nycklar
**Lösning:**
1. Gå till Settings → Environment Variables
2. Dubbelkolla att Client ID och Secret är korrekta
3. Redeploy (Settings → Deployments → ... → Redeploy)

#### Problem: Appen laddar men visar inga avgångar
**Orsak:** Troligen API-problem
**Lösning:**
1. Öppna Developer Console (F12)
2. Gå till Network tab
3. Klicka på en hållplats
4. Kolla om `/api/departures/...` request lyckas
5. Om 500 error → kolla Vercel function logs

### Efter Deployment

**Automatisk deployment:** Varje gång du pushar till GitHub så deployar Vercel automatiskt! 🎉

**Preview deployments:** Varje branch får sin egen preview-URL för testning

**Kostnader:** Vercel Free Tier inkluderar 100 GB-hours/month för serverless functions vilket räcker mer än väl för personligt bruk.

---

## Deployment till Raspberry Pi

### Förutsättningar

- Raspberry Pi (3B+ eller nyare rekommenderas)
- Raspberry Pi OS installerad
- Pekskärm kopplad (t.ex. 7" touchscreen)
- Internet-uppkoppling

### Steg-för-steg

#### 1. Installera Node.js på Raspberry Pi

```bash
# Uppdatera systemet
sudo apt update && sudo apt upgrade -y

# Installera Node.js (version 18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verifiera
node --version
npm --version
```

#### 2. Kopiera projekt till Raspberry Pi

```bash
# Från din dator (i busschema-app mappen)
scp -r . pi@<raspberry-pi-ip>:/home/pi/busschema-app
```

Eller klona från git om du pushat till GitHub:

```bash
git clone <your-repo-url> /home/pi/busschema-app
```

#### 3. Installera och konfigurera

```bash
cd /home/pi/busschema-app

# Backend
cd backend
npm install
cp .env.example .env
nano .env  # Lägg till dina API-nycklar

# Frontend - bygg för produktion
cd ../frontend
npm install
npm run build
```

#### 4. Servera frontend med backend (production mode)

Uppdatera `backend/server.js` för att servera byggd frontend:

```javascript
// Lägg till efter imports
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lägg till före app.listen()
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Catch-all route för frontend
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});
```

Uppdatera även `frontend/main.js` för att använda rätt API URL:

```javascript
// Använd relativ URL i produktion
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';
```

#### 5. Skapa systemd service för autostart

Skapa fil: `/etc/systemd/system/busschema.service`

```ini
[Unit]
Description=Busschema App
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/busschema-app/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Aktivera servicen:

```bash
sudo systemctl enable busschema.service
sudo systemctl start busschema.service
sudo systemctl status busschema.service
```

#### 6. Konfigurera Chromium i kiosk-läge

Skapa autostart-fil: `~/.config/lxsession/LXDE-pi/autostart`

```bash
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xscreensaver -no-splash

# Stäng av screensaver
@xset s off
@xset -dpms
@xset s noblank

# Öppna Chromium i kiosk-läge
@chromium-browser --kiosk --app=http://localhost:3001 --start-fullscreen --incognito --disable-pinch --overscroll-history-navigation=0
```

Eller använd startskript:

```bash
# Skapa fil: /home/pi/start-busschema.sh
#!/bin/bash

# Vänta på att nätverket ska vara redo
sleep 10

# Starta Chromium i kiosk-läge
DISPLAY=:0 chromium-browser \
  --kiosk \
  --app=http://localhost:3001 \
  --start-fullscreen \
  --incognito \
  --disable-pinch \
  --overscroll-history-navigation=0
```

Gör den körbar:

```bash
chmod +x /home/pi/start-busschema.sh
```

Lägg till i autostart:

```bash
echo "@/home/pi/start-busschema.sh" >> ~/.config/lxsession/LXDE-pi/autostart
```

#### 7. Starta om Raspberry Pi

```bash
sudo reboot
```

När Pi:n startar ska appen öppnas automatiskt i fullskärm!

## Felsökning

### Backend startar inte

```bash
# Kolla loggar
sudo journalctl -u busschema.service -f

# Kontrollera att .env finns och är korrekt
cd /home/pi/busschema-app/backend
cat .env
```

### API-fel "401 Unauthorized"

- Kontrollera att `VASTTRAFIK_CLIENT_ID` och `VASTTRAFIK_CLIENT_SECRET` är korrekta
- Testa att du kan få access token: `curl -X POST https://ext-api.vasttrafik.se/token ...`

### Chromium öppnar inte automatiskt

```bash
# Testa starta manuellt
/home/pi/start-busschema.sh

# Kolla autostart-filen
cat ~/.config/lxsession/LXDE-pi/autostart
```

### Pekskärmen är roterad

```bash
# Rotera skärmen (lägg till i /boot/config.txt)
lcd_rotate=2  # 0, 1, 2, eller 3 (90° steg)
```

## Användning

### Välja hållplats
1. När appen startar söks automatiskt efter "Betaniagatan"
2. Klicka/touch på en hållplats i sökresultaten
3. Avgångar uppdateras automatiskt var 30:e sekund
4. Tryck på "🔄 Uppdatera" för manuell uppdatering

### Favoriter
1. När du valt en hållplats - klicka på ⭐-knappen i headern
2. Hållplatsen läggs till i favoritlistan (max 5 favoriter)
3. Klicka på en favorit för att snabbt byta hållplats
4. Ta bort favoriter med 🗑️-knappen
5. Favoriter sparas automatiskt i localStorage

## API Endpoints

### Backend API

- `GET /api/stops/search?query=<name>` - Sök hållplatser
- `GET /api/departures/:gid` - Hämta avgångar för en hållplats
- `GET /health` - Health check

### Västtrafik API

Backend använder:
- `POST https://ext-api.vasttrafik.se/token` - OAuth2 token
- `GET https://ext-api.vasttrafik.se/pr/v4/locations/by-text` - Sök hållplatser
- `GET https://ext-api.vasttrafik.se/pr/v4/stop-areas/{gid}/departures` - Avgångar

## Utveckling

### Dev mode (med hot reload)

```bash
# Backend med auto-restart
cd backend
npm run dev

# Frontend med Vite HMR
cd frontend
npm run dev
```

### Bygg för produktion

```bash
cd frontend
npm run build
```

## Framtida förbättringar

- [x] ~~Favoritlinjer/filter~~ ✅ **Implementerat i v1.1.0**
- [x] ~~Touch-optimering~~ ✅ **Implementerat i v1.1.0**
- [ ] PWA (installera som app)
- [ ] Offline-stöd med service worker
- [ ] Störningsmeddelanden från Västtrafik
- [ ] Multi-hållplats stöd (flera samtidigt)
- [ ] Historik och statistik
- [ ] Dark mode
- [ ] Notifikationer när favorit-buss är nära

## License

MIT

## Resurser

- [Västtrafik Developer Portal](https://developer.vasttrafik.se/)
- [Västtrafik API Dokumentation](https://developer.vasttrafik.se/portal/guides)
- [Raspberry Pi Documentation](https://www.raspberrypi.org/documentation/)

---

**Skapad**: 2026-01-17
**Senast uppdaterad**: 2026-01-17
**Version**: 1.2.0
**Live URL**: https://busschema-appen.vercel.app

## Dokumentation

- [CHANGELOG.md](CHANGELOG.md) - Ändringshistorik mellan versioner
- [DEPLOYMENT_RETRO.md](DEPLOYMENT_RETRO.md) - Deployment retrospektiv med lärdomar
- [RETROSPECTIVE.md](RETROSPECTIVE.md) - UX/Touch-optimering retrospektiv

## Deployment Lärdomar

### ⚠️ Viktigt vid Vercel Deployment

**FÖRE första deployen:**
1. ✅ Verifiera vilket GitHub repo Vercel ska kopplas till
2. ✅ Se till att repo-namnet matchar exakt
3. ✅ Pusha all kod till rätt repo först

**Vanliga problem:**
- **"localhost:3001" errors** → Kolla Settings → Git → Rätt repository?
- **Gammal kod deployar** → Disable build cache och redeploy
- **API fungerar inte** → Kolla Settings → Environment Variables

**Environment Variables som INTE ska sättas:**
- ❌ `VITE_API_URL` - Behövs inte! Använder relativ URL (`/api`)

**Environment Variables som SKA sättas:**
- ✅ `VASTTRAFIK_CLIENT_ID`
- ✅ `VASTTRAFIK_CLIENT_SECRET`

Se [DEPLOYMENT_RETRO.md](DEPLOYMENT_RETRO.md) för fullständig dokumentation av deployment-processen.
