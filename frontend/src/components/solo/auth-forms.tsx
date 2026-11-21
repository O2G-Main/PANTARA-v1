"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Icon } from "@/components/ui";
import { api, ApiError, DATA_MODE, type InvitationPreview } from "@/lib/api";
import { acceptInviteWithApi, registerWithApi } from "@/lib/session";

const EMAIL = /^\S+@\S+\.\S+$/;

function Done({ title, text }: { title: string; text: string }) {
  return (
    <>
      <div className="decision-banner" role="status">
        <Icon icon={CircleCheck} />
        <span>
          <strong>{title}</strong>
          <span>{text}</span>
        </span>
      </div>
      <Link className="button primary" href="/masuk" transitionTypes={["to-login"]}>
        Ke halaman masuk
      </Link>
    </>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [f, setF] = useState({ org: "", name: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <Done title="Ruang kerja dibuat" text={`${f.org} siap. Langkah berikutnya: isi periode dan data karyawan.`} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (f.org.trim().length < 3) return setError("Tulis nama organisasi.");
    if (f.name.trim().length < 3) return setError("Tulis nama lengkap admin.");
    if (!EMAIL.test(f.email.trim())) return setError("Email belum valid.");
    if (f.password.length < 8) return setError("Sandi minimal 8 karakter.");
    if (!agree) return setError("Setujui syarat layanan dan kebijakan privasi.");

    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await registerWithApi({
          orgName: f.org,
          name: f.name,
          email: f.email,
          password: f.password,
        });
        router.push("/mulai");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal membuat ruang kerja.");
        setBusy(false);
      }
      return;
    }
    setDone(true);
  };

  return (
    <form noValidate onSubmit={submit}>
      <div>
        <h1>Buat ruang kerja</h1>
        <p>Satu ruang kerja untuk satu organisasi. Kamu jadi admin pertama.</p>
      </div>
      <div className="form-grid spaced">
        <label className="field full">
          <span className="field-label">Nama organisasi</span>
          <input className="input" value={f.org} onChange={(e) => { setF({ ...f, org: e.target.value }); setError(""); }} placeholder="CV Sinar Digital Jember" />
        </label>
        <label className="field full">
          <span className="field-label">Nama lengkap</span>
          <input className="input" autoComplete="name" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setError(""); }} />
        </label>
        <label className="field full">
          <span className="field-label">Email kerja</span>
          <input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => { setF({ ...f, email: e.target.value }); setError(""); }} />
        </label>
        <label className="field full">
          <span className="field-label">Sandi</span>
          <input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => { setF({ ...f, password: e.target.value }); setError(""); }} />
        </label>
        <label className="field full with-icon">
          <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(""); }} />
          <span className="small">
            Saya setuju dengan <Link className="inline-link" href="/syarat">syarat layanan</Link> dan <Link className="inline-link" href="/privasi">kebijakan privasi</Link>
          </span>
        </label>
      </div>
      {error && <p className="field-error spaced" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? <><Icon icon={LoaderCircle} size={16} className="spin" />Membuat ruang kerja...</> : "Buat ruang kerja"}
        </button>
      </div>
      <p className="small spaced">
        Sudah punya akun? <Link className="inline-link" href="/masuk" transitionTypes={["to-login"]}>Masuk</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <Done title="Tautan dikirim" text={`Jika ${email} terdaftar, tautan buat sandi baru berlaku 30 menit.`} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL.test(email.trim())) return setError("Email belum valid.");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.auth.forgotPassword(email.trim().toLowerCase());
      } catch (err) {
        setBusy(false);
        return setError(err instanceof ApiError ? err.message : "Gagal mengirim permintaan reset sandi.");
      }
      setBusy(false);
    }
    setDone(true);
  };

  return (
    <form noValidate onSubmit={submit}>
      <div>
        <h1>Lupa sandi</h1>
        <p>Masukkan email akunmu. Kami kirim tautan untuk membuat sandi baru.</p>
      </div>
      <label className="field spaced">
        <span className="field-label">Email</span>
        <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
      </label>
      {error && <p className="field-error spaced" role="alert">{error}</p>}
      <div className="form-actions">
        <Link className="button secondary" href="/masuk" transitionTypes={["to-login"]}>Batal</Link>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? <><Icon icon={LoaderCircle} size={16} className="spin" />Mengirim...</> : "Kirim tautan"}
        </button>
      </div>
    </form>
  );
}

