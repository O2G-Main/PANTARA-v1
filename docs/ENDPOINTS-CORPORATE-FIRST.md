# Kebutuhan Endpoint: Manajer & Anggota Tim (Corporate-First)

Daftar kebutuhan frontend terhadap backend, sesuai kode saat ini (sumber: `docs/CORPORATE-FIRST.md`). Frontend tidak menyentuh `backend/`; dokumen ini satu-satunya kontrak yang diminta.

Status sekarang:
- Mode `mock` (`NEXT_PUBLIC_DATA_MODE=mock`): semua fitur di bawah jalan dengan seed di `frontend/src/lib/demo/`. Jam demo dikunci ke `NOW` di `seed.ts` (29 Sep 2026), bukan jam perangkat.
- Mode `api` (default bila env tidak diset): aksi yang butuh endpoint di bawah nonaktif dengan keterangan "Menunggu backend" (`AWAITING_BACKEND` di `frontend/src/lib/api.ts`). Halaman HR dan penilaian hanya tampil di mode `mock`.
- Setelah endpoint siap: ganti `dispatch` lokal di komponen terkait dengan panggilan `api.*`, lalu hapus penanda `AWAITING_BACKEND`.

Semua endpoint di bawah prefix `/api/v1`, memakai cookie auth dan format error `{ error: { code, message, fields? } }` yang sudah ada.

## 1. Perubahan model data

| Model | Field baru | Tipe | Keterangan |
| --- | --- | --- | --- |
| `Member` | `employmentType` | `"karyawan" \| "freelancer"` | Default `karyawan`. Diisi HR/manajer saat menambah anggota. |
| `Task` | `dueTime` | `"HH:MM"` (WIB) | Default `17:00`. Bersama `dueDate` menentukan waktu tenggat. |
| `Task` | `externalSource` | `string \| null` | Nama sistem tempat pekerjaan dikelola (mis. "Jira klinik"). Ada = pekerjaan eksternal. |
| `Task` | `extraTime` | `ExtraTimeRequest \| null` | Permintaan tambahan waktu terakhir. |
| `Task` | `resultNote` | `string \| null` | Catatan hasil dari manajer. Teks saja, tanpa skor, tidak dipakai rekomendasi. |
| `Member` | `leaveRequests` | `LeaveRequest[]` | Pengajuan cuti anggota beserta status persetujuan. |
| `EngineSettings` | `reserveRatio` | `number` 0 sampai 0,3 | Porsi jam tersedia yang disisakan untuk tugas mendesak. |

`ExtraTimeRequest = { memberId, hours, reason, requestedAt, status: "menunggu" | "disetujui" | "ditolak" }`

`LeaveRequest = { id, start, end, type: "tahunan" | "sakit" | "izin", reason, requestedAt, manager: Approval, hr: Approval }`, dengan `Approval = "menunggu" | "disetujui" | "ditolak"`.

Status gabungan sebuah pengajuan cuti:
- ditolak bila salah satu pihak menolak;
- disetujui bila manajer dan HR sama-sama setuju (urutan bebas);
- selain itu menunggu.

Saat sebuah pengajuan disetujui penuh, hari kerja di rentang tanggalnya ditambahkan ke `leaveDates`. Referensi: `frontend/src/lib/engine/leave.ts`.

Field baru dikembalikan di semua payload yang memuat `Task`, `Member`, dan `EngineSettings` (`/workspace/bootstrap`, `/tasks`, `/members`, `/workspace/settings`, `/saya/overview`).

## 2. Anggota Tim

### `POST /saya/tasks/:id/extra-time`
Anggota meminta tambahan jam estimasi. Tenggat tetap.
- Body: `{ hours: number, reason: string }`
- Validasi:
  - pemanggil adalah penanggung jawab tugas;
  - `status = berjalan`;
  - waktu server ≥ tenggat − 2 jam;
  - tidak ada permintaan berstatus `menunggu`;
  - `hours > 0`;
  - `reason` minimal 10 karakter.
- Respons: `{ task }`. Kirim notifikasi ke manajer.
- Error: `403 not_assignee`, `409 extra_time_pending`, `422 too_early` (tenggat masih lebih dari 2 jam).

### `POST /saya/tasks/:id/respond`, ubah aturan
- `accept: false` hanya untuk `employment = freelancer`. Karyawan mendapat `403 reject_not_allowed`.
- `accept: true` tetap untuk semua.

### `POST /saya/leave-requests`
Anggota mengajukan cuti.
- Body: `{ start, end, type, reason }`
- Validasi:
  - `start` tidak sebelum hari ini;
  - `end` tidak sebelum `start`;
  - rentang berisi minimal 1 hari kerja;
  - `reason` minimal 10 karakter.
