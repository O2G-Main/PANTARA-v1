"use client";

import { useState } from "react";
import { Anchor, GitCompareArrows, Hourglass, Pencil, Ruler, ShieldAlert, Timer, UserCheck, Users } from "lucide-react";
import { MetricCard, PageHeading, SectionTitle } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { FluidArt } from "@/components/ui/fluid-art";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { BASELINE_MINUTES } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import { overrunFactor } from "@/lib/engine/capacity";
import { decisionStats, estimateAccuracy, stabilityRate } from "@/lib/engine/metrics";
import { minutes, number, percent, shortDate } from "@/lib/format";

/** Indikator dampak proposal §4.1, dihitung dari data. */
export function Report() {
  const { decisions, members, tasks, organization, now, taskById, reload } = useDemo();
  const [editingTb, setEditingTb] = useState(false);
  const [customTb, setCustomTb] = useState<number | null>(null);
  const [tbDraft, setTbDraft] = useState(String(organization?.baselineMinutes ?? BASELINE_MINUTES));
  const [tbError, setTbError] = useState("");
  const [busy, setBusy] = useState(false);

  const baseline = customTb ?? organization?.baselineMinutes ?? BASELINE_MINUTES;
  const s = decisionStats(decisions);
  const stable = stabilityRate(decisions, now);
  const judged = stable.stable + stable.moved;
  const accuracy = estimateAccuracy(tasks);
  const overrun = overrunFactor(tasks);
  const times = (v: number) => `×${number(v, 2)}`;
  const tb = Math.max(1, baseline) * 60_000;
  const efficiency = s.assigned ? (tb - s.avgMs) / tb : 0;
  const complete = members.filter((m) => m.availableHours !== null).length;
  const completeness = members.length ? complete / members.length : 0;
  const ordered = decisions.filter((d) => !d.rejected).sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
  const max = Math.max(tb, ...ordered.map((d) => d.decisionMs)) * 1.1;

  const saveBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const val = Math.round(Number(tbDraft));
    if (!Number.isFinite(val) || val < 1 || val > 240) {
      setTbError("Baseline manual harus antara 1 dan 240 menit.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.analytics.updateBaseline(val);
        await reload();
        setCustomTb(val);
        setEditingTb(false);
      } catch (err) {
        setTbError(err instanceof ApiError ? err.message : "Gagal memperbarui baseline manual.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setCustomTb(val);
    setEditingTb(false);
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Laporan dampak"
        subtitle="Mengukur dampak pilot dengan membandingkan proses manual (baseline) dan proses berbantuan Pantara."
        actions={
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setTbDraft(String(baseline));
              setTbError("");
              setEditingTb(true);
            }}
          >
            <Icon icon={Pencil} size={16} />
            Ubah baseline ({baseline} mnt)
          </button>
        }
      />
      <section className="highlight-card" aria-label="Efisiensi waktu keputusan">
        <FluidArt className="highlight-art" style="streak" seed={11} w={720} h={360} />
        <div className="highlight-top">
          <span>Efisiensi waktu keputusan</span>
          <Badge tone={s.n < 10 ? "warn" : "ok"}>{s.n < 10 ? `Belum cukup data (${s.n} keputusan, minimal 10)` : `${s.n} keputusan`}</Badge>
        </div>
        <div className="highlight-row">
          <div>
            <h2>(Tb − Tp) / Tb × 100%</h2>
            <p>
              Tb {baseline} menit dari observasi manual sebelum pilot · Tp rata-rata {minutes(s.avgMs)} tercatat otomatis
            </p>
          </div>
          <div className="highlight-score">{percent(efficiency)}</div>
        </div>
        <p>Dihitung dari keputusan yang tercatat di ruang kerja ini. Butuh minimal 10 keputusan supaya angkanya stabil.</p>
      </section>
      <div className="metrics-grid spaced">
        <MetricCard icon={ShieldAlert} label="Konflik terdeteksi sebelum penugasan" value={String(s.conflicts)} unit="peringatan" note="Kapasitas, tenggat berdekatan, dependensi" />
        <MetricCard icon={UserCheck} label="Tingkat penerimaan rekomendasi" value={s.n ? percent(s.accepted / s.n) : "-"} note="Target pilot ≥ 50% (hipotesis H2)" tone="brand" />
        <MetricCard icon={GitCompareArrows} label="Frekuensi override" value={s.n ? percent(s.override / s.n) : "-"} note={`${s.rejected} rekomendasi ditolak · alasan dipakai mengkalibrasi bobot`} />
        <MetricCard
          icon={Users}
          label="Kelengkapan Profil kerja"
          value={percent(completeness)}
          unit={`${complete} dari ${members.length}`}
          note="Target ≥ 80% setelah minggu pertama (H1)"
          tone={completeness >= 0.8 ? "brand" : "warn"}
        />
      </div>
      <div className="metrics-grid three">
        <MetricCard
          icon={Anchor}
          label="Penugasan stabil 7 hari (North Star)"
          value={judged ? percent(stable.rate) : "-"}
          unit={judged ? `${stable.stable} dari ${judged}` : undefined}
          note={stable.pending ? `${stable.pending} keputusan belum genap 7 hari, belum dihitung` : "Tidak dipindah ke orang lain dalam 7 hari"}
          tone="brand"
        />
        <MetricCard
          icon={Ruler}
          label="Akurasi estimasi"
          value={accuracy.n ? times(accuracy.ratio) : "-"}
          unit={accuracy.n ? `${accuracy.n} tugas` : undefined}
          note="Rata-rata jam aktual dibanding rencana, dicatat saat tugas selesai"
          tone={accuracy.ratio > 1.2 ? "warn" : undefined}
        />
        <MetricCard
          icon={Hourglass}
          label="Faktor molor yang dipakai mesin"
          value={times(overrun.factor)}
          note={overrun.samples >= 5 ? `Persentil 80 dari ${overrun.samples} tugas selesai` : `Asumsi awal; data jam aktual baru ${overrun.samples} tugas (minimal 5)`}
        />
      </div>
      <section className="card">
        <SectionTitle title="Lama keputusan per penugasan" subtitle={`Tp tiap keputusan dibanding cara manual (${baseline} menit). Makin pendek makin cepat.`} />
        <div className="bar-list" role="list" aria-label="Lama keputusan per penugasan" style={{ "--ref": tb / max } as React.CSSProperties}>
          <span className="bar-ref" aria-hidden="true">
            <span>Manual {baseline} menit</span>
          </span>
          {ordered.map((d) => {
            const ratio = d.decisionMs / max;
            const saved = Math.round((tb - d.decisionMs) / 60_000);
            const task = taskById(d.taskId);
            return (
              <div
                key={d.id}
                className="bar-row"
                role="listitem"
                tabIndex={0}
                aria-label={`${task?.title ?? d.taskId}: ${minutes(d.decisionMs)}, ${saved >= 0 ? `${saved} menit lebih cepat` : `${-saved} menit lebih lama`} dari manual`}
              >
                <span className="bar-label">
                  <strong>{task?.title ?? d.taskId}</strong>
                  <small>
                    {shortDate(d.decidedAt)} · {d.rank ? `kandidat #${d.rank}` : "override"}
                  </small>
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${ratio * 100}%` }} />
                  <span className={`bar-tip ${ratio > 0.6 ? "flip" : ""}`} style={{ left: `${ratio * 100}%` }} role="tooltip">
                    <strong>{minutes(d.decisionMs)}</strong> · {saved >= 0 ? `${saved} menit lebih cepat dari manual` : `${-saved} menit lebih lama dari manual`}
                  </span>
                </span>
                <span className="bar-value">{number(Math.round(d.decisionMs / 60_000))} mnt</span>
              </div>
            );
          })}
        </div>
        <p className="small muted spaced with-icon">
          <Icon icon={Timer} size={13} />
          Tb diukur dengan stopwatch sebelum pilot; Tp dicatat sistem dari tugas dibuka sampai ditetapkan.
        </p>
      </section>
      {editingTb && (
        <Modal title="Ubah baseline waktu manual (Tb)" onClose={() => setEditingTb(false)}>
          <form noValidate onSubmit={(e) => void saveBaseline(e)}>
            <p className="dialog-summary">Rata-rata waktu penugasan manual sebelum memakai Pantara (dalam menit).</p>
            <label className="field">
              <span className="field-label">Baseline manual (menit)</span>
              <input
                className="input"
                type="number"
                min={1}
                max={240}
                value={tbDraft}
                onChange={(e) => {
                  setTbDraft(e.target.value);
                  setTbError("");
                }}
              />
            </label>
            {tbError && (
              <p className="field-error spaced" role="alert">
                {tbError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setEditingTb(false)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan baseline"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
