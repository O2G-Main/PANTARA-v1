"use client";

import { Paged } from "@/components/ui/pager";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { BadgeCheck, BellRing, CalendarRange, CircleAlert, Heart, Pencil, ShieldCheck, ThumbsDown } from "lucide-react";
import { CapacityBar, DataBadge, EmptyState, PageHeading, SectionTitle, StatusBadge } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { PERIOD } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import type { Member } from "@/lib/demo/types";
import { allocatedHours, LEVEL_LABEL } from "@/lib/engine/score";
import { hours, shortDate } from "@/lib/format";

const SOURCE = { klaim: "Klaim karyawan", verifikasi: "Diverifikasi manajer", riwayat: "Dari riwayat tugas" } as const;

export function MemberProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const { memberById, tasks, names, period, loading, dispatch } = useDemo();
  const member = memberById(id);
  const [editingAvail, setEditingAvail] = useState(search.get("lengkapi") === "1");
  const [editingProfile, setEditingProfile] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading && !member) {
    return (
      <section className="card">
        <div className="answer-skeleton" aria-busy="true">
          <div />
          <div />
          <div />
        </div>
      </section>
    );
  }
  if (!member) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Karyawan tidak ditemukan"
        text="Karyawan ini tidak ada di ruang kerja."
        action={
          <Link className="button secondary" href="/tim">
            Kembali ke Tim
          </Link>
        }
      />
    );
  }

  const allocated = allocatedHours(member.id, tasks);
  const mine = tasks.filter((t) => t.assignments.some((a) => a.memberId === member.id));
  const active = mine.filter((t) => t.status === "berjalan" || t.status === "menunggu");
  const done = mine.filter((t) => t.status === "selesai");
  const periodLabel = period?.label ?? PERIOD.label;

  const verify = async (cid: string) => {
    if (busy) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.members.verifyCompetency(member.id, cid);
        dispatch({ type: "upsertMember", member: res.member });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memverifikasi kompetensi.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({
      type: "upsertMember",
      member: {
        ...member,
        competencies: member.competencies.map((c) => (c.id === cid ? { ...c, source: "verifikasi" } : c)),
      },
    });
  };

  const remind = async () => {
    if (busy || reminded) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.members.remind(member.id);
        setReminded(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengirim pengingat.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setReminded(true);
  };

  const saveAvailability = async (updated: Member) => {
    if (DATA_MODE === "api") {
      const res = await api.members.saveAvailability(member.id, {
        periodId: period?.id,
        availableHours: updated.availableHours,
        weeklyLimit: updated.weeklyLimit,
        leaveDates: updated.leaveDates,
      });
      dispatch({ type: "upsertMember", member: res.member });
      setEditingAvail(false);
      return;
    }
    dispatch({ type: "upsertMember", member: updated });
    setEditingAvail(false);
  };

  const saveProfile = async (name: string, role: string, email: string, weeklyLimit: number) => {
    if (DATA_MODE === "api") {
      const res = await api.members.update(member.id, { name, role, email, weeklyLimit });
      dispatch({ type: "upsertMember", member: res.member });
      setEditingProfile(false);
      return;
    }
    dispatch({ type: "upsertMember", member: { ...member, name, role, email, weeklyLimit } });
    setEditingProfile(false);
  };

  return (
    <div className="page-enter">
      <PageHeading
        title={member.name}
        subtitle={`${member.role} · ${member.email}`}
        actions={
          <>
            {member.availableHours === null && (
              <button className="button secondary" onClick={() => void remind()} disabled={reminded || busy}>
                <Icon icon={BellRing} size={16} />
                {reminded ? "Pengingat terkirim" : "Ingatkan lengkapi data"}
              </button>
            )}
            <button className="button secondary" onClick={() => setEditingProfile(true)}>
              <Icon icon={Pencil} size={16} />
              Ubah profil
            </button>
            <button className="button primary" onClick={() => setEditingAvail(true)}>
              <Icon icon={CalendarRange} size={16} />
              Ubah ketersediaan
            </button>
          </>
        }
      />
      {error && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Gagal</strong>
            <span>{error}</span>
          </span>
        </div>
      )}
      {member.availableHours === null && (
        <div className="decision-banner warn">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Ketersediaan periode ini belum diisi</strong>
            <span>{member.name.split(" ")[0]} belum ikut rekomendasi sampai data kapasitas lengkap.</span>
          </span>
        </div>
      )}
      <div className="split-detail">
        <div className="stack">
          <section className="card">
            <SectionTitle title="Kompetensi" subtitle="Level 1 Dasar, 2 Mandiri, 3 Mahir. Sumber ditampilkan supaya klaim bisa diverifikasi." />
            <Paged items={member.competencies} unit="kompetensi">
              {(paged) => (
                <div className="table-scroll stack-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Kompetensi</th>
                        <th>Level</th>
                        <th>Sumber</th>
                        <th className="numeric">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{names[c.id] ?? c.id}</strong>
                          </td>
                          <td data-label="Level">{LEVEL_LABEL[c.level]}</td>
                          <td data-label="Sumber">{c.source === "verifikasi" ? <Badge tone="ok">{SOURCE[c.source]}</Badge> : <Badge>{SOURCE[c.source]}</Badge>}</td>
                          <td className="numeric">
                            {c.source !== "verifikasi" && (
                              <button className="row-link" disabled={busy} onClick={() => void verify(c.id)}>
                                <Icon icon={BadgeCheck} size={14} />
                                Verifikasi
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Paged>
            {!member.competencies.length && <p className="small muted">Belum ada kompetensi. Karyawan mengisinya di Profil kerja saya.</p>}
          </section>
          <section className="card">
            <SectionTitle title="Tugas aktif" subtitle={`${active.length} tugas berjalan atau menunggu jawaban`} />
            {active.length ? (
              active.map((t) => (
                <div key={t.id} className="dna-row">
                  <div>
                    <h4>
                      <Link href={`/tugas/${t.id}`}>{t.title}</Link>
                    </h4>
                    <p>
                      Tenggat {shortDate(t.dueDate)} · {hours(t.assignments.find((a) => a.memberId === member.id)?.hours ?? 0)} di periode ini
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))
            ) : (
              <p className="small muted">Belum ada penugasan aktif.</p>
            )}
          </section>
          <section className="card">
            <SectionTitle title="Riwayat tugas relevan" subtitle="Dipakai untuk faktor R (riwayat & preferensi) di skor kandidat." />
            {done.length ? (
              done.map((t) => (
                <div key={t.id} className="dna-row">
                  <div>
                    <h4>{t.title}</h4>
                    <p>
                      {t.competencyIds.map((c) => names[c] ?? c).join(", ")} · selesai {shortDate(t.dueDate)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="small muted">Belum ada riwayat tugas.</p>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <SectionTitle title="Kapasitas periode" subtitle={periodLabel} action={<DataBadge complete={member.availableHours !== null} />} />
            <CapacityBar allocated={allocated} available={member.availableHours} />
            <div className="dna-row spaced">
              <span className="muted small">Jam tersedia</span>
              <strong>{member.availableHours === null ? "Belum diisi" : hours(member.availableHours)}</strong>
            </div>
            <div className="dna-row">
              <span className="muted small">Batas kerja mingguan</span>
              <strong>{hours(member.weeklyLimit)}</strong>
            </div>
            <div className="dna-row">
              <span className="muted small">Cuti</span>
              <strong>{member.leaveDates.length ? member.leaveDates.map(shortDate).join(", ") : "Tidak ada"}</strong>
            </div>
          </section>
          <section className="card">
            <SectionTitle title="Preferensi" />
            <p className="small muted with-icon">
              <Icon icon={Heart} size={13} />
              Disukai
            </p>
            <div className="chips">
              {member.prefers.length ? (
                member.prefers.map((p) => (
                  <span key={p} className="chip accent">
                    {names[p] ?? p}
                  </span>
                ))
              ) : (
                <span className="chip">Belum diisi</span>
              )}
            </div>
            <p className="small muted with-icon spaced">
              <Icon icon={ThumbsDown} size={13} />
              Dihindari
            </p>
            <div className="chips">
              {member.avoids.length ? (
                member.avoids.map((p) => (
                  <span key={p} className="chip">
                    {names[p] ?? p}
                  </span>
                ))
              ) : (
                <span className="chip">Tidak ada</span>
              )}
            </div>
          </section>
          <section className="card">
            <p className="small muted with-icon">
              <Icon icon={ShieldCheck} size={14} />
              Data jam kerja dipakai untuk membagi tugas, bukan menilai produktivitas. Karyawan bisa melihat data yang sama di Profil kerja saya.
            </p>
          </section>
        </div>
      </div>
      {editingAvail && <AvailabilityModal member={member} onClose={() => setEditingAvail(false)} onSave={saveAvailability} />}
      {editingProfile && <EditMemberModal member={member} onClose={() => setEditingProfile(false)} onSave={saveProfile} />}
    </div>
  );
}

export function AvailabilityModal({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (m: Member) => Promise<void> | void;
}) {
  const { period } = useDemo();
  const [available, setAvailable] = useState(String(member.availableHours ?? 32));
  const [limit, setLimit] = useState(String(member.weeklyLimit));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const a = Number(available),
      l = Number(limit);
    if (!Number.isFinite(a) || a < 0 || a > 60) return setError("Jam tersedia antara 0 dan 60.");
    if (!Number.isFinite(l) || l < a) return setError("Batas kerja tidak boleh lebih kecil dari jam tersedia.");
    setBusy(true);
    try {
      await onSave({ ...member, availableHours: a, weeklyLimit: l });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan ketersediaan.");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Ketersediaan ${member.name.split(" ")[0]}`} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <p className="dialog-summary">Periode {period?.label ?? PERIOD.label}. Karyawan biasanya mengisi ini sendiri; manajer mengisi hanya atas persetujuannya.</p>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Jam tersedia</span>
            <input
              className="input"
              type="number"
              value={available}
              onChange={(e) => {
                setAvailable(e.target.value);
                setError("");
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Batas kerja mingguan</span>
            <input
              className="input"
              type="number"
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setError("");
              }}
            />
          </label>
        </div>
        {error && (
          <p className="field-error spaced" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (name: string, role: string, email: string, weeklyLimit: number) => Promise<void> | void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [email, setEmail] = useState(member.email);
  const [weeklyLimit, setWeeklyLimit] = useState(String(member.weeklyLimit));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError("Nama wajib diisi.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Email belum valid.");
    const l = Number(weeklyLimit);
    if (!Number.isFinite(l) || l < 4 || l > 60) return setError("Batas mingguan harus antara 4 dan 60 jam.");
    setBusy(true);
    try {
      await onSave(name.trim(), role.trim(), email.trim().toLowerCase(), l);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan profil karyawan.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Ubah profil karyawan" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="form-grid">
          <label className="field full">
            <span className="field-label">Nama lengkap</span>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
          </label>
          <label className="field full">
            <span className="field-label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
          </label>
          <label className="field">
            <span className="field-label">Peran</span>
            <input className="input" value={role} onChange={(e) => { setRole(e.target.value); setError(""); }} />
          </label>
          <label className="field">
            <span className="field-label">Batas mingguan</span>
            <input className="input" type="number" value={weeklyLimit} onChange={(e) => { setWeeklyLimit(e.target.value); setError(""); }} />
          </label>
        </div>
        {error && <p className="field-error spaced" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </form>
    </Modal>
  );
}