- Respons: `{ member }`. Kirim notifikasi ke manajer dan HR.

### Ketersediaan anggota jadi hanya baca, ubah aturan endpoint lama
- **`PUT /saya/availability`:** hapus, atau balas `403`. Anggota tidak lagi mengubah jam tersedia, batas mingguan, atau cuti secara langsung. Pemanggilnya di frontend sudah dihapus.
- **`GET /saya/overview`:** `previousAvailability` tidak dipakai lagi.

### `GET /saya/overview`, tambah riwayat
- Tambahkan tugas `selesai` milik pemanggil (judul, tenggat, `actualHours`) untuk kartu "Riwayat kerja saya". Bisa juga diturunkan dari `/tasks` yang sudah disaring per anggota.

## 3. Manajer

### `POST /tasks/:id/extra-time/decision`
- Body: `{ approve: boolean }`
- Disetujui:
  - `remainingHours += hours`;
  - jam penugasan peminta `+= hours`;
  - `extraTime.status = disetujui`;
  - tenggat tidak berubah.
- Ditolak: `extraTime.status = ditolak`.
- Respons: `{ task }`. Kirim notifikasi ke anggota. Error `409 no_pending_request`.
- Referensi logika: `decideExtraTime()` di `frontend/src/lib/engine/capacity.ts`.

### `POST /tasks/import`
Impor tugas massal dari CSV.
- Body: `{ csv: string, dryRun: boolean }`
- Kolom: `judul,proyek,tenggat,jam_tenggat,prioritas,dikelola_di,penanggung_jawab,jam,deskripsi`. Deskripsi ada di kolom terakhir dan boleh berisi koma.
- Aturan per baris:
  - `proyek` adalah id proyek yang ada;
  - `tenggat` berformat YYYY-MM-DD dan tidak lewat;
  - `jam_tenggat` berformat HH:MM (opsional);
  - `prioritas` bernilai rendah, normal, atau tinggi (default normal).
- Duplikat: judul (tanpa membedakan huruf besar) dan proyek sama dengan tugas yang sudah ada atau baris sebelumnya.
- Baris biasa: deskripsi minimal 20 karakter, status `belum`, lalu antre analisis kebutuhan.
- Baris eksternal (`dikelola_di` terisi):
  - `penanggung_jawab` adalah email anggota terdaftar;
  - `jam > 0`;
  - status langsung `berjalan` dengan penugasan ke anggota itu, supaya beban terhitung.
- Respons: `{ rows: { line, task?, error? }[] }`. Saat `dryRun = false`, hanya baris valid yang disimpan.
- Referensi logika dan test: `frontend/src/lib/demo/import-tasks.ts` dan `import-tasks.test.ts`.

### `PATCH /tasks/:id/result-note`
- Body: `{ note: string }`. String kosong menghapus catatan.
- Hanya untuk tugas `selesai`.
- Tidak boleh dipakai sebagai input skor atau rekomendasi (07-RULES §4).

### `POST /tasks` dan `PATCH /tasks/:id`, tambah field
- Terima `dueTime` (opsional, default `17:00`).

### `PATCH /workspace/settings`, tambah `reserveRatio`
- Validasi 0 sampai 0,3.
- Mesin rekomendasi (kandidat, simulasi, batch) mengalikan jam tersedia dan jam kosong sampai tenggat dengan `1 − reserveRatio` untuk tugas prioritas normal atau rendah. Tugas prioritas tinggi memakai jam penuh.
- Referensi: `rankCandidates()` di `frontend/src/lib/engine/score.ts`.

### `POST /members/:id/leave-requests/:reqId/decision`
Keputusan manajer atas pengajuan cuti.
- Body: `{ approve: boolean }`
- Mengisi `manager` pada pengajuan. Bila HR sudah setuju, `leaveDates` diperbarui.
- Error `409` bila pengajuan sudah final atau manajer sudah memutuskan.

### Ketersediaan diatur HR, bukan manajer
- **`PUT /members/:id/availability`:** batasi ke peran HR. Pemanggilnya di sisi manajer sudah dihapus (halaman Kapasitas dan profil anggota).
- **`PATCH /members/:id`:** manajer tidak lagi mengubah `weeklyLimit`. Frontend mengirim nilai lama; backend sebaiknya mengabaikan `weeklyLimit` dari manajer.

### `POST /members`, tambah field
- Terima `employmentType` (default `karyawan`).

## 4. HR

