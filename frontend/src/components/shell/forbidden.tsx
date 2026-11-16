"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/app/parts";
import { useSession } from "@/lib/session";

export function Forbidden() {
  const account = useSession();
  const home = account?.home ?? "/masuk";
  const label = home === "/saya" ? "Kembali ke Beranda saya" : home === "/dashboard" ? "Kembali ke Dashboard" : "Masuk";
  return (
    <section className="card">
      <EmptyState
        icon={ShieldAlert}
        title="Akses ditolak"
        text="Halaman ini butuh peran lain. Hubungi admin ruang kerja bila peranmu perlu diperbarui di Karyawan & peran."
        action={<Link className="button secondary" href={home}>{label}</Link>}
      />
    </section>
  );
}
