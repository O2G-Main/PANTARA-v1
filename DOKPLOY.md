# Deploy Pantara Frontend ke Dokploy

## 1. Pilihan Sumber Git & Build
Sekarang repo frontend bisa di-deploy dari **root (`/`) maupun subfolder (`frontend`)**:
- **Repository:** `https://github.com/Orang2-BU/PANTARA-v1`
- **Branch:** `hadooyy`
- **Build Type:** `Dockerfile`
- **Opsi A (Disarankan, default root):** Build Path `/` · Docker File `Dockerfile`
- **Opsi B (Subfolder frontend):** Build Path `frontend` · Docker File `Dockerfile`
- **Exposed / Internal Port:** `3000`
- **Healthcheck Path:** `/health`

> Aplikasi Next.js memakai `output: "standalone"` dan runtime Route Handler `src/app/api/v1/[...path]/route.ts`, jadi `BACKEND_INTERNAL_URL` dibaca saat runtime dan bebas diubah tanpa rebuild image. Default `NEXT_PUBLIC_DATA_MODE` saat docker build adalah `api` (terhubung penuh ke backend Go).

## 2. Environment Variables (Dokploy)
```env
NEXT_PUBLIC_DATA_MODE=api
BACKEND_INTERNAL_URL=http://<nama-service-backend-dokploy>:8000
```

> [!NOTE]
> - Pastikan service frontend dan `<nama-service-backend-dokploy>` berada di **Project / Docker network Dokploy yang sama** agar proxy `/api/v1/*` dan SSE `/api/v1/notifications/stream` berkomunikasi lewat jaringan internal Docker (tidak lewat internet publik).
> - Domain HTTPS publik hanya perlu diarahkan ke service **frontend** port `3000` (Traefik Dokploy mengirim `X-Forwarded-Proto: https` sehingga `COOKIE_SECURE=auto` di backend otomatis mengaktifkan cookie `Secure; HttpOnly; SameSite=Lax`).
> - Akun login default (bila backend menyalakan `SEED_DEMO=true`): Admin `krisna@pantara.id`, Manajer `manajer@pantara.id`, HR `hr@pantara.id`, Anggota `bima@pantara.id` (sandi: `pantara2026`).
