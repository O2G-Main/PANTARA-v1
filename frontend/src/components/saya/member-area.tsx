"use client";

import { Paged } from "@/components/ui/pager";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { CalendarOff, Check, CircleAlert, CircleCheck, Clock3, History, Inbox, MessageSquareWarning, ShieldCheck, X } from "lucide-react";
import { CapacityBar, EmptyState, PageHeading, PriorityBadge, SectionTitle, StatusBadge } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { api, ApiError, AWAITING_BACKEND, AWAITING_BACKEND_NOTE, DATA_MODE } from "@/lib/api";
import { PERIOD } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import { useSession } from "@/lib/session";
import type { LeaveRequest, LeaveType, Level, Member, Task } from "@/lib/demo/types";
import { canRequestExtraTime } from "@/lib/engine/capacity";
import { leaveError, leaveStatus } from "@/lib/engine/leave";
import { allocatedHours, LEVEL_LABEL, rankCandidates } from "@/lib/engine/score";
import { hours, shortDate } from "@/lib/format";

function useMemberId() {
  return useSession()?.memberId ?? "";
}

export function MyHome() {
  const memberId = useMemberId();
  const { tasks, memberById, period, now, loading, dispatch } = useDemo();
  const [progTask, setProgTask] = useState<Task | null>(null);
  const [extraTask, setExtraTask] = useState<Task | null>(null);
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
  const done = mine.filter((t) => t.status === "selesai");
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
              subtitle={me.employmentType === "freelancer" ? "Terima atau tolak dengan alasan. Manajer melihat jawabanmu." : "Buka untuk menerima penugasan."}
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
                      Tenggat {shortDate(t.dueDate)} {t.dueTime ?? "17:00"} · sisa {hours(t.remainingHours)}
                    </p>
                    {t.extraTime && (
                      <p className="small muted">
                        Tambahan {hours(t.extraTime.hours)}: {EXTRA_LABEL[t.extraTime.status]}
                      </p>
                    )}
                  </div>
                  <div className="page-actions">
                    <StatusBadge status={t.status} />
                    {canRequestExtraTime(t, now) && (
                      <button type="button" className="row-link accent" onClick={() => setExtraTask(t)}>
                        Minta tambahan waktu
                      </button>
                    )}
                    <button type="button" className="row-link" onClick={() => openProgress(t)}>
                      Perbarui progres
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="small muted">Belum ada tugas berjalan.</p>
            )}
            {running.length > 0 && <p className="small muted spaced">Tombol tambahan waktu muncul saat tenggat tinggal 2 jam atau kurang.</p>}
          </section>
          <section className="card">
            <SectionTitle title="Riwayat kerja saya" subtitle="Tugas yang sudah kamu selesaikan." />
            {done.length ? (
              done.map((t) => (
                <div key={t.id} className="dna-row">
                  <span className="with-icon">
                    <Icon icon={History} size={14} />
                    {t.title}
                  </span>
                  <span className="small muted">
                    {shortDate(t.dueDate)}
                    {t.actualHours !== undefined ? ` · ${hours(t.actualHours)}` : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="small muted">Belum ada tugas selesai.</p>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <SectionTitle title="Kapasitas saya" subtitle={periodLabel} />
            <CapacityBar allocated={allocatedHours(me.id, tasks)} available={me.availableHours} />
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
      {extraTask && (
        <ExtraTimeModal
          task={extraTask}
          onClose={() => setExtraTask(null)}
          onSubmit={(h, reason) => {
            dispatch({
              type: "updateTask",
              id: extraTask.id,
              patch: { extraTime: { memberId: me.id, hours: h, reason, requestedAt: new Date().toISOString(), status: "menunggu" } },
            });
            setExtraTask(null);
          }}
        />
      )}
    </div>
  );
}

const EXTRA_LABEL = { menunggu: "menunggu persetujuan manajer", disetujui: "disetujui", ditolak: "tidak disetujui" } as const;

function ExtraTimeModal({ task, onClose, onSubmit }: { task: Task; onClose: () => void; onSubmit: (hours: number, reason: string) => void }) {
  const [extra, setExtra] = useState("2");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal title="Minta tambahan waktu" onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(extra.replace(",", "."));
          if (!Number.isFinite(h) || h <= 0) return setError("Isi tambahan jam lebih dari 0.");
          if (reason.trim().length < 10) return setError("Tulis alasan minimal 10 karakter supaya manajer bisa menilai.");
          onSubmit(h, reason.trim());
        }}
      >
        <p className="dialog-summary">
          Tenggat &quot;{task.title}&quot; tetap. Jam estimasimu bertambah setelah manajer menyetujui, bila perlu dari kapasitas cadangan tim.
        </p>
        <label className="field">
          <span className="field-label">Tambahan jam</span>
          <input className="input" type="number" inputMode="decimal" min="0.5" step="0.5" value={extra} onChange={(e) => { setExtra(e.target.value); setError(""); }} />
        </label>
        <label className="field spaced">
          <span className="field-label">Alasan (wajib)</span>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            placeholder="Skenario uji bertambah setelah perubahan skema, perlu 2 jam lagi."
          />
        </label>
        {error && <p className="field-error spaced" role="alert">{error}</p>}
        {AWAITING_BACKEND && <p className="small muted spaced">{AWAITING_BACKEND_NOTE}</p>}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button primary" disabled={AWAITING_BACKEND}>
            <Icon icon={Clock3} size={16} />
            Kirim permintaan
          </button>
        </div>
      </form>
    </Modal>
  );
}

