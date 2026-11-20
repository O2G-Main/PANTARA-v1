import { Suspense, type ReactNode } from "react";

export default function HrLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p role="status">Memuat ruang kerja HR…</p>}>{children}</Suspense>;
}
