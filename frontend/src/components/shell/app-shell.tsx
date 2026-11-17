"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight, CircleHelp, Menu, X } from "lucide-react";
import { lockScroll } from "@/lib/scroll-lock";
import { navigationForRole, PAGES, SUBNAV, activeNav, activeSub, canAccess, trailOf, type PageRoute } from "@/lib/nav";
import { Badge, Icon, Modal } from "@/components/ui";
import { DATA_MODE } from "@/lib/api";
import { noticesFor } from "@/lib/demo/notifications";
import { useDemo } from "@/lib/demo/store";
import { logoutSession, useSession, useSessionReady, type Account } from "@/lib/session";
import { BrandLockup, BrandWordmark } from "./brand";

// Port shell template Soft Op Dashboard (acuan: K-DASP/MilkGraph components/shell/app-shell.tsx).

const DEFAULT_PERIOD = { label: "Periode aktif", range: DATA_MODE === "api" ? "Memuat..." : "28 Sep - 2 Okt 2026" };

type Panel = "period" | "notifications" | "profile" | "help";

/** Shell hanya tampil untuk sesi yang sah; tanpa sesi diarahkan ke Masuk, halaman di luar peran ke 403/beranda. */
export function AppShell({ children }: { children: ReactNode }) {
  const account = useSession();
  const ready = useSessionReady();
  const guarded = <Suspense fallback={null}><Guard account={account} ready={ready}>{children}</Guard></Suspense>;
  return account ? <Shell account={account}>{guarded}</Shell> : <div className="app-boot" aria-busy="true">{guarded}</div>;
}