const LEAVE_TYPE: Record<LeaveType, string> = { tahunan: "Cuti tahunan", sakit: "Sakit", izin: "Izin" };
const APPROVAL_TONE = { menunggu: "warn", disetujui: "ok", ditolak: "crit" } as const;

function useMe() {
  const memberId = useMemberId();
  const { memberById, loading } = useDemo();
  const me = memberById(memberId);
  const fallback =
    loading && !me ? (
      <section className="card">
        <div className="answer-skeleton" aria-busy="true">
          <div />
          <div />
          <div />
        </div>
      </section>
    ) : !me ? (
      <EmptyState icon={CircleAlert} title="Profil tidak ditemukan" text="Profil anggota belum tersedia." />
    ) : null;
  return { me, fallback };
}

export function MyAvailability() {
  const { period } = useDemo();
  const { me, fallback } = useMe();
  if (!me) return fallback;
  const pending = (me.leaveRequests ?? []).filter((r) => leaveStatus(r) === "menunggu").length;

  return (
    <div className="page-enter">
      <PageHeading
        title="Ketersediaan saya"
        subtitle={`Jam kerja dan cuti periode ${period?.label ?? PERIOD.label}. Jam tersedia dan batas mingguan diatur HR.`}
        actions={
          <Link className="button secondary" href="/saya/cuti">
            <Icon icon={CalendarOff} size={16} />
            Ajukan cuti
          </Link>
        }
      />
      <section className="card">
        <SectionTitle title="Ketersediaan periode ini" subtitle="Hanya baca. Hubungi HR bila ada yang perlu diubah." />
        <div className="dna-row">
          <span className="muted small">Jam tersedia</span>
          <strong>{me.availableHours === null ? "Belum diisi HR" : hours(me.availableHours)}</strong>
        </div>
        <div className="dna-row">
          <span className="muted small">Batas kerja mingguan</span>
          <strong>{hours(me.weeklyLimit)}</strong>
        </div>
        <div className="dna-row">
          <span className="muted small">Cuti terjadwal</span>
          <span className="chips">
            {me.leaveDates.length ? me.leaveDates.map((d) => <span key={d} className="chip">{shortDate(d)}</span>) : <span className="chip">Tidak ada cuti</span>}
          </span>
        </div>
        {pending > 0 && (
          <div className="dna-row">
            <span className="muted small">Pengajuan cuti</span>
            <Link className="row-link" href="/saya/cuti">
              {pending} menunggu persetujuan
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export function MyLeave() {
  const { today, dispatch } = useDemo();
  const { me, fallback } = useMe();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [type, setType] = useState<LeaveType>("tahunan");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (!me) return fallback;
  const requests = me.leaveRequests ?? [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    const problem = leaveError(start, end, reason, today);
    if (problem) return setError(problem);
    const req: LeaveRequest = {
      id: `CUTI-${me.id}-${requests.length + 1}`,
      start,
      end,
      type,
      reason: reason.trim(),
      requestedAt: today,
      manager: "menunggu",
      hr: "menunggu",
    };
    dispatch({ type: "upsertMember", member: { ...me, leaveRequests: [req, ...requests] } });
    setStart("");
    setEnd("");
    setReason("");
    setSent(true);
  }

  return (
    <div className="page-enter">
      <PageHeading title="Pengajuan cuti" subtitle="Cuti berlaku setelah disetujui manajer dan HR. Hari kerjanya lalu dikurangi dari jam tersedia." />
      <div className="split-even">
        <form className="card" onSubmit={submit} noValidate>
          <SectionTitle title="Ajukan cuti" subtitle="Isi rentang tanggal, jenis, dan alasan." />
          {sent && (
            <div className="decision-banner" role="status">
              <Icon icon={CircleCheck} />
              <span>
                <strong>Pengajuan terkirim</strong>
                <span>Menunggu persetujuan manajer dan HR.</span>
              </span>
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <span className="field-label">Mulai</span>
              <DatePicker min={today} value={start} onChange={(v) => { setStart(v); setError(""); setSent(false); }} aria-label="Tanggal mulai cuti" />
            </div>
            <div className="field">
              <span className="field-label">Selesai</span>
              <DatePicker min={start || today} value={end} onChange={(v) => { setEnd(v); setError(""); setSent(false); }} aria-label="Tanggal selesai cuti" />
            </div>
            <label className="field full">
              <span className="field-label">Jenis cuti</span>
              <select className="select" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
                {(Object.keys(LEAVE_TYPE) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span className="field-label">Alasan (wajib)</span>
              <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(""); setSent(false); }} placeholder="Menghadiri pernikahan saudara di luar kota." />
            </label>
          </div>
          {error && (
            <p className="field-error spaced" role="alert">
              {error}
            </p>
          )}
          {AWAITING_BACKEND && <p className="small muted spaced">{AWAITING_BACKEND_NOTE}</p>}
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={AWAITING_BACKEND}>
              <Icon icon={CalendarOff} size={16} />
              Ajukan cuti
            </button>
          </div>
        </form>
        <section className="card">
          <SectionTitle title="Riwayat pengajuan" subtitle="Status persetujuan manajer dan HR." />
          {requests.length ? (
            requests.map((r) => (
              <div key={r.id} className="dna-row">
                <span>
                  <strong>
                    {LEAVE_TYPE[r.type]} · {shortDate(r.start)}
                    {r.end !== r.start ? ` - ${shortDate(r.end)}` : ""}
                  </strong>
                  <span className="table-sub">{r.reason}</span>
                  <span className="table-sub">
                    Manajer: {r.manager} · HR: {r.hr}
                  </span>
                </span>
                <Badge tone={APPROVAL_TONE[leaveStatus(r)]}>{leaveStatus(r)}</Badge>
              </div>
            ))
          ) : (
            <p className="small muted">Belum ada pengajuan cuti.</p>
          )}
        </section>
      </div>
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
  // CORPORATE-FIRST: karyawan tidak menolak penugasan (pakai tambahan waktu); freelancer tetap boleh menolak.
  const canReject = me?.employmentType === "freelancer";
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

  const isFreelancer = DATA_MODE === "mock" && canReject;

  const reject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (reason.trim().length < 10) {
      return setError("Tulis alasan minimal 10 karakter supaya manajer bisa menyesuaikan.");
    }
    if (isFreelancer) {
      dispatch({ type: "requestTaskChange", id, memberId, reason: reason.trim(), request: { id: crypto.randomUUID(), sender: me?.name ?? "Anggota", senderRole: "Freelancer", title: `Permintaan perubahan: ${task.title}`, description: reason.trim(), createdAt: new Date().toISOString(), read: false } });
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
              {canReject && (
                <button className="button secondary" disabled={busy} onClick={() => setRejecting(true)}>
                  <Icon icon={X} size={16} />
                  {isFreelancer ? "Minta perubahan" : "Tolak dengan alasan"}
                </button>
              )}
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
      {task.status === "menunggu" && mine && !canReject && (
        <p className="small muted spaced">Bila jam kerja ternyata kurang, minta tambahan waktu dari Beranda saya saat tenggat sudah dekat.</p>
      )}
      {rejecting && canReject && (
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
