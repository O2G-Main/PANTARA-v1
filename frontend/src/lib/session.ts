"use client";

import { useSyncExternalStore } from "react";
import { api, DATA_MODE, type AuthUser, type NotifyPrefs } from "@/lib/api";

type Role = "admin" | "manajer" | "anggota" | "karyawan" | "hr";

export interface Account {
  id?: string;
  organizationId?: string;
  email: string;
  name: string;
  title: string;
  initials: string;
  role: Role;
  home: "/dashboard" | "/saya" | "/hr";
  memberId?: string;
  notifyPrefs?: NotifyPrefs;
}

const KEY = "pantara.session.email";

const MOCK_ACCOUNTS: Record<string, Account> = {
  "krisna@pantara.id": {
    email: "krisna@pantara.id",
    name: "Krisna Panca",
    title: "Kepala Divisi Teknis",
    initials: "KP",
    role: "admin",
    home: "/dashboard",
  },
  "manajer@pantara.id": {
    email: "manajer@pantara.id",
    name: "Nadia Kusuma",
    title: "Manajer Proyek",
    initials: "NK",
    role: "manajer",
    home: "/dashboard",
  },
  "hr@pantara.id": {
    email: "hr@pantara.id",
    name: "Nadia Putri",
    title: "Human Resources",
    initials: "NP",
    role: "hr",
    home: "/hr",
  },
  "bima@pantara.id": {
    email: "bima@pantara.id",
    name: "Bima Pradana",
    title: "Pengembang backend",
    initials: "BP",
    role: "anggota",
    home: "/saya",
    memberId: "bima",
  },
};

const PASSWORDS: Record<string, string> = {
  "krisna@pantara.id": "pantara2026",
  "manajer@pantara.id": "pantara2026",
  "bima@pantara.id": "pantara2026",
  "hr@pantara.id": "pantara2026",
};

const listeners = new Set<() => void>();
let apiAccount: Account | null = null;
let apiReady = DATA_MODE === "mock";
let inflightHydrate: Promise<Account | null> | null = null;

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (typeof window === "undefined") {
    return () => listeners.delete(fn);
  }
  if (DATA_MODE === "api" && !apiReady && !inflightHydrate) {
    void hydrateSession();
  }
  const onStorage = () => fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function defaultTitle(role: AuthUser["role"]): string {
  if (role === "admin") return "Admin Ruang Kerja";
  if (role === "manajer") return "Manajer Proyek";
  return "Anggota Tim";
}

export function authUserToAccount(user: AuthUser): Account {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    title: defaultTitle(user.role),
    initials: initialsOf(user.name),
    role: user.role,
    home: user.home,
    memberId: user.memberId,
    notifyPrefs: user.notifyPrefs,
  };
}

export function setSessionUser(user: AuthUser | null): void {
  apiAccount = user ? authUserToAccount(user) : null;
  apiReady = true;
  emit();
}

async function hydrateSession(force = false): Promise<Account | null> {
  if (DATA_MODE !== "api") {
    apiReady = true;
    return readMockAccount();
  }
  if (inflightHydrate && !force) return inflightHydrate;
  inflightHydrate = (async () => {
    try {
      const res = await api.auth.me();
      apiAccount = authUserToAccount(res.user);
      return apiAccount;
    } catch {
      try {
        const refreshed = await api.auth.refresh();
        apiAccount = authUserToAccount(refreshed.user);
        return apiAccount;
      } catch {
        apiAccount = null;
        return null;
      }
    } finally {
      apiReady = true;
      inflightHydrate = null;
      emit();
    }
  })();
  return inflightHydrate;
}

export async function loginWithApi(email: string, password: string, rememberMe: boolean): Promise<Account> {
  const res = await api.auth.login({ email: email.trim().toLowerCase(), password, rememberMe });
  const acc = authUserToAccount(res.user);
  apiAccount = acc;
  apiReady = true;
  emit();
  return acc;
}

export async function registerWithApi(input: {
  orgName: string;
  name: string;
  email: string;
  password: string;
}): Promise<Account> {
  const res = await api.auth.register({
    orgName: input.orgName.trim(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  const acc = authUserToAccount(res.user);
  apiAccount = acc;
  apiReady = true;
  emit();
  return acc;
}

export async function acceptInviteWithApi(input: {
  token: string;
  name: string;
  password: string;
}): Promise<Account> {
  const res = await api.auth.acceptInvite({
    token: input.token,
    name: input.name.trim(),
    password: input.password,
  });
  const acc = authUserToAccount(res.user);
  apiAccount = acc;
  apiReady = true;
  emit();
  return acc;
}

export async function logoutSession(): Promise<void> {
  if (DATA_MODE === "api") {
    try {
      await api.auth.logout();
    } catch {
      // Clear local session state even if network call fails
    }
    apiAccount = null;
    apiReady = true;
    emit();
    return;
  }
  clearSession();
}

export function authenticate(email: string, password: string): Account | null {
  const key = email.trim().toLowerCase();
  if (PASSWORDS[key] !== password) return null;
  return MOCK_ACCOUNTS[key] ?? null;
}

function readMockAccount(): Account | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  return email ? MOCK_ACCOUNTS[email] ?? null : null;
}

export function saveSession(email: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
  (remember ? localStorage : sessionStorage).setItem(KEY, email);
  emit();
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  if (DATA_MODE === "api") {
    apiAccount = null;
    emit();
    return;
  }
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
  emit();
}

export function useSession(): Account | null {
  return useSyncExternalStore(
    subscribe,
    () => (DATA_MODE === "api" ? apiAccount : readMockAccount()),
    () => null,
  );
}

export function useSessionReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (DATA_MODE === "api" ? apiReady : true),
    () => false,
  );
}
