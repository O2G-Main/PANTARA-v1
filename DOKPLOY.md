# Deploy Pantara Frontend ke Dokploy

## 1. Sumber Git & Build
- **Repository:** `https://github.com/Orang2-BU/PANTARA-v1`
- **Branch:** `hadooyy`
- **Build Type:** `Dockerfile`
- **Build Path (Context):** `frontend`
- **Docker File:** `Dockerfile` (atau `frontend/Dockerfile` sesuai format root Dokploy Anda)
- **Exposed / Internal Port:** `3000`
- **Healthcheck Path:** `/health`

> Aplikasi Next.js memakai `output: "standalone"` dan runtime Route Handler `src/app/api/v1/[...path]/route.ts`, jadi alamat backend tidak ter-bake saat `docker build` dan bebas diubah via environment variable runtime.

## 2. Environment Variables (Dokploy)
```env
NEXT_PUBLIC_DATA_MODE=api
BACKEND_INTERNAL_URL=http://<nama-service-backend-dokploy>:8000
```

> [!NOTE]
> - Pastikan `<nama-service-backend-dokploy>` berada di Docker network / Project Dokploy yang sama dengan frontend agar proxy `/api/v1/*` dan stream SSE `/api/v1/notifications/stream` berkomunikasi langsung lewat jaringan internal.
> - Domain HTTPS publik hanya perlu diarahkan ke service **frontend** port `3000` (Traefik Dokploy mengirim `X-Forwarded-Proto: https` sehingga `COOKIE_SECURE=auto` di backend otomatis menyalakan cookie `Secure; HttpOnly; SameSite=Lax`).
