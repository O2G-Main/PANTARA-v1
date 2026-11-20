"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { CalendarClock, CircleAlert, CircleCheck, ClipboardCheck, FolderKanban, History, Pencil, RotateCcw, Timer, Trash2, UserRoundSearch } from "lucide-react";
import { EmptyState, PageHeading, Person, PriorityBadge, SectionTitle, StatusBadge, statusLabel } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { REASON_LABEL } from "@/lib/demo/reasons";
import { useDemo } from "@/lib/demo/store";
import type { Priority, TaskStatus } from "@/lib/demo/types";
import { LEVEL_LABEL, PRESETS } from "@/lib/engine/score";
import { date, hours, minutes, shortDate, time } from "@/lib/format";

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus[]>> = { menunggu: ["berjalan"], berjalan: ["selesai"] };

export function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const router = useRouter();
  const { taskById, projects, memberById, projectById, decisions, names, today, loading, dispatch } = useDemo();
  const [finishing, setFinishing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", projectId: "", dueDate: "", priority: "normal" as Priority });
  const [actual, setActual] = useState("");
  const [quality, setQuality] = useState("");
  const [actualError, setActualError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const task = taskById(id);
  if (loading && !task) return <section className="card"><div className="answer-skeleton" aria-busy="true"><div /><div /><div /></div></section>;
  if (!task) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Tugas tidak ditemukan"
        text={`Tidak ada tugas dengan ID ${id}.`}
        action={
          <Link className="button secondary" href="/tugas">
            Kembali ke Tugas
          </Link>
        }
      />
    );
  }

  const log = decisions.filter((d) => d.taskId === id);
  const assignees = task.assignments.map((a) => ({ member: memberById(a.memberId), hours: a.hours })).filter((a) => a.member);
  const project = projectById(task.projectId);
  const justAssigned = search.get("ditetapkan") === "1" && task.status === "menunggu";
  const canDelete = task.status !== "menunggu" && task.status !== "berjalan";

  const openEdit = () => {
    setEditForm({
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      dueDate: task.dueDate,
      priority: task.priority,
    });
    setActionError("");
    setEditing(true);
  };

  const handleUnassign = async () => {
    if (busy) return;
    setActionError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.tasks.unassign(id);
        dispatch({ type: "upsertTask", task: res.task });
        router.push(`/tugas/${id}/kandidat`);
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "Gagal membatalkan penugasan.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "setStatus", id, status: "belum" });
    router.push(`/tugas/${id}/kandidat`);
  };

  const handleSetStatus = async (status: TaskStatus, actualHours?: number) => {
    if (busy) return;
    setActionError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.tasks.updateStatus(id, { status, actualHours });
        dispatch({ type: "upsertTask", task: res.task });
        setFinishing(false);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Gagal memperbarui status tugas.";
        if (finishing) setActualError(msg);
        else setActionError(msg);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (actualHours !== undefined) dispatch({ type: "updateTask", id, patch: { actualHours, completedAt: today, qualityScore: quality.trim() === "" ? undefined : Number(quality) } });
    dispatch({ type: "setStatus", id, status });
    setFinishing(false);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!editForm.title.trim()) return setActionError("Judul tugas wajib diisi.");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.tasks.update(id, {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          projectId: editForm.projectId,
          dueDate: editForm.dueDate,
          priority: editForm.priority,
        });
        dispatch({ type: "upsertTask", task: res.task });
        setEditing(false);
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan tugas.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({
      type: "updateTask",
      id,
      patch: {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        projectId: editForm.projectId,
        dueDate: editForm.dueDate,
        priority: editForm.priority,
      },
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (busy || !canDelete) return;
    setActionError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.tasks.delete(id);
        dispatch({ type: "removeTask", id });
        router.push("/tugas");
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "Gagal menghapus atau mengarsipkan tugas.");
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "removeTask", id });
    router.push("/tugas");
  };

  return (
    <div className="page-enter">
      <PageHeading
        title={task.title}
        subtitle={`${task.id} · ${project?.name ?? ""}`}
        actions={
          <>
            <button type="button" className="button secondary" disabled={busy} onClick={openEdit}>
              <Icon icon={Pencil} size={16} />
              Ubah
            </button>
            {canDelete && (
              <button type="button" className="button secondary" disabled={busy} onClick={() => void handleDelete()}>
                <Icon icon={Trash2} size={16} />
                Arsipkan
              </button>
            )}
            {(task.status === "menunggu" || task.status === "berjalan") && (
              <button className="button secondary" disabled={busy} onClick={() => void handleUnassign()}>
                <Icon icon={RotateCcw} size={16} />
                Tugaskan ulang
              </button>
            )}
            {task.status === "belum" && (
              <Link className="button primary" href={task.dna?.confirmed ? `/tugas/${id}/kandidat` : `/tugas/${id}/kebutuhan`}>
                <Icon icon={UserRoundSearch} size={16} />
                Cari kandidat
              </Link>
            )}
            {task.status === "draf" && (
              <Link className="button primary" href={`/tugas/${id}/kebutuhan`}>
                Lanjutkan analisis
              </Link>
            )}
            {NEXT_STATUS[task.status]?.map((s) => (
              <button
                key={s}
                className="button primary"
                disabled={busy}
                onClick={() => {
                  if (s !== "selesai") return void handleSetStatus(s);
                  setActual(String(task.assignments.reduce((sum, a) => sum + a.hours, 0) || task.dna?.effortHours || ""));
                  setActualError("");
                  setFinishing(true);
                }}
              >
                <Icon icon={CircleCheck} size={16} />
                Tandai {statusLabel(s).toLowerCase()}
              </button>
            ))}
          </>
        }
      />
      {actionError && !editing && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Aksi gagal</strong>
            <span>{actionError}</span>
          </span>
        </div>
      )}
      {justAssigned && (
        <div className="decision-banner" role="status">
          <Icon icon={CircleCheck} />
          <span>
            <strong>Penugasan ditetapkan</strong>
            <span>{assignees.map((a) => a.member!.name).join(" dan ")} menerima notifikasi. Kapasitas karyawan sudah diperbarui di Dashboard, Tim, dan Kapasitas.</span>
          </span>
          <Link className="row-link" href="/dashboard">
            Lihat dasbor
          </Link>
        </div>
      )}
      {task.changeRequest?.status === "pending" && <div className="decision-banner warn"><span><strong>Permintaan perubahan freelancer</strong><span>{memberById(task.changeRequest.memberId)?.name ?? "Anggota"}: {task.changeRequest.reason}</span><button className="button" type="button" onClick={() => dispatch({ type: "updateTask", id, patch: { changeRequest: { ...task.changeRequest!, status: "reviewed" } } })}>Tandai sudah ditinjau</button></span></div>}
      {task.status === "belum" && task.responseReason && (
        <div className="decision-banner warn">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Penugasan sebelumnya ditolak karyawan</strong>
            <span>{task.responseReason}</span>
          </span>
        </div>
      )}
      <div className="split-detail">
        <div className="stack">
          <section className="card">
            <SectionTitle title="Deskripsi" />
            <p className="dna-quote">{task.description}</p>
          </section>
          <section className="card">
            <SectionTitle title="Analisis kebutuhan" subtitle={task.dna?.confirmed ? `Dikonfirmasi · ${task.dna.model} · ${task.dna.prompt}` : "Belum dikonfirmasi"} />
            {task.dna ? (
              <>
                <div className="chips">
                  {task.dna.requirements.map((r) => (
                    <span key={r.competencyId} className="chip accent">
                      {names[r.competencyId] ?? r.competencyId} · {LEVEL_LABEL[r.level]}
                    </span>
                  ))}
                </div>
                <p className="small muted spaced">
                  Estimasi {hours(task.dna.effortHours)} (ukuran {task.dna.effortSize}) · kompleksitas {["rendah", "sedang", "tinggi", "sangat tinggi"][task.dna.complexity]} · dependensi{" "}
                  {task.dna.dependencies.length ? task.dna.dependencies.map((d) => d.taskId).join(", ") : "tidak ada"}
                </p>
              </>
            ) : (
              <p className="small muted">
                Tugas lama, dibuat sebelum Analisis kebutuhan.
                {task.competencyIds.length ? ` Kompetensi: ${task.competencyIds.map((c) => names[c] ?? c).join(", ")}.` : ""}
              </p>
            )}
          </section>
          <section className="card">
            <SectionTitle title="Riwayat keputusan" subtitle="Tercatat dan tidak bisa diubah." />
            {log.length ? (
              log.map((d) => (
                <div key={d.id} className="history-item">
                  <Icon icon={History} size={15} />
                  <div>
                    <strong>
                      {d.rejected
                        ? `Rekomendasi ditolak · ${REASON_LABEL[d.reasonCode ?? "lainnya"]}`
                        : `${d.memberIds.map((m) => memberById(m)?.name ?? m).join(" & ")} · ${d.rank ? `kandidat #${d.rank}` : "di luar tiga teratas"}`}
                    </strong>
                    <p>
                      {date(d.decidedAt)} {time(d.decidedAt)} · preset {PRESETS[d.preset].label} ·{" "}
                      {d.rejected ? "tidak ada yang ditetapkan" : `lama keputusan ${minutes(d.decisionMs)} · ${d.conflictsSeen} konflik terlihat`}
                      {d.note ? ` · "${d.note}"` : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="small muted">Belum ada keputusan untuk tugas ini.</p>
            )}
          </section>
        </div>
        <section className="card">
          <SectionTitle title="Ringkasan" />
          <div className="dna-row">
            <span className="muted small">Status</span>
            <StatusBadge status={task.status} />
          </div>
          <div className="dna-row">
            <span className="muted small">Prioritas</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="dna-row">
            <span className="muted small with-icon">
              <Icon icon={CalendarClock} size={13} />
              Tenggat
            </span>
            <strong>{shortDate(task.dueDate)}</strong>
          </div>
          <div className="dna-row">
            <span className="muted small with-icon">
              <Icon icon={ClipboardCheck} size={13} />
              {task.status === "berjalan" ? "Sisa estimasi" : "Estimasi"}
            </span>
            <strong>{hours(task.status === "berjalan" ? task.remainingHours : task.dna?.effortHours ?? task.assignments.reduce((s, a) => s + a.hours, 0))}</strong>
          </div>
          {task.actualHours !== undefined && (
            <div className="dna-row">
              <span className="muted small with-icon">
                <Icon icon={Timer} size={13} />
                Jam aktual
              </span>
              <strong>{hours(task.actualHours)}</strong>
            </div>
          )}
          <div className="dna-row">
            <span className="muted small with-icon">
              <Icon icon={FolderKanban} size={13} />
              Proyek
            </span>
            {project && (
              <Link className="text-link" href={`/proyek/${project.id}`}>
                {project.name}
              </Link>
            )}
          </div>
          <h3 className="spaced">Penanggung jawab</h3>
          {assignees.length ? (
            assignees.map((a) => (
              <div key={a.member!.id} className="dna-row">
                <Link href={`/tim/${a.member!.id}`}>
                  <Person member={a.member!} />
                </Link>
                <span className="small">{hours(a.hours)}</span>
              </div>
            ))
          ) : (
            <p className="small muted">Belum ada penanggung jawab.</p>
          )}
          {task.status === "menunggu" && (
            <p className="small muted spaced">
              <Badge>Menunggu jawaban karyawan</Badge>
            </p>
          )}
        </section>
      </div>
      {finishing && (
        <Modal title="Tandai selesai" onClose={() => setFinishing(false)}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(actual.replace(",", "."));
              if (!actual.trim() || !Number.isFinite(value) || value <= 0) {
                return setActualError("Isi perkiraan jam aktual, lebih dari 0.");
              }
              if (quality.trim() && (!Number.isFinite(Number(quality)) || Number(quality) < 0 || Number(quality) > 100)) {
                return setActualError("Nilai kualitas harus antara 0 dan 100.");
              }
              void handleSetStatus("selesai", value);
            }}
          >
            <p className="dialog-summary">Satu angka perkiraan total jam yang benar-benar dipakai. Dipakai untuk mengkalibrasi estimasi tugas berikutnya, bukan untuk menilai kinerja.</p>
            <label className="field">
              <span className="field-label">Jam aktual dikerjakan</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0.5"
                step="0.5"
                value={actual}
                onChange={(e) => {
                  setActual(e.target.value);
                  setActualError("");
                }}
                aria-invalid={actualError ? true : undefined}
                aria-describedby={actualError ? "actual-error" : undefined}
              />
            </label>
            {DATA_MODE === "mock" && <label className="field spaced"><span className="field-label">Kualitas hasil (0–100, opsional)</span><input className="input" type="number" min="0" max="100" value={quality} onChange={(event) => setQuality(event.target.value)} /></label>}
            {actualError && (
              <p id="actual-error" className="field-error spaced" role="alert">
                {actualError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setFinishing(false)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan dan tandai selesai"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title="Ubah tugas" onClose={() => setEditing(false)}>
          <form noValidate onSubmit={(e) => void handleEditSave(e)}>
            <label className="field">
              <span className="field-label">Judul tugas</span>
              <input className="input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
            <label className="field spaced">
              <span className="field-label">Deskripsi</span>
              <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label className="field spaced">
              <span className="field-label">Proyek</span>
              <select className="select" value={editForm.projectId} onChange={(e) => setEditForm((f) => ({ ...f, projectId: e.target.value }))}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field spaced">
              <span className="field-label">Tenggat</span>
              <DatePicker min={today} value={editForm.dueDate} onChange={(v) => setEditForm((f) => ({ ...f, dueDate: v }))} />
            </label>
            <fieldset className="field spaced">
              <legend className="field-label">Prioritas</legend>
              <div className="radio-pills">
                {(["rendah", "normal", "tinggi"] as Priority[]).map((p) => (
                  <label key={p}>
                    <input type="radio" name="edit-priority" checked={editForm.priority === p} onChange={() => setEditForm((f) => ({ ...f, priority: p }))} />
                    {p[0].toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>
            {actionError && <p className="field-error spaced" role="alert">{actionError}</p>}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(false)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
