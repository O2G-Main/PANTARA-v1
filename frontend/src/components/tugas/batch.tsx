"use client";

import { Paged } from "@/components/ui/pager";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCheck, CircleAlert } from "lucide-react";
import { CapacityBar, EmptyState, PageHeading, Person, PriorityBadge } from "@/components/app/parts";
import { Badge, Icon } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { NOW } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import { allocateBatch, type BatchPair } from "@/lib/engine/batch";
import { allocatedHours } from "@/lib/engine/score";
import { hours, score, shortDate } from "@/lib/format";

export function BatchAllocation() {
  const { tasks, members, settings, names, memberById, decisions, dispatch, reload } = useDemo();
  const router = useRouter();
  const [remotePairs, setRemotePairs] = useState<BatchPair[] | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (DATA_MODE !== "api") return;
    let active = true;
    api.tasks
      .batchPreview(settings.preset)
      .then((res) => {
        if (!active) return;
        setRemotePairs(res.pairs ?? []);
        setPicked((res.pairs ?? []).filter((p) => p.memberId).map((p) => p.task.id));
      })
      .catch(() => {
        if (active) setRemotePairs(null);
      });
    return () => {
      active = false;
    };
  }, [settings.preset, tasks.length]);

  const open = tasks.filter((t) => t.status === "belum" && t.dna?.confirmed);
  const unconfirmed = tasks.filter((t) => t.status === "belum" && !t.dna?.confirmed);
  const pairs = remotePairs ?? allocateBatch(open, members, tasks, settings, names);
  const selectedIds = picked ?? pairs.filter((p) => p.memberId).map((p) => p.task.id);

  const added: Record<string, number> = {};
  for (const p of pairs) {
    if (p.memberId && selectedIds.includes(p.task.id)) {
      added[p.memberId] = (added[p.memberId] ?? 0) + (p.task.dna?.effortHours ?? 0);
    }
  }

  async function assignPicked() {
    if (busy || !selectedIds.length) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const items = pairs
          .filter((p) => p.memberId && selectedIds.includes(p.task.id))
          .map((p) => ({
            taskId: p.task.id,
            memberId: p.memberId!,
            hours: p.task.dna?.effortHours ?? p.task.remainingHours ?? 4,
          }));
        await api.tasks.batchCommit({ preset: settings.preset, items });
        await reload();
        router.push("/tugas?status=menunggu");
      } catch (err) {
        setBusy(false);
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan penugasan massal.");
      }
      return;
    }

    let n = decisions.length;
    for (const p of pairs) {
      if (!p.memberId || !selectedIds.includes(p.task.id)) continue;
      n += 1;
      dispatch({
        type: "assign",
        id: p.task.id,
        assignments: [{ memberId: p.memberId, hours: p.task.dna?.effortHours ?? 0 }],
        decision: {
          id: `KPT-${String(26 + n).padStart(3, "0")}`,
          taskId: p.task.id,
          memberIds: [p.memberId],
          rank: 1,
          preset: settings.preset,
          note: "Penugasan massal",
          decidedAt: NOW,
          decisionMs: 3 * 60_000,
          conflictsSeen: 0,
        },
      });
    }
    router.push("/tugas?status=menunggu");
  }

  return (
    <div className="page-enter">
      <PageHeading
        title="Penugasan massal"
        subtitle="Usulan pasangan untuk semua tugas yang belum ditugaskan, dengan kapasitas diperbarui setiap pasangan."
        actions={
          <button className="button primary" disabled={!selectedIds.length || busy} onClick={() => void assignPicked()}>
            <Icon icon={CheckCheck} />
            {busy ? "Menetapkan..." : `Tetapkan ${selectedIds.length} terpilih`}
          </button>
        }
      />
      {error && (
        <p className="login-alert spaced" role="alert">
          <Icon icon={CircleAlert} size={16} />
          {error}
        </p>
      )}
      {unconfirmed.length > 0 && (
        <p className="small muted">
          {unconfirmed.length} tugas belum ikut karena Analisis kebutuhan-nya belum dikonfirmasi:{" "}
          {unconfirmed.map((t) => (
            <Link key={t.id} className="inline-link" href={`/tugas/${t.id}/kebutuhan`}>
              {t.title}
            </Link>
          ))}
        </p>
      )}
      {pairs.length ? (
        <section className="card spaced">
          <Paged items={pairs} unit="tugas">
            {(paged) => (
              <div className="table-scroll stack-table">
                <table>
                  <thead>
                    <tr>
                      <th>Pilih</th>
                      <th>Tugas</th>
                      <th>Usulan penanggung jawab</th>
                      <th className="numeric">Skor</th>
                      <th>Beban setelah semua pasangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => {
                      const m = p.memberId ? memberById(p.memberId) : undefined;
                      return (
                        <tr key={p.task.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${p.task.title}`}
                              disabled={!m}
                              checked={selectedIds.includes(p.task.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selectedIds, p.task.id]
                                  : selectedIds.filter((i) => i !== p.task.id);
                                setPicked(next);
                              }}
                            />
                          </td>
                          <td data-label="Tugas">
                            <Link href={`/tugas/${p.task.id}`}>
                              <strong>{p.task.title}</strong>
                            </Link>
                            <span className="table-sub">
                              <PriorityBadge priority={p.task.priority} /> · {hours(p.task.dna?.effortHours ?? 0)} · tenggat {shortDate(p.task.dueDate)}
                            </span>
                          </td>
                          <td data-label="Usulan">
                            {m ? (
                              <Person member={m} />
                            ) : (
                              <span className="warn-text small with-icon">
                                <Icon icon={CircleAlert} size={13} />
                                {p.reason}
                              </span>
                            )}
                          </td>
                          <td data-label="Skor" className="numeric">
                            {m ? score(p.score) : "-"}
                          </td>
                          <td data-label="Beban">
                            {m ? <CapacityBar allocated={allocatedHours(m.id, tasks)} available={m.availableHours} added={added[m.id] ?? 0} /> : <Badge tone="warn">Tidak teralokasi</Badge>}
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
      ) : (
        <EmptyState
          icon={CheckCheck}
          title="Tidak ada tugas terbuka"
          text="Semua tugas yang dikonfirmasi sudah ditugaskan."
          action={
            <Link className="button secondary" href="/tugas">
              Kembali ke Tugas
            </Link>
          }
        />
      )}
    </div>
  );
}
