# DonghuaX Frontend

DonghuaX adalah frontend streaming donghua dengan UI modern, auth Firebase, watchlist, history, premium flow, dan panel admin.

Built with:
- React + Vite
- Tailwind CSS
- Firebase Authentication
- REST API backend (Anichin API)

## Highlights

- Login/signup email + Google
- Role admin & premium plan
- Watchlist + riwayat tontonan
- Frontend request cache (localStorage TTL + in-flight dedupe)
- Hero banner auto-rotate
- Streaming page dengan kontrol resolusi/server
- Sponsor overlay flow untuk free plan
- Responsive untuk mobile, tablet, desktop

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Setup environment

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Run development server

```bash
npm run dev
```

4. Open app

`http://localhost:5173`

## Environment Variables

Gunakan file `.env`:

```env
VITE_API_BASE_URL=https://anichinapi-production.up.railway.app
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_ADMIN_EMAILS=admin@emailkamu.com
```

Catatan:
- `VITE_API_BASE_URL` wajib mengarah ke backend aktif.
- Domain frontend kamu harus didaftarkan di Firebase Authorized Domains.

## Scripts

- `npm run dev` -> development
- `npm run build` -> production build
- `npm run preview` -> preview hasil build

## Production Deploy

Rekomendasi:
- Frontend: Vercel / Cloudflare Pages
- Backend: Railway / Render

Checklist deploy:
- Set semua env di platform hosting.
- Pastikan backend CORS mengizinkan domain frontend.
- Pastikan Firebase Auth authorized domain sudah ditambahkan.

## Project Structure

```txt
src/
  components/      # UI reusable
  context/         # auth + app state
  lib/             # API, firebase, helper
  pages/           # route pages
```

## Troubleshooting

- Data donghua kosong:
  - cek `VITE_API_BASE_URL`
  - test endpoint backend di browser
- Login Google gagal:
  - cek Firebase config
  - cek Authorized Domains
- Streaming blank:
  - cek response `/episode/<slug>` dan `/video-source/<slug>`

## License

Internal / private project use.
