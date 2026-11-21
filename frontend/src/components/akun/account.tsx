"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, BellOff, CircleCheck, Lock, LogOut, ShieldAlert } from "lucide-react";
import { EmptyState, PageHeading, SectionTitle } from "@/components/app/parts";
import { Icon } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { noticesFor } from "@/lib/demo/notifications";
import { useDemo } from "@/lib/demo/store";
import { clearSession, setSessionUser, useSession } from "@/lib/session";

export function Account() {
  const router = useRouter();
  const account = useSession();
  const [nameDraft, setName] = useState<string | null>(null);
  const [emailDraft, setEmail] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [profileErr, setProfileErr] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prefsDraft, setPrefs] = useState<{ assigned: boolean; rejected: boolean; reminder: boolean } | null>(null);
  const [prefsMsg, setPrefsMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const name = nameDraft ?? account?.name ?? "";
  const email = emailDraft ?? account?.email ?? "";
  const prefs = prefsDraft ?? account?.notifyPrefs ?? { assigned: true, rejected: true, reminder: false };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setProfileErr("");
    if (name.trim().length < 2) return setProfileErr("Nama wajib diisi.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setProfileErr("Email belum valid.");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.auth.updateProfile({ name: name.trim(), email: email.trim().toLowerCase() });
        setSessionUser(res.user);
        setSaved(true);
      } catch (err) {
        setProfileErr(err instanceof ApiError ? err.message : "Gagal menyimpan profil.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setSaved(true);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!pw.current) return setPwMsg({ ok: false, text: "Isi sandi saat ini." });
    if (pw.next.length < 8) return setPwMsg({ ok: false, text: "Sandi baru minimal 8 karakter." });
    if (pw.next !== pw.again) return setPwMsg({ ok: false, text: "Konfirmasi sandi tidak sama." });
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.auth.changePassword({ currentPassword: pw.current, newPassword: pw.next });
        setPwMsg({ ok: true, text: "Sandi diganti. Semua sesi lama dicabut; pakai sandi baru saat masuk berikutnya." });
        setPw({ current: "", next: "", again: "" });
      } catch (err) {
        setPwMsg({ ok: false, text: err instanceof ApiError ? err.message : "Gagal mengganti sandi." });
      } finally {
        setBusy(false);
      }
      return;
    }
    setPwMsg({ ok: true, text: "Sandi diganti. Pakai sandi baru saat masuk berikutnya." });
    setPw({ current: "", next: "", again: "" });
  };

  const togglePref = async (k: keyof typeof prefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    setPrefsMsg("");
    if (DATA_MODE === "api") {
      try {
        const res = await api.auth.updateNotifyPrefs(next);
        setPrefs(res.notifyPrefs);
        setPrefsMsg("Preferensi notifikasi diperbarui.");
      } catch (err) {
        setPrefs(prefs);
        setPrefsMsg(err instanceof ApiError ? err.message : "Gagal menyimpan preferensi.");
      }
    }
  };

  const revokeAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (DATA_MODE === "api") await api.auth.logoutAll();
      clearSession();
      router.push("/masuk");
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Akun saya"
        subtitle="Profil, sandi, dan preferensi notifikasi."
        actions={
          <button type="button" className="button secondary" disabled={busy} onClick={() => void revokeAll()}>
            <Icon icon={LogOut} size={16} />
            Keluar semua perangkat
          </button>
        }
      />
      <div className="split-even">
        <form className="card" noValidate onSubmit={(e) => void saveProfile(e)}>
          <SectionTitle title="Profil" />
          {saved && (
            <div className="decision-banner" role="status">
              <Icon icon={CircleCheck} />
              <span>
                <strong>Profil tersimpan</strong>
              </span>
            </div>
          )}
          {profileErr && <p className="field-error spaced" role="alert">{profileErr}</p>}
          <div className="form-grid">
            <label className="field full">
              <span className="field-label">Nama</span>
              <input
                className="input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                  setProfileErr("");
                }}
              />
            </label>
            <label className="field full">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaved(false);
                  setProfileErr("");
                }}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan profil"}
            </button>
          </div>
        </form>
        <form className="card" noValidate onSubmit={(e) => void changePassword(e)}>
          <SectionTitle title="Ganti sandi" action={<Icon icon={Lock} />} />
          <div className="form-grid">
            <label className="field full">
              <span className="field-label">Sandi saat ini</span>
              <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Sandi baru</span>
              <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">Ulangi sandi baru</span>
              <input className="input" type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw((p) => ({ ...p, again: e.target.value }))} />
            </label>
          </div>
          {pwMsg && (
            <p className={`${pwMsg.ok ? "ok-text" : "field-error"} spaced`} role={pwMsg.ok ? "status" : "alert"}>
              {pwMsg.text}
            </p>
          )}
          <div className="form-actions">
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Ganti sandi"}
            </button>
          </div>
        </form>
      </div>
      <section className="card">
        <SectionTitle title="Notifikasi" />
        {(
          [
            ["assigned", "Penugasan dijawab karyawan", "Saat karyawan menerima penugasan atau meminta tambahan waktu."],
            ["rejected", "Penugasan ditolak", "Dengan alasan dari freelancer."],
            ["reminder", "Pengingat data belum lengkap", "Ringkasan tiap Senin pagi."],
          ] as const
        ).map(([k, t, d]) => (
          <label key={k} className="switch-row">
            <span>
              <strong>{t}</strong>
              <p>{d}</p>
            </span>
            <input type="checkbox" checked={prefs[k]} onChange={() => void togglePref(k)} />
          </label>
        ))}
        {prefsMsg && <p className="small muted spaced">{prefsMsg}</p>}
      </section>
    </div>
  );
}

