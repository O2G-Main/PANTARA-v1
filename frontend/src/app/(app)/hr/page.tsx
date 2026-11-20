"use client";

import { ClipboardCheck, UserCheck, Users } from "lucide-react";
import { MetricCard, PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";

export default function HrPage() {
  const { members, tasks } = useDemo();
  const complete = members.filter((member) => member.availableHours !== null).length;
  const completedTasks = tasks.filter((task) => task.status === "selesai").length;

  return (
    <div className="page-enter">
      <PageHeading title="Dashboard HR" subtitle="Pantau data karyawan dan riwayat pekerjaan tim." />
      <div className="metrics-grid three">
        <MetricCard icon={Users} label="Anggota tim" value={String(members.length)} unit="orang" note="Profil anggota tercatat" />
        <MetricCard icon={UserCheck} label="Ketersediaan terisi" value={String(complete)} unit={`dari ${members.length} orang`} note="Pada periode aktif" tone="brand" />
        <MetricCard icon={ClipboardCheck} label="Tugas selesai" value={String(completedTasks)} unit="tugas" note="Riwayat pekerjaan tercatat" />
      </div>
      <section className="card">
        <SectionTitle title="Data dan riwayat kerja" subtitle="Kelola profil anggota dan tinjau pekerjaan yang tercatat." />
        {members.length ? (
          <div>
            {members.map((member) => (
              <div className="toolbar" key={member.id}>
                <Person member={member} />
                <span>{member.availableHours === null ? "Ketersediaan belum diisi" : `${member.availableHours} jam tersedia`}</span>
              </div>
            ))}
          </div>
        ) : <p>Belum ada anggota yang tercatat.</p>}
      </section>
    </div>
  );
}
