"use client";

import { Paged } from "@/components/ui/pager";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarPlus, CircleAlert, CircleCheck, MailCheck, ReceiptText, RotateCcw, UserPlus } from "lucide-react";
import { EmptyState, MetricCard, PageHeading, SectionTitle } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { api, ApiError, DATA_MODE, type BillingSummary, type PendingInvitation } from "@/lib/api";
import { WORKSPACE } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import type { Member, PresetId } from "@/lib/demo/types";
import { DEFAULT_SETTINGS, PRESETS, SOURCE_CONFIDENCE, type EngineSettings } from "@/lib/engine/score";
import { number } from "@/lib/format";

function Saved({ show, text }: { show: boolean; text: string }) {
  return show ? (
    <div className="decision-banner" role="status">
      <Icon icon={CircleCheck} />
      <span>
        <strong>Tersimpan</strong>
        <span>{text}</span>
      </span>
    </div>
  ) : null;
}

export function GeneralSettings() {
  const { organization, periods, today, reload } = useDemo();
  const [nameDraft, setName] = useState<string | null>(null);
  const [timezoneDraft, setTimezone] = useState<string | null>(null);
  const [periodTypeDraft, setPeriodType] = useState<"mingguan" | "dua-mingguan" | null>(null);
  const [hoursDraft, setHours] = useState<string | null>(null);
  const [daysDraft, setDaysDraft] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [pLabel, setPLabel] = useState("");
  const [pStart, setPStart] = useState(today);
  const [pEnd, setPEnd] = useState(today);
  const [pErr, setPErr] = useState("");

  const name = nameDraft ?? organization?.name ?? WORKSPACE.name;
  const timezone = timezoneDraft ?? organization?.timezone ?? "Asia/Jakarta";
  const periodType = periodTypeDraft ?? organization?.periodType ?? "mingguan";
  const hoursPerWeek = hoursDraft ?? String(organization?.hoursPerWeek ?? WORKSPACE.hoursPerWeek);
  const days = daysDraft ?? (organization?.workDays?.length ? organization.workDays : ["Sen", "Sel", "Rab", "Kam", "Jum"]);
  const setDays = (updater: (prev: string[]) => string[]) => setDaysDraft((prev) => updater(prev ?? days));

  const submitOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    const hrs = Number(hoursPerWeek);
    if (name.trim().length < 2) return setError("Nama ruang kerja wajib diisi.");
    if (!Number.isFinite(hrs) || hrs < 8 || hrs > 60) return setError("Jam proyek default harus antara 8 dan 60.");
    if (!days.length) return setError("Pilih minimal satu hari kerja.");

    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.workspace.updateOrg({
          name: name.trim(),
          timezone,
          periodType,
          hoursPerWeek: hrs,
          workDays: days,
          holidays: organization?.holidays ?? [],
        });
        await reload();
        setSaved(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan ruang kerja.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setSaved(true);
  };

  const createPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!pLabel.trim() || !pStart || !pEnd || pEnd < pStart) {
      setPErr("Isi label periode dan pastikan tanggal selesai >= tanggal mulai.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.workspace.createPeriod({ label: pLabel.trim(), start: pStart, end: pEnd, activate: true });
        await reload();
        setNewPeriodOpen(false);
        setPLabel("");
      } catch (err) {
        setPErr(err instanceof ApiError ? err.message : "Gagal membuat periode baru.");
      } finally {
        setBusy(false);
      }
    }
  };

  const activatePeriod = async (id: string) => {
    if (busy || DATA_MODE !== "api") return;
    setBusy(true);
    try {
      await api.workspace.activatePeriod(id);
      await reload(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan periode.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeading title="Pengaturan" subtitle={`Ruang kerja ${name}`} />
      <form className="card form-card" noValidate onSubmit={(e) => void submitOrg(e)}>
        <Saved show={saved} text="Periode dan jam kerja default dipakai untuk karyawan baru." />
        {error && <p className="field-error spaced" role="alert">{error}</p>}
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Nama ruang kerja</span>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
          </label>
          <label className="field">
            <span className="field-label">Zona waktu</span>
            <select className="select" value={timezone} onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}>
              <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
              <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
              <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
            </select>
          </label>
          <fieldset className="field">
            <legend className="field-label">Periode kapasitas</legend>
            <div className="radio-pills">
              {(
                [
                  ["mingguan", "Mingguan"],
                  ["dua-mingguan", "2 mingguan"],
                ] as const
              ).map(([val, lbl]) => (
                <label key={val}>
                  <input type="radio" name="period" checked={periodType === val} onChange={() => { setPeriodType(val); setSaved(false); }} />
                  {lbl}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field-label">Jam proyek default per minggu</span>
            <input className="input" type="number" min={8} max={60} value={hoursPerWeek} onChange={(e) => { setHours(e.target.value); setSaved(false); }} />
          </label>
          <fieldset className="field full">
            <legend className="field-label">Hari kerja</legend>
            <div className="radio-pills">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={days.includes(d)}
                    onChange={() => {
                      setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
                      setSaved(false);
                    }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="form-actions">
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan pengaturan"}
          </button>
        </div>
      </form>

      {DATA_MODE === "api" && (
        <section className="card spaced">
          <SectionTitle
            title="Periode kerja"
            subtitle="Aktifkan periode berjalan atau buat periode berikutnya."
            action={
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setPErr("");
                  setNewPeriodOpen(true);
                }}
              >
                <Icon icon={CalendarPlus} size={16} />
                Buat periode baru
              </button>
            }
          />
          {periods.length ? (
            <div className="table-scroll stack-table">
              <table>
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Rentang</th>
                    <th>Status</th>
                    <th className="numeric">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.label}</strong>
                        <span className="table-sub mono">{p.code}</span>
                      </td>
                      <td data-label="Rentang">
                        {p.start} - {p.end}
                      </td>
                      <td data-label="Status">{p.isActive ? <Badge tone="ok">Aktif</Badge> : <Badge>Arsip / Siap</Badge>}</td>
                      <td className="numeric">
                        {!p.isActive && (
                          <button type="button" className="row-link" disabled={busy} onClick={() => void activatePeriod(p.id)}>
                            Aktifkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">Belum ada data periode.</p>
          )}
        </section>
      )}

      {newPeriodOpen && (
        <Modal title="Buat periode baru" onClose={() => setNewPeriodOpen(false)}>
          <form noValidate onSubmit={(e) => void createPeriod(e)}>
            <div className="form-grid">
              <label className="field full">
                <span className="field-label">Label periode</span>
                <input className="input" value={pLabel} onChange={(e) => { setPLabel(e.target.value); setPErr(""); }} placeholder="12 - 16 Okt 2026" />
              </label>
              <label className="field">
                <span className="field-label">Tanggal mulai</span>
                <DatePicker value={pStart} onChange={(v) => { setPStart(v); setPErr(""); }} />
              </label>
              <label className="field">
                <span className="field-label">Tanggal selesai</span>
                <DatePicker value={pEnd} onChange={(v) => { setPEnd(v); setPErr(""); }} />
              </label>
            </div>
            {pErr && <p className="field-error spaced" role="alert">{pErr}</p>}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setNewPeriodOpen(false)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Membuat..." : "Buat & aktifkan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function RecommendationSettings() {
  const { settings, dispatch } = useDemo();
  const [draftOverride, setDraftOverride] = useState<EngineSettings | null>(null);
  const draft = draftOverride ?? settings;
  const setDraft = (next: EngineSettings | ((prev: EngineSettings) => EngineSettings)) => {
    setDraftOverride((prev) => {
      const base = prev ?? settings;
      return typeof next === "function" ? next(base) : next;
    });
  };
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const w = PRESETS[draft.preset].weights;

  const handleSave = async () => {
    if (busy) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.workspace.updateSettings(draft);
        dispatch({ type: "settings", settings: res.settings });
        setSaved(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan aturan rekomendasi.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "settings", settings: draft });
    setSaved(true);
  };

  return (
    <div className="page-enter">
      <PageHeading title="Aturan rekomendasi" subtitle="Preset bobot dan syarat wajib kandidat. Bobot bukan angka universal: dikalibrasi dari data override di pilot." />
      <Saved show={saved} text="Rekomendasi berikutnya memakai aturan ini." />
      {error && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Gagal</strong>
            <span>{error}</span>
          </span>
        </div>
      )}
      <div className="split-detail">
        <section className="card">
          <SectionTitle title="Preset bobot default" subtitle="S = w1·K + w2·C + w3·A + w4·R − w5·F" />
          <div className="table-scroll stack-table preset-table">
            <table>
              <thead>
                <tr>
                  <th>Preset</th>
                  <th>Kapan dipakai</th>
                  <th className="numeric">K</th>
                  <th className="numeric">C</th>
                  <th className="numeric">A</th>
                  <th className="numeric">R</th>
                  <th className="numeric">F</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(PRESETS) as PresetId[]).map((p) => (
                  <tr key={p} className={draft.preset === p ? "row-highlight" : ""}>
                    <td>
                      <label className="with-icon">
                        <input
                          type="radio"
                          name="preset"
                          checked={draft.preset === p}
                          onChange={() => {
                            setDraft((d) => ({ ...d, preset: p }));
                            setSaved(false);
                          }}
                        />
                        <strong>{PRESETS[p].label}</strong>
                      </label>
                    </td>
                    <td data-label="Kapan">
                      {PRESETS[p].when}
                      {PRESETS[p].spreadBonus ? " · bonus 0,20 untuk karyawan tanpa riwayat sejenis" : ""}
                    </td>
                    {(["k", "c", "a", "r", "f"] as const).map((k) => (
                      <td key={k} data-label={k.toUpperCase()} className="numeric">
                        {number(PRESETS[p].weights[k], 2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted spaced">
            K kompetensi (dirata-rata berbobot keyakinan kebutuhan dari Analisis kebutuhan; level dikali keyakinan sumbernya: terverifikasi {number(SOURCE_CONFIDENCE.verifikasi, 1)}, riwayat{" "}
            {number(SOURCE_CONFIDENCE.riwayat, 1)}, klaim {number(SOURCE_CONFIDENCE.klaim, 1)}) · C skor beban, turun tajam mendekati 100% · A jam kosong sampai tenggat · R riwayat relevan (70%) & preferensi (30%) · F risiko tenggat berdekatan. Tugas kompleks di preset Seimbang memberi bobot lebih ke K. Preset terpilih: K{" "}
            {number(w.k, 2)}, C {number(w.c, 2)}, A {number(w.a, 2)}, R {number(w.r, 2)}, F {number(w.f, 2)}.
          </p>
        </section>
        <section className="card">
          <SectionTitle title="Syarat wajib & ambang" />
          <label className="field">
            <span className="field-label">Toleransi level kompetensi</span>
            <select
              className="select"
              value={draft.levelTolerance}
              onChange={(e) => {
                setDraft((d) => ({ ...d, levelTolerance: Number(e.target.value) }));
                setSaved(false);
              }}
            >
              <option value={0}>Harus sama dengan level dibutuhkan</option>
              <option value={1}>Boleh 1 level di bawah</option>
              <option value={2}>Boleh 2 level di bawah</option>
            </select>
            <span className="field-hint">Karyawan di bawah batas ini tidak ikut diperingkat.</span>
          </label>
          <label className="field spaced">
            <span className="field-label">Ambang risiko beban: {Math.round(draft.overloadAt * 100)}%</span>
            <input
              type="range"
              min={70}
              max={100}
              step={5}
              value={draft.overloadAt * 100}
              onChange={(e) => {
                setDraft((d) => ({ ...d, overloadAt: Number(e.target.value) / 100 }));
                setSaved(false);
              }}
              aria-label="Ambang risiko beban"
            />
            <span className="field-hint">Utilisasi sesudah penugasan di atas ini menambah faktor risiko F.</span>
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDraft(DEFAULT_SETTINGS);
                setSaved(false);
              }}
            >
              <Icon icon={RotateCcw} size={16} />
              Kembalikan default
            </button>
            <button type="button" className="button primary" disabled={busy} onClick={() => void handleSave()}>
              {busy ? "Menyimpan..." : "Simpan aturan"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const ACCESS: Record<Member["access"], string> = { admin: "Admin", manajer: "Manajer", anggota: "Karyawan" };

export function MemberSettings() {
  const { members, reload } = useDemo();
  const [allMembers, setAllMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("Pengembang perangkat lunak");
  const [accessRole, setAccessRole] = useState<Member["access"]>("anggota");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDirectory = async () => {
    if (DATA_MODE !== "api") return;
    try {
      const res = await api.members.list(true);
      setAllMembers(res.members ?? []);
      setInvitations(res.invitations ?? []);
    } catch {
      setAllMembers(null);
    }
  };

  useEffect(() => {
    if (DATA_MODE !== "api") return;
    let active = true;
    api.members
      .list(true)
      .then((res) => {
        if (!active) return;
        setAllMembers(res.members ?? []);
        setInvitations(res.invitations ?? []);
      })
      .catch(() => {
        if (active) setAllMembers(null);
      });
    return () => {
      active = false;
    };
  }, [members.length]);

  const rows = allMembers ?? members;

  const updateAccess = async (m: Member, access: Member["access"]) => {
    if (busy || DATA_MODE !== "api") return;
    setBusy(true);
    setError("");
    try {
      await api.members.setAccess(m.id, { access });
      await Promise.all([loadDirectory(), reload()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah peran akses.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (m: Member) => {
    if (busy || DATA_MODE !== "api") return;
    setBusy(true);
    setError("");
    try {
      await api.members.setAccess(m.id, { isActive: m.isActive === false });
      await Promise.all([loadDirectory(), reload()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah status keaktifan anggota.");
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async (memberId: string) => {
    if (busy || DATA_MODE !== "api") return;
    setBusy(true);
    try {
      const res = await api.members.resendInvite(memberId);
      setNotice(res.inviteToken ? `Undangan dikirim ulang. Tautan lokal: /undangan/${res.inviteToken}` : "Undangan dikirim ulang.");
      await loadDirectory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengirim ulang undangan.");
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError("Tulis nama lengkap.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Email belum valid.");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.members.create({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: roleTitle,
          access: accessRole,
        });
        setNotice(
          res.inviteToken
            ? `Undangan untuk ${res.member.email} dibuat. Tautan lokal: /undangan/${res.inviteToken}`
            : `Undangan dikirim ke ${res.member.email}.`,
        );
        setName("");
        setEmail("");
        setInviting(false);
        await Promise.all([loadDirectory(), reload()]);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengundang karyawan.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setInviting(false);
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Karyawan & peran"
        subtitle="Atur siapa yang bisa menugaskan dan siapa yang hanya menerima penugasan."
        actions={
          <button
            className="button primary"
            onClick={() => {
              setError("");
              setInviting(true);
            }}
          >
            <Icon icon={UserPlus} />
            Undang karyawan
          </button>
        }
      />
      {notice && (
        <div className="decision-banner" role="status">
          <Icon icon={CircleCheck} />
          <span>
            <strong>Undangan diperbarui</strong>
            <span>{notice}</span>
          </span>
        </div>
      )}
      {error && !inviting && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Gagal</strong>
            <span>{error}</span>
          </span>
        </div>
      )}
      <section className="card">
        <Paged items={rows} unit="karyawan">
          {(paged) => (
            <div className="table-scroll stack-table">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Peran akses</th>
                    <th>Status</th>
                    <th className="numeric">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m) => {
                    const inv = invitations.find((x) => x.memberId === m.id);
                    const inactive = m.isActive === false;
                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.name}</strong>
                          <span className="table-sub">{m.role}</span>
                        </td>
                        <td data-label="Email">{m.email}</td>
                        <td data-label="Peran">
                          <div className="level-select" role="group" aria-label={`Peran akses ${m.name}`}>
                            {(Object.keys(ACCESS) as Member["access"][]).map((a) => (
                              <button key={a} type="button" disabled={busy} className={m.access === a ? "selected" : ""} aria-pressed={m.access === a} onClick={() => void updateAccess(m, a)}>
                                {ACCESS[a]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td data-label="Status">
                          {inactive ? (
                            <Badge tone="crit">Nonaktif</Badge>
                          ) : inv ? (
                            <Badge tone="warn">Undangan belum selesai</Badge>
                          ) : m.availableHours === null ? (
                            <Badge tone="warn">Belum isi ketersediaan</Badge>
                          ) : (
                            <Badge tone="ok">Aktif</Badge>
                          )}
                        </td>
                        <td className="numeric">
                          <div className="page-actions" style={{ justifyContent: "flex-end" }}>
                            {inv && (
                              <button type="button" className="row-link" disabled={busy} onClick={() => void resendInvite(m.id)}>
                                <Icon icon={MailCheck} size={14} />
                                Kirim ulang
                              </button>
                            )}
                            {DATA_MODE === "api" && (
                              <button type="button" className="row-link" disabled={busy} onClick={() => void toggleActive(m)}>
                                {inactive ? "Aktifkan" : "Nonaktifkan"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
      </section>
      {inviting && (
        <Modal title="Undang karyawan" onClose={() => setInviting(false)}>
          <form noValidate onSubmit={(e) => void sendInvite(e)}>
            <p className="dialog-summary">Undangan dikirim ke email tersebut dan berlaku 7 hari.</p>
            <div className="form-grid">
              <label className="field full">
                <span className="field-label">Nama lengkap</span>
                <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Wulan Sari" />
              </label>
              <label className="field full">
                <span className="field-label">Email</span>
                <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="wulan@pantara.id" />
              </label>
              <label className="field">
                <span className="field-label">Peran kerja</span>
                <select className="select" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)}>
                  <option>Pengembang perangkat lunak</option>
                  <option>Desainer produk</option>
                  <option>Penguji perangkat lunak / QA</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Hak akses</span>
                <select className="select" value={accessRole} onChange={(e) => setAccessRole(e.target.value as Member["access"])}>
                  <option value="anggota">Karyawan</option>
                  <option value="manajer">Manajer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            {error && <p className="field-error spaced" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setInviting(false)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Mengirim..." : "Kirim undangan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/** P32: paket dan kursi ruang kerja. */
export function Billing() {
  const { members } = useDemo();
  const [billing, setBilling] = useState<BillingSummary | null>(null);

  useEffect(() => {
    if (DATA_MODE !== "api") return;
    let active = true;
    api.workspace
      .getBilling()
      .then((res) => {
        if (active) setBilling(res.billing);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [members.length]);

  const seats = billing?.activeSeats ?? members.length + 1;
  const plan = billing?.plan ?? "Pilot";
  const statusLabel = billing?.statusLabel ?? "Belum aktif";

  return (
    <div className="page-enter">
      <PageHeading title="Tagihan" subtitle="Paket, jumlah kursi, dan riwayat invoice ruang kerja." />
      <div className="metrics-grid three">
        <MetricCard
          icon={UserPlus}
          label="Kursi terpakai"
          value={String(seats)}
          unit="pengguna"
          note={billing ? `${billing.activeSeats} aktif (${billing.pendingInvites} undangan menunggu)` : `Admin + ${members.length} karyawan`}
        />
        <MetricCard icon={ReceiptText} label="Paket" value={plan} note={billing ? `Batas paket ${billing.includedSeats} kursi` : "Pilihan paket menyusul rancangan bisnis"} />
        <MetricCard icon={CircleCheck} label="Status langganan" value={statusLabel} note="Belum ada tagihan berjalan" />
      </div>
      <section className="card">
        <SectionTitle title="Riwayat invoice" />
        <EmptyState
          icon={ReceiptText}
          title="Belum ada invoice"
          text="Invoice muncul di sini setelah paket dipilih. Harga dan cara bayar sedang dirancang tim."
          action={
            <Link className="button secondary" href="/harga">
              Lihat halaman harga
            </Link>
          }
        />
      </section>
    </div>
  );
}
