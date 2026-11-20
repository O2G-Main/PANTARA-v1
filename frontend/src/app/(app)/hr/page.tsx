"use client";

import Link from "next/link";
import { Building2, UserCheck, Users } from "lucide-react";
import { MetricCard, PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";

export default function HrPage() {
  const { members, divisions, tasks } = useDemo();
  const missingAvailability = members.filter((member) => member.availableHours === null);
  const missingDivision = members.filter((member) => !member.division?.trim());
  const divisionCount = new Set([...(divisions ?? []), ...members.map((member) => member.division?.trim()).filter(Boolean)]).size;
  const freelancerCount = members.filter((member) => member.employmentType === "freelancer").length;
  const attention = members.filter((member) => member.availableHours === null || !member.division?.trim() || !member.competencies.length);

  return <div className="page-enter">
    <PageHeading title="Dashboard HR" subtitle="Ringkasan organisasi dan data yang perlu ditindaklanjuti." actions={<Link className="button primary" href="/hr/anggota">Kelola anggota</Link>} />
    <div className="metrics-grid three">
      <MetricCard icon={Users} label="Anggota" value={String(members.length)} unit="orang" note={`${members.length - freelancerCount} karyawan · ${freelancerCount} freelancer`} href="/hr/anggota" />
      <MetricCard icon={Building2} label="Divisi" value={String(divisionCount)} unit="divisi" note={`${missingDivision.length} anggota belum ditempatkan`} href="/hr/tim" />
      <MetricCard icon={UserCheck} label="Ketersediaan terisi" value={String(members.length - missingAvailability.length)} unit={`dari ${members.length} orang`} note={`${missingAvailability.length} anggota belum mengisi`} tone="brand" href="/hr/anggota" />
    </div>
    <section className="card"><SectionTitle title="Perlu ditindaklanjuti" subtitle="Lengkapi data agar informasi tim tetap akurat." action={<Link className="inline-link" href="/hr/anggota">Lihat anggota</Link>} />
      {attention.length ? attention.map((member) => <div className="hr-team-member" key={member.id}><Person member={member} /><span className="muted">{[!member.division?.trim() && "Divisi belum diisi", member.availableHours === null && "Ketersediaan belum diisi", !member.competencies.length && "Kompetensi belum diisi"].filter(Boolean).join(" · ")}</span></div>) : <p className="muted">Tidak ada data yang perlu dilengkapi.</p>}
    </section>
    <section className="card spaced"><SectionTitle title="Riwayat kerja" subtitle={`${tasks.filter((task) => task.status === "selesai").length} tugas selesai tercatat`} action={<Link className="inline-link" href="/hr/riwayat">Lihat riwayat & performa</Link>} /></section>
  </div>;
}