export function ResetForm() {
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const q = new URLSearchParams(window.location.search).get("token");
      if (q) setToken(q);
    });
  }, []);

  if (done) return <Done title="Sandi baru tersimpan" text="Masuk dengan sandi barumu." />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (DATA_MODE === "api" && !token.trim()) return setError("Kode token reset sandi wajib diisi.");
    if (pw.length < 8) return setError("Sandi minimal 8 karakter.");
    if (pw !== again) return setError("Konfirmasi sandi tidak sama.");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.auth.resetPassword({ token: token.trim(), password: pw });
      } catch (err) {
        setBusy(false);
        return setError(err instanceof ApiError ? err.message : "Gagal menyimpan sandi baru.");
      }
      setBusy(false);
    }
    setDone(true);
  };

  return (
    <form noValidate onSubmit={submit}>
      <div>
        <h1>Buat sandi baru</h1>
        <p>Tautan ini berlaku 30 menit sejak dikirim.</p>
      </div>
      {DATA_MODE === "api" && !token && (
        <label className="field spaced">
          <span className="field-label">Token reset sandi</span>
          <input className="input mono" value={token} onChange={(e) => { setToken(e.target.value); setError(""); }} placeholder="Tempel token dari tautan email" />
        </label>
      )}
      <label className="field spaced">
        <span className="field-label">Sandi baru</span>
        <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} />
      </label>
      <label className="field spaced">
        <span className="field-label">Ulangi sandi baru</span>
        <input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setError(""); }} />
      </label>
      {error && <p className="field-error spaced" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? <><Icon icon={LoaderCircle} size={16} className="spin" />Menyimpan...</> : "Simpan sandi"}
        </button>
      </div>
    </form>
  );
}

export function InviteForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (DATA_MODE !== "api") return;
    let active = true;
    api.auth
      .inspectInvite(token)
      .then((res) => {
        if (!active) return;
        setPreview(res);
        if (res.name) setName((prev) => prev || res.name);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Undangan tidak valid atau kedaluwarsa.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (done) return <Done title={`Selamat bergabung, ${name.split(" ")[0]}`} text="Isi kompetensi dan ketersediaanmu supaya ikut rekomendasi." />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 3) return setError("Tulis nama lengkap.");
    if (pw.length < 8) return setError("Sandi minimal 8 karakter.");

    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const acc = await acceptInviteWithApi({ token, name, password: pw });
        router.push(acc.home);
      } catch (err) {
        setBusy(false);
        setError(err instanceof ApiError ? err.message : "Gagal menerima undangan.");
      }
      return;
    }
    setDone(true);
  };

  const roleLabel = preview?.accessRole === "manajer" ? "manajer" : preview?.accessRole === "admin" ? "admin" : preview?.accessRole === "hr" ? "HR" : "anggota";

  return (
    <form noValidate onSubmit={submit}>
      <div>
        <h1>Terima undangan</h1>
        <p>
          {preview
            ? `${preview.invitedByName} mengundangmu ke ruang kerja ${preview.organizationName} sebagai ${roleLabel} (${preview.roleTitle}).`
            : "Krisna Panca mengundangmu ke ruang kerja timnya sebagai anggota."}
        </p>
      </div>
      <p className="small muted mono spaced">
        {preview ? `Email terdaftar: ${preview.email}` : `Kode undangan ${token}`}
      </p>
      <label className="field spaced">
        <span className="field-label">Nama lengkap</span>
        <input className="input" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
      </label>
      <label className="field spaced">
        <span className="field-label">Buat sandi</span>
        <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} />
      </label>
      {error && <p className="field-error spaced" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? <><Icon icon={LoaderCircle} size={16} className="spin" />Memproses...</> : "Gabung ke ruang kerja"}
        </button>
      </div>
    </form>
  );
}
