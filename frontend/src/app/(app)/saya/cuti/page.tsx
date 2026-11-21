import type { Metadata } from "next";
import { MyLeave } from "@/components/saya/member-area";
import { PAGES } from "@/lib/nav";

export const metadata: Metadata = { title: PAGES["/saya/cuti"].label };

export default function CutiSayaPage() {
  return <MyLeave />;
}