export function Notifications() {
  const demo = useDemo();
  const account = useSession();
  const derived = account ? noticesFor(demo, account) : [];
  const notices = [
    ...demo.serverNotifications.map((n) => ({ id: n.id, title: n.title, subtitle: n.subtitle, href: n.href })),
    ...derived.filter((d) => !demo.serverNotifications.some((s) => s.id === d.id)),
  ];
  const unread = notices.filter((n) => !demo.readNotifications.includes(n.id));
  return (
    <div className="page-enter">
      <PageHeading
        title="Notifikasi"
        subtitle={`${unread.length} belum dibaca`}
        actions={
          <button
            className="button secondary"
            disabled={!unread.length}
            onClick={() => void demo.markAllNoticesRead(notices.map((n) => n.id))}
          >
            Tandai semua dibaca
          </button>
        }
      />
      <section className="card">
        {notices.length ? (
          <div className="notification-list">
            {notices.map((n) => (
              <Link key={n.id} href={n.href} onClick={() => void demo.markNoticeRead(n.id)}>
                <span>
                  <strong>
                    {n.title} {!demo.readNotifications.includes(n.id) && <span className="status-dot brand-text" aria-label="Belum dibaca" />}
                  </strong>
                  <span>{n.subtitle}</span>
                </span>
                <Icon icon={ArrowUpRight} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={BellOff} title="Tidak ada notifikasi" text="Penugasan baru, penolakan, dan pengingat akan muncul di sini." />
        )}
      </section>
    </div>
  );
}

export function Help() {
  return (
    <div className="page-enter">
      <PageHeading title="Bantuan" subtitle="Panduan singkat alur penugasan dan cara kandidat dihitung." />
      <div className="split-even">
        <section className="card">
          <SectionTitle title="Alur penugasan" />
          <ol className="steps-list">
            <li>
              <strong>Buat tugas</strong>
              <p>Tulis judul, deskripsi, tenggat, dan prioritas.</p>
            </li>
            <li>
              <strong>Tinjau Analisis kebutuhan</strong>
              <p>AI mengurai kompetensi, level, estimasi, dan dependensi. Isian ragu ditandai dan wajib dicek.</p>
            </li>
            <li>
              <strong>Bandingkan kandidat</strong>
              <p>Karyawan yang gagal syarat wajib dibuang; tiga teratas ditampilkan dengan skor dan alasan.</p>
            </li>
            <li>
              <strong>Simulasi lalu tetapkan</strong>
              <p>Lihat akibatnya ke beban karyawan. Memilih di luar tiga teratas boleh, dengan alasan.</p>
            </li>
            <li>
              <strong>Karyawan menjawab</strong>
              <p>Karyawan menerima atau meminta tambahan waktu dengan alasan; freelancer bisa meminta perubahan. Kapasitas langsung diperbarui.</p>
            </li>
          </ol>
        </section>
        <section className="card">
          <SectionTitle title="Cara skor dihitung" />
          <p className="mono">S = w1·K + w2·C + w3·A + w4·R − w5·F</p>
          <ul className="factor-list spaced">
            {[
              ["K", "Kesesuaian kompetensi", "Rata-rata level karyawan dibanding level dibutuhkan."],
              ["C", "Kapasitas setelah penugasan", "1 dikurangi beban sesudah tugas ini."],
              ["A", "Ketersediaan", "Jam tersisa dibanding estimasi sampai tenggat."],
              ["R", "Riwayat & preferensi", "Tugas sejenis yang pernah selesai (70%) dan preferensi karyawan (30%)."],
              ["F", "Risiko konflik", "Beban ≥ ambang dan tenggat lain yang berdekatan."],
            ].map(([k, t, d]) => (
              <li key={k}>
                <span className="factor-number">{k}</span>
                <div>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="small muted spaced with-icon">
            <Icon icon={ShieldAlert} size={13} />
            AI tidak pernah memilih penerima tugas. Keputusan akhir selalu di manajer.
          </p>
        </section>
      </div>
    </div>
  );
}