function Guard({ account, ready, children }: { account: Account | null | undefined; ready: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = !!account && canAccess(account.role, pathname);
  useEffect(() => {
    if (!ready) return;
    if (account === null) router.replace("/masuk");
    else if (account && !allowed) router.replace(account.role === "karyawan" || account.role === "anggota" ? "/403" : account.home);
  }, [account, ready, allowed, router]);
  return allowed ? children : null;
}

function Shell({ account, children }: { account: Account; children: ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const demo = useDemo();
  const derivedNotices = noticesFor(demo, account);
  const notices = [
    ...demo.serverNotifications.map((n) => ({ id: n.id, title: n.title, subtitle: n.subtitle, href: n.href })),
    ...derivedNotices.filter((d) => !demo.serverNotifications.some((s) => s.id === d.id)),
  ];
  const unread = notices.filter(n => !demo.readNotifications.includes(n.id));
  const isEmployee = account.role === "karyawan" || account.role === "anggota";
  const navigation = navigationForRole(account.role);
  const activePeriod = demo.period
    ? { label: demo.period.isActive ? "Periode aktif" : "Periode arsip", range: demo.period.label }
    : DEFAULT_PERIOD;
  const periodChoices = demo.periods.length
    ? demo.periods
    : [{ id: "default", label: DEFAULT_PERIOD.range, isActive: true, code: "AKTIF", start: "", end: "" }];
  const hoursPerWeek = demo.organization?.hoursPerWeek ?? 32;

  useEffect(() => {
    if (!drawer) return;
    const node = drawerRef.current;
    const trigger = menuButton.current;
    const unlock = lockScroll();
    node?.showModal();
    const media = window.matchMedia("(min-width: 768px)");
    const close = () => { if (media.matches) setDrawer(false); };
    media.addEventListener("change", close);
    return () => { node?.close(); unlock(); media.removeEventListener("change", close); trigger?.focus(); };
  }, [drawer]);

  const closeDrawer = () => setDrawer(false);
  const openPanel = (next: Panel) => { setDrawer(false); setPanel(next); };

  function renderNavigation(mobile = false) {
    return <>
      <div className="brand-row">
        <Link href={account.home} className="brand" aria-label="Pantara, ke beranda ruang kerja" onClick={closeDrawer}>
          <BrandLockup />
        </Link>
        {mobile && <button className="icon-button" aria-label="Tutup menu" onClick={closeDrawer}><Icon icon={X} /></button>}
      </div>
      <Suspense fallback={<NavLinks navigation={navigation} pathname="" onNavigate={closeDrawer} />}>
        <CurrentNavLinks navigation={navigation} onNavigate={closeDrawer} />
      </Suspense>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => openPanel("help")} aria-label="Panduan">
          <span className="nav-icon"><Icon icon={CircleHelp} size={19} /></span><span className="nav-label">Panduan</span>
        </button>
        <button className="account" onClick={() => openPanel("profile")} aria-label={`Lihat akun ${account.name}`}>
          <span className="avatar">{account.initials}</span>
          <span className="account-copy nav-label"><strong>{account.name}</strong><span>{account.title}</span></span>
          <Icon icon={ChevronDown} size={15} className="nav-label" />
        </button>
      </div>
    </>;
  }

  return <div className={`app-frame ${collapsed === null ? "auto-sidebar" : collapsed ? "collapsed" : "expanded"}`}>
    <a className="skip-link" href="#main-content">Lewati ke konten</a>
    <aside className="sidebar" id="desktop-navigation">{renderNavigation()}</aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-start">
          <button className="icon-button desktop-toggle" aria-label="Buka atau ciutkan sidebar" aria-expanded={collapsed === null ? undefined : !collapsed} aria-controls="desktop-navigation" onClick={() => setCollapsed(collapsed === null ? window.innerWidth >= 1200 : !collapsed)}>
            <Icon icon={collapsed === false ? ChevronsLeft : ChevronsRight} />
          </button>
          <button ref={menuButton} className="icon-button mobile-menu" aria-label="Buka menu" aria-expanded={drawer} aria-controls="mobile-navigation" onClick={() => setDrawer(true)}><Icon icon={Menu} /></button>
          <Link href={account.home} className="mobile-brand" aria-label="Pantara, ke beranda ruang kerja">
            <BrandWordmark />
          </Link>
          <Suspense fallback={<span className="breadcrumb">Ruang kerja</span>}>
            <Breadcrumb />
          </Suspense>
        </div>
        <div className="topbar-actions">
          <button className="shift-button" onClick={() => setPanel("period")}>
            <Icon icon={CalendarDays} size={16} /><span>{activePeriod.label}<span className="period-date">, {activePeriod.range}</span></span><Icon icon={ChevronDown} size={14} />
          </button>
          <button className="icon-button notification" aria-label={`Lihat ${unread.length} notifikasi belum dibaca`} onClick={() => setPanel("notifications")}><Icon icon={Bell} />{unread.length > 0 && <span>{unread.length}</span>}</button>
          <button className="avatar top-avatar" aria-label="Lihat profil" onClick={() => setPanel("profile")}>{account.initials}</button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={null}><BackLink /></Suspense>
        {children}
      </main>
      <footer className="workspace-footer">
        <span>Pantara <span className="footer-divider">/</span> Orkestrasi kerja adaptif</span>
        <span>Diperbarui {demo.now ? new Date(demo.now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "09.15"} WIB <span className="status-dot" /></span>
      </footer>
    </div>
    {drawer && <dialog ref={drawerRef} id="mobile-navigation" aria-label="Menu navigasi" className="mobile-drawer" onCancel={closeDrawer} onClick={e => { if (e.target === e.currentTarget) closeDrawer(); }}><div className="drawer-content">{renderNavigation(true)}</div></dialog>}
    {panel && <Modal title={{ period: "Pilih periode", notifications: "Notifikasi", profile: "Profil pengguna", help: "Panduan" }[panel]} onClose={() => setPanel(null)}>
      {panel === "period" && <>
        <p className="muted">{periodChoices.length > 1 ? "Pilih periode kerja untuk meninjau beban dan tugas:" : "Baru satu periode kerja yang tersedia."}</p>
        {periodChoices.map((p) => {
          const current = (demo.period?.id ?? "default") === p.id;
          return (
            <button key={p.id} className="period-choice" onClick={() => { if (demo.periods.length) void demo.setPeriod(p.id); setPanel(null); }}>
              <strong>{p.isActive ? "Periode aktif" : "Periode lain"}</strong>
              <span>{p.label} · {hoursPerWeek} jam per karyawan</span>
              {current ? <Badge tone="ok">Dipilih</Badge> : p.isActive ? <Badge tone="neutral">Aktif</Badge> : null}
            </button>
          );
        })}
        {account.role === "admin" && <p className="small spaced"><Link className="inline-link" href="/pengaturan" onClick={() => setPanel(null)}>Kelola periode di Pengaturan umum</Link></p>}
      </>}
      {panel === "notifications" && <div className="notification-list">
        {notices.length ? notices.map(n => <Link key={n.id} href={n.href} onClick={() => { void demo.markNoticeRead(n.id); setPanel(null); }}><span><strong>{n.title}</strong><span>{n.subtitle}</span></span><Icon icon={ArrowUpRight} /></Link>) : <p className="muted">Tidak ada notifikasi.</p>}
      </div>}
      {panel === "profile" && <div className="profile-info">
        <span className="avatar large">{account.initials}</span>
        <h3>{account.name}</h3>
        <p>{account.title}</p>
        <p className="small muted">{account.email}</p>
        <p className="muted">Rekomendasi membantu, kamu yang memutuskan. Data jam kerja bukan ukuran produktivitas.</p>
        <div className="profile-links">
          <Link className="button secondary" href="/akun" onClick={() => setPanel(null)}>Akun saya</Link>
          <Link className="button secondary" href="/notifikasi" onClick={() => setPanel(null)}>Semua notifikasi</Link>
          <button type="button" className="button secondary" onClick={() => { void logoutSession().then(() => { setPanel(null); router.push("/masuk", { transitionTypes: ["to-login"] }); }); }}>Keluar</button>
        </div>
      </div>}
      {panel === "help" && <>
        {isEmployee ? <>
          <p>Menjawab penugasan dan menjaga data kerjamu.</p>
          <ol className="guide-list">
            <li><strong>Cek penugasan baru</strong><p>Beranda saya menampilkan penugasan yang menunggu jawabanmu beserta alasan kamu dipilih.</p></li>
            <li><strong>Terima atau tolak</strong><p>Menolak wajib dengan alasan supaya manajer bisa mencari kandidat lain.</p></li>
            <li><strong>Isi ketersediaan</strong><p>Jam tersedia dan cuti dipakai untuk menghitung kapasitasmu.</p></li>
            <li><strong>Rawat profil kerja</strong><p>Kompetensi dan preferensi yang kamu isi ikut menentukan rekomendasi.</p></li>
          </ol>
        </> : <>
          <p>Alur penugasan dari tugas baru sampai keputusan.</p>
          <ol className="guide-list">
            <li><strong>Buat tugas</strong><p>Tulis judul, deskripsi, tenggat, dan prioritas seperti biasa.</p></li>
            <li><strong>Tinjau kebutuhan (Analisis kebutuhan)</strong><p>Periksa kompetensi, estimasi, dan dependensi. Isian yang ragu ditandai untuk dicek.</p></li>
            <li><strong>Bandingkan kandidat</strong><p>Tiga kandidat teratas beserta skor dan alasan per faktor.</p></li>
            <li><strong>Simulasi lalu tetapkan</strong><p>Lihat akibat ke kapasitas karyawan sebelum menetapkan. Keputusan tetap di manajer.</p></li>
          </ol>
        </>}
        <p className="small muted spaced"><Link className="inline-link" href="/bantuan" onClick={() => setPanel(null)}>Buka halaman bantuan</Link></p>
      </>}
    </Modal>}
  </div>;
}

// usePathname butuh Suspense di rute ber-param dinamis (Next 16 cacheComponents).
type Navigation = { group: string; routes: PageRoute[] }[];

function CurrentNavLinks({ navigation, onNavigate }: { navigation: Navigation; onNavigate: () => void }) {
  return <NavLinks navigation={navigation} pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavLinks({ navigation, pathname, onNavigate }: { navigation: Navigation; pathname: string; onNavigate: () => void }) {
  const current = activeNav(pathname, navigation);
  return <nav aria-label="Navigasi utama">
    {navigation.map(({ group, routes }) => <div className="nav-group" key={group}>
      <p className="group-title nav-label">{group}</p>
      {routes.map(href => {
        const item = PAGES[href];
        const active = current === href;
        const sub = SUBNAV[href];
        const link = <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`} title={`${item.label} · ${group}`} aria-label={`${item.label}, grup ${group}`} aria-current={active && !sub ? "page" : undefined} onClick={onNavigate}>
          <span className="nav-icon"><Icon icon={item.icon} size={19} /></span>
          <span className="nav-label">{item.label}</span>
        </Link>;
        return sub ? <div key={href}>{link}<NavBranch items={sub} open={active} current={activeSub(pathname)} onNavigate={onNavigate} /></div> : link;
      })}
    </div>)}
  </nav>;
}

// Geometri cabang (px): batang di tengah ikon menu induk, cabang melengkung ke tiap baris anak.
const ROW = 36, PAD = 4, TRUNK = 22, END = 36, R = 8;
const rowY = (k: number) => PAD + k * ROW + ROW / 2;
const branchPath = (k: number) => `M ${TRUNK} ${rowY(k) - R} A ${R} ${R} 0 0 0 ${TRUNK + R} ${rowY(k)} H ${END}`;
const reachPath = (k: number) => `M ${TRUNK} 0 V ${rowY(k) - R} A ${R} ${R} 0 0 0 ${TRUNK + R} ${rowY(k)} H ${END}`;
const reachLength = (k: number) => rowY(k) - R + (Math.PI * R) / 2 + (END - TRUNK - R);

/** Sub-menu bercabang (pola React Bits "BranchedMenu", disesuaikan ke token & lucide; 03-ARCHITECTURE Q21). */
function NavBranch({ items, open, current, onNavigate }: { items: NonNullable<(typeof SUBNAV)[PageRoute]>; open: boolean; current?: string; onNavigate: () => void }) {
  const height = PAD * 2 + items.length * ROW;
  return <div className="nav-branch" data-open={open || undefined} inert={!open}>
    <div className="nav-branch-fold"><div className="nav-branch-tree" style={{ height }}>
      <svg className="nav-branch-lines" width={END + 4} height={height} aria-hidden="true">
        <path className="nav-branch-base" d={`M ${TRUNK} 0 V ${rowY(items.length - 1) - R}`} />
        {items.map((it, k) => <path key={it.href} className="nav-branch-base" d={branchPath(k)} />)}
        {items.map((it, k) => <path key={`${it.href}-on`} className="nav-branch-reach" d={reachPath(k)} style={{ strokeDasharray: reachLength(k), strokeDashoffset: current === it.href ? 0 : reachLength(k) }} />)}
      </svg>
      {items.map(it => <Link key={it.href} href={it.href} className={`nav-sub ${current === it.href ? "active" : ""}`} title={it.label} aria-current={current === it.href ? "page" : undefined} onClick={onNavigate}>
        <span className="nav-sub-icon"><Icon icon={it.icon} size={15} /></span><span className="nav-sub-label">{it.label}</span>
      </Link>)}
    </div></div>
  </div>;
}

function Breadcrumb() {
  const { trail } = trailOf(usePathname());
  const { memberById, projectById } = useDemo();
  const label = (c: (typeof trail)[number]) => {
    if (c.entity?.kind === "tim") return memberById(c.entity.id)?.name ?? c.label;
    if (c.entity?.kind === "proyek") return projectById(c.entity.id)?.name ?? c.label;
    return c.label;
  };
  return <nav className="breadcrumb" aria-label="Posisi halaman"><ol>{trail.map((c, i) => <li key={i}>
    {i > 0 && <span aria-hidden="true">/</span>}
    {i === trail.length - 1 ? <strong aria-current="page">{label(c)}</strong> : c.href ? <Link href={c.href}>{c.entity ? c.label : label(c)}</Link> : <span>{c.label}</span>}
  </li>)}</ol></nav>;
}

/** Tombol kembali ke halaman induk (tidak tampil di halaman tingkat atas dan tab sub-menu). */
function BackLink() {
  const { back } = trailOf(usePathname());
  if (!back?.href) return null;
  return <Link href={back.href} className="back-link"><Icon icon={ChevronLeft} size={16} />Kembali ke {back.label}</Link>;
}
