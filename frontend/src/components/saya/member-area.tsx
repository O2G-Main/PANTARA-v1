"use client";

import { Paged } from "@/components/ui/pager";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { CalendarRange, Check, CircleAlert, CircleCheck, Copy, Inbox, MessageSquareWarning, ShieldCheck, X } from "lucide-react";
import { CapacityBar, EmptyState, PageHeading, PriorityBadge, SectionTitle, StatusBadge } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { api, ApiError, DATA_MODE, type AvailabilitySnapshot } from "@/lib/api";
import { PERIOD } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import { useSession } from "@/lib/session";
import type { Level, Member, Task } from "@/lib/demo/types";
import { allocatedHours, LEVEL_LABEL, rankCandidates } from "@/lib/engine/score";
import { hours, shortDate } from "@/lib/format";

function useMemberId() {
  return useSession()?.memberId ?? "";
}

export function MyHome() {
  const memberId = useMemberId();
  const { tasks, memberById, period, loading, dispatch } = useDemo();
  const [progTask, setProgTask] = useState<Task | null>(null);
  const [remHours, setRemHours] = useState("");
  const [actHours, setActHours] = useState("");
  const [complete, setComplete] = useState(false);
  const [progErr, setProgErr] = useState("");
  const [busy, setBusy] = useState(false);

  const me = memberById(memberId);
  if (loading && !me) {
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
  if (!me) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Profil kerja belum terhubung"
        text="Akun ini belum terhubung ke profil anggota di ruang kerja."
      />
    );
  }

  const mine = tasks.filter((t) => t.assignments.some((a) => a.memberId === me.id));
  const waiting = mine.filter((t) => t.status === "menunggu");
  const running = mine.filter((t) => t.status === "berjalan");
  const periodLabel = period?.label ?? PERIOD.label;

  const openProgress = (t: Task) => {
    setProgTask(t);
    setRemHours(String(t.remainingHours));
    setActHours(String(t.assignments.reduce((s, a) => s + a.hours, 0) || t.dna?.effortHours || 4));
    setComplete(false);
    setProgErr("");
  };

  const saveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progTask || busy) return;
    setProgErr("");
    if (complete) {
      const a = Number(actHours);
      if (!Number.isFinite(a) || a <= 0) return setProgErr("Isi jam aktual lebih dari 0.");
      if (DATA_MODE === "api") {
        setBusy(true);
        try {
          const res = await api.self.updateProgress(progTask.id, { complete: true, actualHours: a });
          dispatch({ type: "upsertTask", task: res.task });
          setProgTask(null);
        } catch (err) {
          setProgErr(err instanceof ApiError ? err.message : "Gagal menandai tugas selesai.");
        } finally {
          setBusy(false);
        }
        return;
      }
      dispatch({ type: "updateTask", id: progTask.id, patch: { actualHours: a, status: "selesai", remainingHours: 0 } });
      setProgTask(null);
      return;
    }

    const r = Number(remHours);
    if (!Number.isFinite(r) || r < 0) return setProgErr("Sisa jam tidak boleh negatif.");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.self.updateProgress(progTask.id, { remainingHours: r });
        dispatch({ type: "upsertTask", task: res.task });
        setProgTask(null);
      } catch (err) {
        setProgErr(err instanceof ApiError ? err.message : "Gagal memperbarui sisa jam.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "updateTask", id: progTask.id, patch: { remainingHours: r } });
    setProgTask(null);
  };

  return (
    <div className="page-enter">
      <PageHeading title="Beranda saya" subtitle={`Halo, ${me.name.split(" ")[0]}. Penugasan baru, tugas berjalan, dan kapasitasmu periode ${periodLabel}.`} />
      <div className="split-main">
        <div className="stack">
          <section className="card">
            <SectionTitle
              title="Penugasan baru"
              subtitle="Terima atau tolak dengan alasan. Manajer melihat jawabanmu."
              action={<Badge tone={waiting.length ? "warn" : "neutral"}>{waiting.length} menunggu</Badge>}
            />
            {waiting.length ? (
              waiting.map((t) => (
                <div key={t.id} className="dna-row">
                  <div>
                    <h4>{t.title}</h4>
                    <p>
                      Tenggat {shortDate(t.dueDate)} · {hours(t.assignments.find((a) => a.memberId === me.id)!.hours)}
                    </p>
                  </div>
                  <Link className="row-link accent" href={`/saya/tugas/${t.id}`}>
                    Buka penugasan
                  </Link>
                </div>
              ))
            ) : (
              <EmptyState icon={Inbox} title="Tidak ada penugasan baru" text="Penugasan dari manajer akan muncul di sini." />
            )}
          </section>
          <section className="card">
            <SectionTitle title="Tugas berjalan" />
            {running.length ? (
              running.map((t) => (
                <div key={t.id} className="dna-row">
                  <div>
                    <h4>{t.title}</h4>
                    <p>
                      Tenggat {shortDate(t.dueDate)} · sisa {hours(t.remainingHours)}
                    </p>
                  </div>
                  <div className="page-actions">
                    <StatusBadge status={t.status} />
                    <button type="button" className="row-link" onClick={() => openProgress(t)}>
                      Perbarui progres
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="small muted">Belum ada tugas berjalan.</p>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <SectionTitle title="Kapasitas saya" subtitle={periodLabel} />
            <CapacityBar allocated={allocatedHours(me.id, tasks)} available={me.availableHours} />
            <div className="page-actions spaced">
              <Link className="button secondary" href="/saya/ketersediaan">
                <Icon icon={CalendarRange} size={16} />
                Ubah ketersediaan
              </Link>
            </div>
          </section>
          <section className="card">
            <p className="small muted with-icon">
              <Icon icon={ShieldCheck} size={14} />
              Jam kerjamu dipakai untuk membagi tugas dengan adil, bukan untuk menilai produktivitas.
            </p>
          </section>
        </div>
      </div>

      {progTask && (
        <Modal title={`Progres: ${progTask.title}`} onClose={() => setProgTask(null)}>
          <form noValidate onSubmit={(e) => void saveProgress(e)}>
            <label className="switch-row">
              <span>
                <strong>Tugas sudah selesai dikerjakan</strong>
                <p>Tandai selesai dan catat jam aktual untuk kalibrasi estimasi.</p>
              </span>
              <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
            </label>
            {complete ? (
              <label className="field spaced">
                <span className="field-label">Jam aktual dikerjakan</span>
                <input className="input" type="number" step="0.5" min="0.5" value={actHours} onChange={(e) => setActHours(e.target.value)} />
              </label>
            ) : (
              <label className="field spaced">
                <span className="field-label">Sisa estimasi jam</span>
                <input className="input" type="number" step="0.5" min="0" value={remHours} onChange={(e) => setRemHours(e.target.value)} />
              </label>
            )}
            {progErr && <p className="field-error spaced" role="alert">{progErr}</p>}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setProgTask(null)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan progres"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function MyAvailability() {
  const memberId = useMemberId();
  const { memberById, period, loading, dispatch } = useDemo();
  const me = memberById(memberId);
  const [availableDraft, setAvailable] = useState<string | null>(null);
  const [limitDraft, setLimit] = useState<string | null>(null);
  const [leaveDraft, setLeaveDraft] = useState<string[] | null>(null);
  const available = availableDraft ?? String(me?.availableHours ?? 32);
  const limit = limitDraft ?? String(me?.weeklyLimit ?? 36);
  const leave = leaveDraft ?? me?.leaveDates ?? [];
  const setLeave = (updater: (prev: string[]) => string[]) => setLeaveDraft((prev) => updater(prev ?? leave));
  const [prevSnap, setPrevSnap] = useState<AvailabilitySnapshot | null>(null);
  const [newLeave, setNewLeave] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (DATA_MODE !== "api" || !memberId) return;
    let active = true;
    api.self
      .overview()
      .then((res) => {
        if (active && res.previousAvailability) setPrevSnap(res.previousAvailability);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [memberId]);

  if (loading && !me) {
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
  if (!me) return <EmptyState icon={CircleAlert} title="Profil tidak ditemukan" text="Profil anggota belum tersedia." />;

  const periodLabel = period?.label ?? PERIOD.label;
  const periodStart = period?.start ?? PERIOD.start;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !me) return;
    const a = Number(available),
      l = Number(limit);
    if (!Number.isFinite(a) || a < 0 || a > 60) return setError("Jam tersedia antara 0 dan 60.");
    if (!Number.isFinite(l) || l < a) return setError("Batas kerja tidak boleh lebih kecil dari jam tersedia.");

    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.self.updateAvailability({ availableHours: a, weeklyLimit: l, leaveDates: leave });
        dispatch({ type: "upsertMember", member: res.member });
        setSaved(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan ketersediaan.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "upsertMember", member: { ...me, availableHours: a, weeklyLimit: l, leaveDates: leave } });
    setSaved(true);
  }

  const copyFromPrevious = () => {
    if (prevSnap) {
      setAvailable(String(prevSnap.availableHours ?? 32));
      setLimit(String(prevSnap.weeklyLimit));
    } else {
      setAvailable("32");
      setLimit("36");
    }
    setSaved(false);
    setError("");
  };

  return (
    <div className="page-enter">
      <PageHeading title="Ketersediaan saya" subtitle={`Isi jam tersedia dan cuti untuk periode ${periodLabel}.`} />
      <form className="card form-card" onSubmit={(e) => void save(e)} noValidate>
        {saved && (
          <div className="decision-banner" role="status">
            <Icon icon={CircleCheck} />
            <span>
              <strong>Ketersediaan tersimpan</strong>
              <span>Rekomendasi berikutnya memakai data ini.</span>
            </span>
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Jam tersedia periode ini</span>
            <input
              className="input"
              type="number"
              value={available}
              onChange={(e) => {
                setAvailable(e.target.value);
                setSaved(false);
                setError("");
              }}
            />
            <span className="field-hint">Jam yang bisa dipakai untuk tugas proyek.</span>
          </label>
          <label className="field">
            <span className="field-label">Batas kerja mingguan</span>
            <input
              className="input"
              type="number"
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setSaved(false);
                setError("");
              }}
            />
            <span className="field-hint">Rekomendasi tidak akan melewati batas ini.</span>
          </label>
          <div className="field full">
            <span className="field-label">Tanggal cuti</span>
            <div className="toolbar">
              <DatePicker min={periodStart} value={newLeave} onChange={setNewLeave} aria-label="Tambah tanggal cuti" />
              <button
                type="button"
                className="button secondary"
                disabled={!newLeave}
                onClick={() => {
                  setLeave((l) => [...new Set([...l, newLeave])].sort());
                  setNewLeave("");
                  setSaved(false);
                }}
              >
                Tambah cuti
              </button>
            </div>
            <div className="chips">
              {leave.length ? (
                leave.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="chip"
                    onClick={() => setLeave((l) => l.filter((x) => x !== d))}
                    aria-label={`Hapus cuti ${shortDate(d)}`}
                  >
                    {shortDate(d)} <Icon icon={X} size={12} />
                  </button>
                ))
              ) : (
                <span className="chip">Tidak ada cuti</span>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p className="field-error spaced" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={copyFromPrevious}>
            <Icon icon={Copy} size={16} />
            Salin dari periode lalu
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan ketersediaan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function IncomingAssignment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const memberId = useMemberId();
  const { taskById, memberById, members, tasks, settings, names, today, loading, dispatch } = useDemo();
  const task = taskById(id);
  const me = memberById(memberId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading && !task) {
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
  if (!task) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Penugasan tidak ditemukan"
        text="Penugasan ini tidak ada."
        action={
          <Link className="button secondary" href="/saya">
            Kembali ke Beranda saya
          </Link>
        }
      />
    );
  }

  const mine = task.assignments.find((a) => a.memberId === memberId);
  const why = rankCandidates(
    { ...task, status: "belum", assignments: [] },
    members,
    tasks.map((t) => (t.id === id ? { ...t, status: "belum" as const, assignments: [] } : t)),
    settings,
    names,
    today,
  ).candidates.find((c) => c.member.id === memberId);

  const accept = async () => {
    if (busy) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.self.respond(id, { accept: true });
        dispatch({ type: "upsertTask", task: res.task });
        router.push("/saya");
      } catch (err) {
        setBusy(false);
        setError(err instanceof ApiError ? err.message : "Gagal menerima penugasan.");
      }
      return;
    }
    dispatch({ type: "setStatus", id, status: "berjalan" });
    router.push("/saya");
  };

  const isFreelancer = DATA_MODE === "mock" && me?.employmentType === "freelancer";

  const reject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (reason.trim().length < 10) {
      return setError("Tulis alasan minimal 10 karakter supaya manajer bisa menyesuaikan.");
    }
    if (isFreelancer) {
      dispatch({ type: "updateTask", id, patch: { changeRequest: { memberId, reason: reason.trim(), status: "pending" } } });
      setRejecting(false);
      setReason("");
      return;
    }
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.self.respond(id, { accept: false, reason: reason.trim() });
        dispatch({ type: "upsertTask", task: res.task });
        router.push("/saya");
      } catch (err) {
        setBusy(false);
        setError(err instanceof ApiError ? err.message : "Gagal mengirim penolakan.");
      }
      return;
    }
    dispatch({ type: "setStatus", id, status: "belum", reason: `Ditolak ${me?.name ?? "karyawan"}: ${reason.trim()}` });
    router.push("/saya");
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Penugasan masuk"
        subtitle={task.title}
        actions={
          task.status === "menunggu" && mine ? (
            <>
              <button className="button secondary" disabled={busy} onClick={() => setRejecting(true)}>
                <Icon icon={X} size={16} />
                {isFreelancer ? "Minta perubahan" : "Tolak dengan alasan"}
              </button>
              <button className="button primary" disabled={busy} onClick={() => void accept()}>
                <Icon icon={Check} />
                {busy ? "Memproses..." : "Terima penugasan"}
              </button>
            </>
          ) : undefined
        }
      />
      {error && !rejecting && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Gagal</strong>
            <span>{error}</span>
          </span>
        </div>
      )}
      {isFreelancer && task.changeRequest?.memberId === memberId && task.changeRequest.status === "pending" && <div className="decision-banner"><span><strong>Permintaan perubahan dikirim</strong><span>Menunggu tinjauan manajer.</span></span></div>}
      {task.status !== "menunggu" && (
        <div className="decision-banner">
          <Icon icon={CircleCheck} />
          <span>
            <strong>Penugasan sudah dijawab</strong>
            <span>Status sekarang: {task.status === "belum" ? "dikembalikan ke manajer" : task.status}.</span>
          </span>
        </div>
      )}
      <div className="split-detail">
        <section className="card">
          <SectionTitle title="Detail tugas" />
          <p className="dna-quote">{task.description}</p>
          <div className="chips spaced">
            {task.dna?.requirements.map((r) => (
              <span key={r.competencyId} className="chip accent">
                {names[r.competencyId] ?? r.competencyId} · {LEVEL_LABEL[r.level]}
              </span>
            ))}
          </div>
        </section>
        <section className="card">
          <SectionTitle title="Ringkasan" />
          <div className="dna-row">
            <span className="muted small">Prioritas</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="dna-row">
            <span className="muted small">Tenggat</span>
            <strong>{shortDate(task.dueDate)}</strong>
          </div>
          <div className="dna-row">
            <span className="muted small">Jam untukmu</span>
            <strong>{mine ? hours(mine.hours) : "-"}</strong>
          </div>
          {why && (
            <>
              <h3 className="spaced">Kenapa kamu dipilih</h3>
              <ul className="reason-list">
                {why.reasons.map((r) => (
                  <li key={r} className="ok-text">
                    <Icon icon={Check} size={13} />
                    <span className="muted">{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      {rejecting && (
        <Modal title={isFreelancer ? "Minta perubahan" : "Tolak penugasan"} onClose={() => setRejecting(false)}>
          <form onSubmit={(e) => void reject(e)}>
            <p className="dialog-summary">{isFreelancer ? "Jelaskan perubahan waktu atau beban yang kamu perlukan. Manajer akan meninjau permintaanmu." : "Tugas kembali ke manajer untuk dicarikan kandidat lain. Alasanmu ditampilkan di detail tugas."}</p>
            <label className="field">
              <span className="field-label">Alasan (wajib)</span>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError("");
                }}
                placeholder="Minggu ini saya fokus menutup webhook WhatsApp koperasi, belum bisa ambil tambahan 8 jam."
              />
            </label>
            {error && (
              <p className="field-error spaced" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setRejecting(false)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                <Icon icon={MessageSquareWarning} size={16} />
                {busy ? "Mengirim..." : isFreelancer ? "Kirim permintaan" : "Kirim penolakan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function MyProfile() {
  const memberId = useMemberId();
  const { memberById, competencies, names, loading, dispatch } = useDemo();
  const me = memberById(memberId);
  const [draftOverride, setDraftOverride] = useState<Member | null>(null);
  const draft = draftOverride ?? me;
  const setDraft = (updater: (prev: Member) => Member) => {
    setDraftOverride((prev) => {
      const base = prev ?? me;
      return base ? updater(base) : prev;
    });
  };
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading && !me) {
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
  if (!me || !draft) {
    return <EmptyState icon={CircleAlert} title="Profil tidak ditemukan" text="Profil kerja belum tersedia." />;
  }

  const setLevel = (id: string, level: Level) => {
    setSaved(false);
    setError("");
    setDraft((d) =>
      d
        ? {
            ...d,
            competencies:
              level === 0
                ? d.competencies.filter((c) => c.id !== id)
                : d.competencies.some((c) => c.id === id)
                  ? d.competencies.map((c) => (c.id === id ? { ...c, level, source: c.level === level ? c.source : "klaim" } : c))
                  : [...d.competencies, { id, level, source: "klaim" }],
          }
        : d,
    );
  };

  const togglePref = (id: string) => {
    setSaved(false);
    setError("");
    setDraft((d) =>
      d
        ? {
            ...d,
            prefers: d.prefers.includes(id) ? d.prefers.filter((x) => x !== id) : [...d.prefers, id],
            avoids: d.avoids.filter((x) => x !== id),
          }
        : d,
    );
  };

  const saveProfile = async () => {
    if (busy || !draft) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.self.updateProfile({
          competencies: draft.competencies,
          prefers: draft.prefers,
          avoids: draft.avoids,
        });
        dispatch({ type: "upsertMember", member: res.member });
        setSaved(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan profil kerja.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "upsertMember", member: draft });
    setSaved(true);
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Profil kerja saya"
        subtitle="Kompetensi, preferensi, dan batas kerja yang dipakai rekomendasi. Kamu yang mengisi, manajer bisa memverifikasi."
        actions={
          <button className="button primary" disabled={busy} onClick={() => void saveProfile()}>
            {busy ? "Menyimpan..." : "Simpan profil"}
          </button>
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
      {saved && (
        <div className="decision-banner" role="status">
          <Icon icon={CircleCheck} />
          <span>
            <strong>Profil tersimpan</strong>
            <span>Klaim baru ditandai &ldquo;Klaim karyawan&rdquo; sampai diverifikasi manajer.</span>
          </span>
        </div>
      )}
      <section className="card">
        <Paged items={competencies} unit="kompetensi">
          {(paged) => (
            <div className="table-scroll stack-table">
              <table>
                <thead>
                  <tr>
                    <th>Kompetensi</th>
                    <th>Level saya</th>
                    <th>Sumber</th>
                    <th className="numeric">Saya suka mengerjakan</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => {
                    const mine = draft.competencies.find((x) => x.id === c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <strong>{names[c.id] ?? c.name}</strong>
                          <span className="table-sub">{c.category}</span>
                        </td>
                        <td data-label="Level">
                          <div className="level-select" role="group" aria-label={`Level ${c.name}`}>
                            {([0, 1, 2, 3] as Level[]).map((l) => (
                              <button
                                key={l}
                                type="button"
                                className={(mine?.level ?? 0) === l ? "selected" : ""}
                                aria-pressed={(mine?.level ?? 0) === l}
                                onClick={() => setLevel(c.id, l)}
                              >
                                {LEVEL_LABEL[l]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td data-label="Sumber">
                          {mine ? (
                            <Badge tone={mine.source === "verifikasi" ? "ok" : "neutral"}>
                              {mine.source === "verifikasi" ? "Diverifikasi" : mine.source === "riwayat" ? "Riwayat" : "Klaim"}
                            </Badge>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td data-label="Suka mengerjakan" className="numeric">
                          <input
                            type="checkbox"
                            checked={draft.prefers.includes(c.id)}
                            onChange={() => togglePref(c.id)}
                            aria-label={`Suka mengerjakan ${c.name}`}
                          />
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
    </div>
  );
}
