"use client";

import { Paged } from "@/components/ui/pager";
import Link from "next/link";
import { useState } from "react";
import { CalendarOff, Clock3, Gauge, ShieldAlert } from "lucide-react";
import { CapacityBar, DataBadge, MetricCard, PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { Badge, Icon } from "@/components/ui";
import { AWAITING_BACKEND, AWAITING_BACKEND_NOTE } from "@/lib/api";
import { PERIOD } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import { weeklyLoad } from "@/lib/engine/capacity";
import { decideLeave } from "@/lib/engine/leave";
import { allocatedHours } from "@/lib/engine/score";
import { utilTone } from "@/lib/engine/whatif";
import { hours, number, percent, shortDate } from "@/lib/format";

type Filter = "semua" | "aman" | "penuh" | "belum";

export function Capacity() {
  const { members, tasks, period, today, settings, dispatch } = useDemo();
  const reserve = settings.reserveRatio ?? 0;
  const leaveQueue = members.flatMap((m) => (m.leaveRequests ?? []).filter((r) => r.manager === "menunggu" && r.hr !== "ditolak").map((r) => ({ m, r })));
  const [filter, setFilter] = useState<Filter>("semua");
  const rows = members.map((m) => {
    const allocated = allocatedHours(m.id, tasks);
    const util = m.availableHours ? allocated / m.availableHours : 0;
    const group: Filter = m.availableHours === null ? "belum" : util >= 0.85 ? "penuh" : "aman";
    return { m, allocated, util, group };
  });
  const filled = rows.filter((r) => r.m.availableHours !== null);
  const capacity = filled.reduce((s, r) => s + (r.m.availableHours ?? 0), 0);
  const allocated = filled.reduce((s, r) => s + r.allocated, 0);
  const missing = rows.filter((r) => r.group === "belum");
  const count = (f: Filter) => (f === "semua" ? rows.length : rows.filter((r) => r.group === f).length);
  const shown = rows.filter((r) => filter === "semua" || r.group === filter);
  const people = filled.map((r) => r.m);
  const weeks = people.length ? weeklyLoad(people[0], [], today).map((w) => w.start) : [];
  const periodLabel = period?.label ?? PERIOD.label;

  return (
    <div className="page-enter">
      <PageHeading
        title="Kapasitas"
        subtitle="Alokasi waktu dan ketersediaan kerja semua karyawan dalam periode aktif. Jam kerja, bukan ukuran produktivitas pribadi."
      />
      <div className="metrics-grid three">
        <MetricCard icon={Clock3} label="Total kapasitas tersedia" value={number(capacity)} unit="jam" note={`Dari ${filled.length} karyawan dengan data terisi`} />
        <MetricCard
          icon={Gauge}
          label="Total teralokasi"
          value={number(allocated)}
          unit={`/ ${number(capacity)} jam · ${capacity ? percent(allocated / capacity, 1) : "0%"}`}
          note={`Sisa ${number(Math.max(0, capacity * (1 - reserve) - allocated))} jam untuk penugasan biasa, cadangan ${number(capacity * reserve)} jam`}
          tone="brand"
        />
        <MetricCard
          icon={ShieldAlert}
          label="Status ketersediaan data"
          value={`${filled.length} dari ${members.length}`}
          unit="terisi"
          note={missing.length ? `${missing.map((r) => r.m.name).join(", ")} belum mengisi periode ini` : "Semua karyawan sudah mengisi"}
          tone={missing.length ? "warn" : undefined}
        />
      </div>
      {leaveQueue.length > 0 && (
        <section className="card spaced">
          <SectionTitle
            title="Pengajuan cuti"
            subtitle="Cuti berlaku setelah manajer dan HR sama-sama setuju. Persetujuan HR ada di Inbox HR."
            action={<Badge tone="warn">{leaveQueue.length} menunggu</Badge>}
          />
          {leaveQueue.map(({ m, r }) => (
            <div key={r.id} className="dna-row">
              <span>
                <Person member={m} />
                <span className="table-sub with-icon">
                  <Icon icon={CalendarOff} size={13} />
                  {r.type} · {shortDate(r.start)}
                  {r.end !== r.start ? ` - ${shortDate(r.end)}` : ""} · HR: {r.hr}
                </span>
                <span className="table-sub">{r.reason}</span>
              </span>
              <span className="page-actions">
                <button type="button" className="button secondary" disabled={AWAITING_BACKEND} onClick={() => dispatch({ type: "upsertMember", member: decideLeave(m, r.id, "manager", false) })}>
                  Tolak
                </button>
                <button type="button" className="button primary" disabled={AWAITING_BACKEND} onClick={() => dispatch({ type: "upsertMember", member: decideLeave(m, r.id, "manager", true) })}>
                  Setujui
                </button>
              </span>
            </div>
          ))}
          {AWAITING_BACKEND && <p className="small muted spaced">{AWAITING_BACKEND_NOTE}</p>}
        </section>
      )}
      <section className="card spaced">
        <SectionTitle
          title="Kapasitas cadangan"
          subtitle="Porsi jam tersedia tiap karyawan yang disisakan untuk tugas mendadak. Rekomendasi tugas prioritas normal dan rendah tidak memakainya; tugas prioritas tinggi boleh."
        />
        <label className="field">
          <span className="field-label">Cadangan: {Math.round(reserve * 100)}% ({number(capacity * reserve)} jam tim)</span>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={Math.round(reserve * 100)}
            disabled={AWAITING_BACKEND}
            onChange={(e) => dispatch({ type: "settings", settings: { ...settings, reserveRatio: Number(e.target.value) / 100 } })}
          />
        </label>
        {AWAITING_BACKEND && <p className="small muted spaced">{AWAITING_BACKEND_NOTE}</p>}
      </section>
      <section className="card spaced">
        <div className="toolbar">
          <div className="toggle" role="group" aria-label="Filter kapasitas">
            {(
              [
                ["semua", "Semua karyawan"],
                ["aman", "Kapasitas aman"],
                ["penuh", "Mendekati penuh"],
                ["belum", "Ketersediaan belum diisi"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className={filter === v ? "selected" : ""} aria-pressed={filter === v} onClick={() => setFilter(v)}>
                {l} ({count(v)})
              </button>
            ))}
          </div>
          <span className="small muted">Periode {periodLabel} · mingguan</span>
        </div>
        <Paged items={shown} unit="karyawan">
          {(paged) => (
            <div className="table-scroll stack-table capacity-table">
              <table>
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th className="numeric">Tersedia</th>
                    <th className="numeric">Teralokasi</th>
                    <th className="numeric">Sisa waktu</th>
                    <th>Visualisasi kapasitas</th>
                    <th className="numeric">Terisi</th>
                    <th>Status data</th>
                    <th className="numeric">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(({ m, allocated: a, util }) => (
                    <tr key={m.id} className={m.availableHours === null ? "row-highlight" : ""}>
                      <td>
                        <Person member={m} />
                      </td>
                      <td data-label="Tersedia" className="numeric">
                        {m.availableHours === null ? <span className="muted">Belum diisi</span> : hours(m.availableHours)}
                      </td>
                      <td data-label="Teralokasi" className="numeric">
                        <strong>{hours(a)}</strong>
                      </td>
                      <td data-label="Sisa" className="numeric">
                        {m.availableHours === null ? "-" : hours(m.availableHours - a)}
                      </td>
                      <td data-label="Kapasitas">
                        <CapacityBar allocated={a} available={m.availableHours} />
                      </td>
                      <td data-label="Terisi" className="numeric">
                        {m.availableHours === null ? "-" : percent(util, 1)}
                      </td>
                      <td data-label="Status data">
                        <DataBadge complete={m.availableHours !== null} />
                      </td>
                      <td className="numeric">
                        <Link className="row-link" href={`/tim/${m.id}`}>
                          Rincian alokasi
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
        <div className="table-footer">
          <span className="legend">
            <span>
              <span className="legend-square accent" />
              Teralokasi pada tugas aktif
            </span>
            <span>
              <span className="legend-square neutral" />
              Tersedia
            </span>
          </span>
          <span>Jam kerja, bukan ukuran produktivitas pribadi</span>
        </div>
      </section>
      <section className="card spaced">
        <SectionTitle
          title="Proyeksi 4 minggu"
          subtitle="Sisa jam tugas aktif disebar rata ke hari kerja sampai tenggat. Asumsi: ketersediaan minggu depan sama dengan minggu ini, dikurangi cuti."
        />
        <Paged items={people} unit="karyawan">
          {(paged) => (
            <div className="table-scroll stack-table projection-table">
              <table>
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    {weeks.map((w) => (
                      <th key={w} className="numeric">
                        Minggu {shortDate(w)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Person member={m} />
                      </td>
                      {weeklyLoad(m, tasks, today).map((w) => {
                        const util = w.capacity ? w.hours / w.capacity : 0;
                        const tone = utilTone(util);
                        return (
                          <td key={w.start} data-label={`Minggu ${shortDate(w.start)}`} className="numeric">
                            <span className={tone === "ok" ? "" : `${tone}-text`}>
                              {number(Math.round(w.hours))} / {number(Math.round(w.capacity))} jam
                            </span>
                            <div className={`capacity-bar ${tone === "ok" ? "" : tone}`} role="img" aria-label={`Terisi ${percent(util)}`}>
                              <span style={{ width: `${Math.min(util, 1) * 100}%` }} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
      </section>
    </div>
  );
}