Peran `hr` sudah ada di frontend tetapi masih akun hardcode di `frontend/src/lib/session.ts` (`hr@pantara.id`, beranda `/hr`) dan hanya jalan di mode `mock`. `ServerRole` di `api.ts` belum memuat `hr`. Seluruh data HR di bawah hidup di `DemoState` (`frontend/src/lib/demo/store.tsx`) dan hilang saat muat ulang.

### Peran dan RBAC
- Tambah `hr` ke `ServerRole`, `AuthUser.role`, dan `Member.access`. `AuthUser.home` untuk HR: `/hr`.
- HR hanya boleh membuka rute `/hr/*` dan rute bersama (`/pengajuan-hr`, `/notifikasi`, `/akun`, `/bantuan`). Manajer dan anggota tidak boleh membuka `/hr/*` (lihat `canAccess()` di `frontend/src/lib/nav.ts`).

### Anggota, tim, divisi (`/hr/anggota`, `/hr/tim`)
- Field baru `Member`: `team`, `division` (string bebas), `workHoursOverride` dan `reserveHoursOverride` (jam per minggu, opsional), `isActive`.
- **`POST /members`** dan **`PATCH /members/:id`** (peran HR): terima `employmentType`, `team`, `division`, `weeklyLimit`, `workHoursOverride`, `reserveHoursOverride`, `isActive`.
- **`POST /members/import`:** `{ csv, dryRun }`. Header persis `nama,email,jabatan,jenis,tim,divisi,jam` (7 kolom, tanpa koma di dalam kolom; `jabatan` = `Member.role`, `jenis` = `employmentType`, `jam` = `weeklyLimit`). Acuan: `frontend/src/app/(app)/hr/anggota/page.tsx`. Email unik tanpa membedakan huruf besar; jenis hubungan `karyawan` atau `freelancer`; jam 0 sampai 168. Respons per baris `{ line, member?, error? }`; baris valid saja yang disimpan bila `dryRun = false`.
- **Divisi:** `GET /hr/divisions`, `POST /hr/divisions` `{ name }`, `PATCH /hr/divisions/:name` `{ name }` (mengganti `division` seluruh anggotanya), tanpa hapus. Divisi kosong tetap ada.
- **`POST /hr/members/place`:** `{ ids: string[], division, team? }` menempatkan beberapa anggota sekaligus (`placeMembers`).
- **Pembacaan CV (opsional):** lihat `docs/HR-CV-EXTRACTION.md`. Saat ini PDF/DOCX dibaca di browser dan tidak dikirim ke server.

### Pengaturan HR (`/hr/pengaturan`)
- **`GET/PUT /hr/settings`:** `{ weeklyHours: number, reserveHours: number }` dengan `0 ≤ reserveHours ≤ weeklyHours ≤ 168`. Standar organisasi; anggota boleh punya `workHoursOverride` dan `reserveHoursOverride`. Kapasitas yang bisa direncanakan = jam kerja − cadangan.
- **`GET/PUT /hr/performance-config`:** `{ automaticWeight: 0..100, criteria: { id, name, weight, active }[] }`. Minimal satu kriteria aktif, ada bobot > 0, nama tidak kosong.

### Antrean pengajuan (`/hr/inbox`, `/pengajuan-hr`)
`HrRequest = { id, sender, senderRole, title, description, createdAt, handled?, read }`.
- **`POST /hr/requests`:** `{ title, description }` dari manajer atau anggota mana pun. Pengirim diambil dari sesi.
- **`GET /hr/requests`:** antrean HR, terbaru dahulu; `?status=belum|selesai`.
- **`POST /hr/requests/:id/read`** dan **`POST /hr/requests/:id/handle`** (menandai ditangani sekaligus dibaca).
- Notifikasi HR: satu per pengajuan belum dibaca, tautan `/hr/inbox`.
- **Permintaan perubahan freelancer.** Ada dua jalur di frontend, backend cukup memilih satu:
  - Mode api sekarang: freelancer memanggil `POST /saya/tasks/:id/respond` `{ accept: false, reason }` (§2). Tidak perlu endpoint tambahan.
  - Mode mock (model yang diinginkan HR): `POST /saya/tasks/:id/change-request` `{ reason }` (minimal 10 karakter, hanya `freelancer`). Mengisi `Task.changeRequest = { memberId, reason, status: "pending" | "reviewed" }` dan membuat `HrRequest` berjudul "Permintaan perubahan: <judul tugas>". Tugas tetap ditugaskan. Manajer melihat banner di detail tugas dan menekan "Tandai sudah ditinjau": `POST /tasks/:id/change-request/review` (status jadi `reviewed`).

