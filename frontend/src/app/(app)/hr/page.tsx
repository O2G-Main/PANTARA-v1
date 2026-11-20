"use client";

import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { MetricCard, PageHeading, SectionTitle } from "@/components/app/parts";
import { CountUp } from "@/components/hr/count-up";
import { useDemo } from "@/lib/demo/store";
import { gaps, missing, monthlyResults, monthName, statuses } from "@/lib/hr/overview";

export default function HrPage() {
  const { members, divisions, hrRequests = [], performanceReviews = [], period, today } = useDemo();
  const month = (period?.start || today).slice(0, 7);
  const queue = hrRequests.filter(request => !request.handled).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const results = monthlyResults(members, performanceReviews, month);
  const divisionCount = new Set([...(divisions ?? []), ...members.map(member => member.division?.trim()).filter(Boolean)]).size;
  const freelancers = members.filter(member => member.employmentType === "freelancer").length;

  return <div className="page-enter">
    <PageHeading title="Dashboard HR" subtitle="Pantau pengajuan dan tindak lanjut anggota." />
    <section className="card"><SectionTitle title="Pengajuan menunggu" subtitle={queue.length + " pengajuan perlu ditinjau"} action={<Link className="inline-link" href="/hr/inbox">Buka inbox</Link>} />
      {queue.length ? queue.slice(0, 3).map(request => <div className="hr-team-member" key={request.id}>
        <div><strong>{request.title}</strong><p className="muted">{request.sender} · {request.senderRole} · {new Date(request.createdAt).toLocaleString("id-ID")}</p></div>
        <Link className="button" href={"/hr/inbox?request=" + encodeURIComponent(request.id)}>Tinjau</Link>
      </div>) : <p>Semua pengajuan sudah ditindaklanjuti.</p>}
    </section>
    <div className="hr-overview-grid spaced">
      <section className="card"><SectionTitle title="Kelengkapan data anggota" />
        {Object.entries(gaps).map(([key, label]) => <Link className="hr-summary-link" key={key} href={"/hr/anggota?gap=" + key}><span>{label}</span><span><CountUp value={members.filter(member => missing(member, key)).length} /> orang ›</span></Link>)}
      </section>
      <section className="card"><SectionTitle title="Progres penilaian" subtitle={monthName(month)} />
        {Object.entries(statuses).map(([key, label]) => <Link className="hr-summary-link" key={key} href={`/hr/riwayat?month=${month}&status=${key}`}><span>{label}</span><span><CountUp value={results.filter(result => result.status === key).length} /> orang ›</span></Link>)}
      </section>
    </div>
    <div className="hr-overview-grid spaced"><MetricCard icon={Users} label="Anggota" value={String(members.length)} unit="orang" note={`${members.length - freelancers} karyawan · ${freelancers} freelancer`} href="/hr/anggota" />
      <MetricCard icon={Building2} label="Divisi" value={String(divisionCount)} unit="divisi" note="Lihat komposisi tim" href="/hr/tim" /></div>
  </div>;
}