### Cuti (CF10)
- **`GET /hr/leave-requests?status=menunggu`:** antrean pengajuan cuti seluruh organisasi.
- **`POST /hr/leave-requests/:reqId/decision`** `{ approve }`. Mengisi `hr` pada pengajuan, aturan gabungan sama seperti §1. Frontend: antrean cuti tampil di `/hr/inbox`.
- **`PUT /members/:id/availability`** (khusus HR): `{ periodId, availableHours, weeklyLimit, leaveDates }`.

### Riwayat dan performa (`/hr/riwayat`, `/penilaian`)
Filter bulan, divisi, anggota, dan status dikirim lewat query URL (`?q=&division=&status=&month=YYYY-MM`) dan dihitung di frontend (`frontend/src/lib/hr/`). Backend cukup menyediakan data mentah:
- `Task.qualityScore` (0 sampai 100, opsional) dan `Task.completedAt`: `qualityScore` dikirim manajer saat menandai tugas selesai, tambahkan ke body `PATCH /tasks/:id/status` yang sudah ada (`{ status, actualHours?, qualityScore? }`); `completedAt` diisi server. Input kualitas di frontend baru tampil di mode mock.
- `PerformanceReview = { id, memberId, period: "YYYY-MM", note, author, automaticWeight, automaticScore, onTimeScore, qualityScore, criteria: { id, name, weight, score }[] }`.
- **`GET /hr/performance-reviews?period=&memberId=`** (HR; manajer hanya anggotanya).
- **`POST /manager/performance-reviews`** (manajer): validasi setiap nilai kriteria 0 sampai 100, satu penilaian per anggota per periode (`409` bila sudah ada). Server menyimpan salinan bobot dan skor otomatis saat itu.
- Skor otomatis = rata-rata (tepat waktu, kualitas) tugas selesai bulan itu; kosong bila tanggal selesai atau kualitas ada yang hilang. Rumus acuan: `frontend/src/lib/hr/performance.ts`.
- Aturan data: skor performa tidak boleh dipakai sebagai input rekomendasi (07-RULES §4).

## 5. Ditunda (bukan cakupan ini)

- **Batas akses manajer per tim (CF8).** Menunggu struktur divisi/tim dari backend (§4); frontend belum membatasi data manajer per tim.
- **Pemakaian riwayat performa dalam rekomendasi.** Menunggu keputusan terbuka nomor 1 di CORPORATE-FIRST.
- **Freelancer:** perhitungan kapasitas berdasarkan kontrak/ketersediaan belum ditetapkan (keputusan terbuka nomor 3). Sementara memakai jam per minggu seperti karyawan.

## 6. Peta fitur ke endpoint (acuan cepat)

Penanda `AWAITING_BACKEND` (nonaktif di mode api) ada di berkas berikut; hapus setelah endpoint tersedia.

| Fitur di UI | Endpoint | Berkas frontend |
| --- | --- | --- |
| Minta tambahan waktu / keputusan manajer | §2 `extra-time`, §3 `extra-time/decision` | `components/saya/member-area.tsx`, `components/tugas/task-detail.tsx` |
| Ajukan cuti; setujui cuti manajer / HR | §2 `leave-requests`, §3 dan §4 `decision` | `app/(app)/saya/cuti`, `components/kapasitas/capacity.tsx`, `app/(app)/hr/inbox/page.tsx` |
| Impor tugas CSV, jam tenggat, catatan hasil | §3 `tasks/import`, `dueTime`, `result-note` | `components/tugas/task-list.tsx`, `task-form.tsx`, `task-detail.tsx` |
| Kapasitas cadangan (slider 0 sampai 30%) | §3 `reserveRatio` | `components/kapasitas/capacity.tsx` |
| Jenis hubungan kerja saat tambah anggota | §3 `POST /members` | `components/tim/team.tsx` |
| Anggota, tim, divisi, impor CSV anggota (HR) | §4 | `app/(app)/hr/anggota`, `hr/tim`, `components/hr/` |
| Pengaturan HR dan kriteria performa | §4 `hr/settings`, `hr/performance-config` | `app/(app)/hr/pengaturan` |
| Inbox dan pengajuan ke HR | §4 `hr/requests` | `app/(app)/hr/inbox`, `app/(app)/pengajuan-hr` |
| Riwayat, performa, penilaian manajer | §4 `performance-reviews` | `app/(app)/hr/riwayat`, `app/(app)/penilaian` |

Urutan pengerjaan yang disarankan: §1 model data, §2 anggota, §3 manajer, lalu §4 HR (butuh peran `hr` dan RBAC lebih dulu).
