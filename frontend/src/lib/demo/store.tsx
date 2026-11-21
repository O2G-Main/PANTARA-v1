"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  ApiError,
  DATA_MODE,
  type Organization,
  type ServerNotice,
  type WorkPeriod,
} from "@/lib/api";
import { DEFAULT_SETTINGS, type EngineSettings } from "@/lib/engine/score";
import { useSession } from "@/lib/session";
import { COMPETENCIES, DECISIONS, MEMBERS, NOW, PROJECTS, TASKS } from "./seed";
import type { Assignment, Competency, Decision, Member, HrRequest, PerformanceConfig, PerformanceReview, Project, Task, TaskDna, TaskStatus } from "./types";

export interface DemoState {
  tasks: Task[];
  members: Member[];
  divisions?: string[];
  hrRequests?: HrRequest[];
  performanceConfig?: PerformanceConfig;
  performanceReviews?: PerformanceReview[];
  hrSettings?: { weeklyHours: number; reserveHours: number };
  projects: Project[];
  competencies: Competency[];
  decisions: Decision[];
  settings: EngineSettings;
  readNotifications: string[];
  /** Waktu nyata (ms) manajer mulai memproses tugas, untuk Tp. */
  flowStart: Record<string, number>;
}

type Action =
  | { type: "load"; state: DemoState }
  | { type: "createTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "upsertTask"; task: Task }
  | { type: "removeTask"; id: string }
  | { type: "updateDna"; id: string; dna: TaskDna }
  | { type: "assign"; id: string; assignments: Assignment[]; decision: Decision }
  | { type: "reject"; decision: Decision }
  | { type: "setStatus"; id: string; status: TaskStatus; reason?: string }
  | { type: "sendHrRequest"; request: HrRequest }
  | { type: "requestTaskChange"; id: string; memberId: string; reason: string; request: HrRequest }
  | { type: "handleHrRequest"; id: string }
  | { type: "readHrRequest"; id: string }
  | { type: "performanceConfig"; config: PerformanceConfig }
  | { type: "savePerformanceReview"; review: PerformanceReview }
  | { type: "setHrSettings"; weeklyHours: number; reserveHours: number }
  | { type: "upsertMember"; member: Member }
  | { type: "placeMembers"; ids: string[]; division: string; team?: string }
  | { type: "saveDivision"; name: string; previous?: string }
  | { type: "addCompetency"; competency: Competency }
  | { type: "upsertCompetency"; competency: Competency }
  | { type: "removeCompetency"; id: string }
  | { type: "addProject"; project: Project }
  | { type: "upsertProject"; project: Project }
  | { type: "removeProject"; id: string }
  | { type: "settings"; settings: EngineSettings }
  | { type: "readAll"; ids: string[] }
  | { type: "startFlow"; id: string; at: number };

const MOCK_INITIAL: DemoState = {
  tasks: TASKS,
  members: MEMBERS,
  projects: PROJECTS,
  competencies: COMPETENCIES,
  decisions: DECISIONS,
  settings: DEFAULT_SETTINGS,
  readNotifications: [],
  flowStart: {},
};

const API_EMPTY: DemoState = {
  tasks: [],
  members: [],
  projects: [],
  competencies: [],
  decisions: [],
  settings: DEFAULT_SETTINGS,
  readNotifications: [],
  flowStart: {},
};

const INITIAL: DemoState = DATA_MODE === "api" ? API_EMPTY : MOCK_INITIAL;

const mapTask = (s: DemoState, id: string, fn: (t: Task) => Task) => ({
  ...s,
  tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)),
});

function reducer(s: DemoState, a: Action): DemoState {
  switch (a.type) {
    case "load":
      return a.state;
    case "createTask":
      return { ...s, tasks: [a.task, ...s.tasks.filter((t) => t.id !== a.task.id)] };
    case "upsertTask":
      return {
        ...s,
        tasks: s.tasks.some((t) => t.id === a.task.id)
          ? s.tasks.map((t) => (t.id === a.task.id ? a.task : t))
          : [a.task, ...s.tasks],
      };
    case "removeTask":
      return { ...s, tasks: s.tasks.filter((t) => t.id !== a.id) };
    case "updateTask":
      return mapTask(s, a.id, (t) => ({ ...t, ...a.patch }));
    case "updateDna":
      return mapTask(s, a.id, (t) => ({ ...t, dna: a.dna, remainingHours: a.dna.effortHours }));
    case "reject":
      return { ...s, decisions: [a.decision, ...s.decisions.filter((d) => d.id !== a.decision.id)] };
    case "assign":
      return {
        ...mapTask(s, a.id, (t) => ({ ...t, status: "menunggu", assignments: a.assignments })),
        decisions: [a.decision, ...s.decisions.filter((d) => d.id !== a.decision.id)],
      };
    case "setStatus":
      return mapTask(s, a.id, (t) => ({
        ...t,
        status: a.status,
        responseReason: a.reason ?? t.responseReason,
        assignments: a.status === "belum" ? [] : t.assignments,
        remainingHours: a.status === "selesai" ? 0 : t.remainingHours,
      }));
    case "saveDivision": {
      const divisions = (s.divisions ?? []).filter((name) => name !== a.previous);
      return {
        ...s,
        divisions: [...divisions, a.name],
        members: a.previous ? s.members.map((member) => member.division?.trim() === a.previous ? { ...member, division: a.name } : member) : s.members,
      };
    }
    case "requestTaskChange":
      return { ...mapTask(s, a.id, (task) => ({ ...task, changeRequest: { memberId: a.memberId, reason: a.reason, status: "pending" } })), hrRequests: [a.request, ...(s.hrRequests ?? [])] };
    case "sendHrRequest":
      return { ...s, hrRequests: [a.request, ...(s.hrRequests ?? [])] };
    case "handleHrRequest":
      return { ...s, hrRequests: (s.hrRequests ?? []).map(request => request.id === a.id ? { ...request, read: true, handled: true } : request) };
    case "readHrRequest":
      return { ...s, hrRequests: (s.hrRequests ?? []).map((request) => request.id === a.id ? { ...request, read: true } : request) };
    case "performanceConfig":
      return { ...s, performanceConfig: a.config };
    case "savePerformanceReview":
      return { ...s, performanceReviews: [...(s.performanceReviews ?? []), a.review] };
    case "setHrSettings":
      return { ...s, hrSettings: { weeklyHours: a.weeklyHours, reserveHours: a.reserveHours } };
    case "placeMembers":
      return { ...s, members: s.members.map((member) => a.ids.includes(member.id) ? { ...member, division: a.division, team: a.team ?? member.team } : member) };
    case "upsertMember":
      return {
        ...s,
        members: s.members.some((m) => m.id === a.member.id)
          ? s.members.map((m) => (m.id === a.member.id ? a.member : m))
          : [...s.members, a.member],
      };
    case "addCompetency":
    case "upsertCompetency":
      return {
        ...s,
        competencies: s.competencies.some((c) => c.id === a.competency.id)
          ? s.competencies.map((c) => (c.id === a.competency.id ? a.competency : c))
          : [...s.competencies, a.competency],
      };
    case "removeCompetency":
      return { ...s, competencies: s.competencies.filter((c) => c.id !== a.id) };
    case "addProject":
    case "upsertProject":
      return {
        ...s,
        projects: s.projects.some((p) => p.id === a.project.id)
          ? s.projects.map((p) => (p.id === a.project.id ? a.project : p))
          : [...s.projects, a.project],
      };
    case "removeProject":
      return { ...s, projects: s.projects.filter((p) => p.id !== a.id) };
    case "settings":
      return { ...s, settings: a.settings };
    case "readAll":
      return { ...s, readNotifications: [...new Set([...s.readNotifications, ...a.ids])] };
    case "startFlow":
      return s.flowStart[a.id] ? s : { ...s, flowStart: { ...s.flowStart, [a.id]: a.at } };
  }
}

const KEY = "pantara-workspace-v1";

interface WorkspaceMeta {
  organization: Organization | null;
  period: WorkPeriod | null;
  periods: WorkPeriod[];
  serverNotifications: ServerNotice[];
  today: string;
  now: string;
  loading: boolean;
  error: string | null;
  reload: (periodId?: string) => Promise<void>;
  setPeriod: (periodId: string) => Promise<void>;
  markNoticeRead: (id: string) => Promise<void>;
  markAllNoticesRead: (ids: string[]) => Promise<void>;
}

const DemoContext = createContext<{
  state: DemoState;
  dispatch: (a: Action) => void;
  meta: WorkspaceMeta;
} | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [period, setPeriodState] = useState<WorkPeriod | null>(null);
  const [periods, setPeriods] = useState<WorkPeriod[]>([]);
  const [serverNotifications, setServerNotifications] = useState<ServerNotice[]>([]);
  // Mode mock memakai jam seed (NOW) supaya tenggat contoh tetap relevan; mode api memakai jam server (boot.today).
  const [today, setToday] = useState<string>(() => NOW.slice(0, 10));
  const [now, setNow] = useState<string>(() => NOW);
  const [loading, setLoading] = useState<boolean>(DATA_MODE === "api");
  const [error, setError] = useState<string | null>(null);
  const selectedPeriodRef = useRef<string | undefined>(undefined);
  const flowStartRef = useRef<Record<string, number>>(state.flowStart);

  useEffect(() => {
    flowStartRef.current = state.flowStart;
  }, [state.flowStart]);

  const reload = useCallback(
    async (periodId?: string) => {
      if (DATA_MODE !== "api") return;
      if (!session) {
        dispatch({ type: "load", state: API_EMPTY });
        setOrganization(null);
        setPeriodState(null);
        setPeriods([]);
        setServerNotifications([]);
        setLoading(false);
        setError(null);
        return;
      }
      const targetPeriod = periodId ?? selectedPeriodRef.current;
      selectedPeriodRef.current = targetPeriod;
      try {
        setError(null);
        const [boot, notifs] = await Promise.all([
          api.workspace.bootstrap(targetPeriod),
          api.analytics.notifications().catch(() => ({ notifications: [] as ServerNotice[] })),
        ]);
        setOrganization(boot.organization);
        setPeriodState(boot.period);
        setPeriods(boot.periods ?? []);
        setToday(boot.today);
        setNow(boot.now);
        setServerNotifications(notifs.notifications ?? []);
        dispatch({
          type: "load",
          state: {
            tasks: boot.tasks ?? [],
            members: boot.members ?? [],
            projects: boot.projects ?? [],
            competencies: boot.competencies ?? [],
            decisions: boot.decisions ?? [],
            settings: boot.settings ?? DEFAULT_SETTINGS,
            readNotifications: (notifs.notifications ?? []).filter((n) => n.read).map((n) => n.id),
            flowStart: flowStartRef.current,
          },
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat data ruang kerja.");
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  const setPeriod = useCallback(
    async (periodId: string) => {
      selectedPeriodRef.current = periodId;
      await reload(periodId);
    },
    [reload],
  );

  const markNoticeRead = useCallback(async (id: string) => {
    dispatch({ type: "readAll", ids: [id] });
    if (DATA_MODE !== "api") return;
    setServerNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.analytics.markNotificationRead(id);
    } catch {
      // Biarkan UI responsif; SSE/reload menyinkronkan ulang nanti
    }
  }, []);

  const markAllNoticesRead = useCallback(async (ids: string[]) => {
    dispatch({ type: "readAll", ids });
    if (DATA_MODE !== "api") return;
    setServerNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.analytics.markAllNotificationsRead();
    } catch {
      // Abaikan gangguan sementara
    }
  }, []);

  // Mode mock: simpan state ke sessionStorage seperti M0
  useEffect(() => {
    if (DATA_MODE !== "mock") return;
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) dispatch({ type: "load", state: JSON.parse(saved) as DemoState });
    } catch {
      /* sessionStorage tidak tersedia */
    }
  }, []);

  useEffect(() => {
    if (DATA_MODE !== "mock") return;
    if (state === INITIAL) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* abaikan */
    }
  }, [state]);

  // Mode API: muat bootstrap saat sesi aktif & buka stream SSE notifikasi real-time
  useEffect(() => {
    if (DATA_MODE !== "api") return;
    if (!session) {
      selectedPeriodRef.current = undefined;
      queueMicrotask(() => {
        setLoading(false);
        setOrganization(null);
        setPeriodState(null);
        setPeriods([]);
        setServerNotifications([]);
        dispatch({ type: "load", state: API_EMPTY });
      });
      return;
    }
    queueMicrotask(() => {
      setLoading(true);
      void reload(selectedPeriodRef.current);
    });

    if (typeof EventSource === "undefined") return;
    let closed = false;
    let refreshTimer: number | null = null;
    let lastNoticeSig: string | null = null;
    const es = new EventSource("/api/v1/notifications/stream", { withCredentials: true });
    const scheduleSync = () => {
      if (closed || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (!closed) void reload(selectedPeriodRef.current);
      }, 250);
    };
    const onNotifications = (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(evt.data || "{}")) as { notifications?: ServerNotice[] };
        const list = parsed.notifications ?? [];
        const sig = list.map((n) => `${n.id}:${n.read ? 1 : 0}`).join("|");
        setServerNotifications(list);
        if (lastNoticeSig !== null && lastNoticeSig !== sig) {
          scheduleSync();
        }
        lastNoticeSig = sig;
      } catch {
        scheduleSync();
      }
    };
    es.addEventListener("notifications", onNotifications as EventListener);
    es.addEventListener("notification", scheduleSync);
    es.addEventListener("task_updated", scheduleSync);
    es.addEventListener("message", scheduleSync);
    return () => {
      closed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      es.close();
    };
  }, [session, reload]);

  const meta = useMemo<WorkspaceMeta>(
    () => ({
      organization,
      period,
      periods,
      serverNotifications,
      today,
      now,
      loading,
      error,
      reload,
      setPeriod,
      markNoticeRead,
      markAllNoticesRead,
    }),
    [
      organization,
      period,
      periods,
      serverNotifications,
      today,
      now,
      loading,
      error,
      reload,
      setPeriod,
      markNoticeRead,
      markAllNoticesRead,
    ],
  );

  const value = useMemo(() => ({ state, dispatch, meta }), [state, meta]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo harus dipakai di dalam DemoProvider");
  const { state, dispatch, meta } = ctx;
  const names = useMemo(() => Object.fromEntries(state.competencies.map((c) => [c.id, c.name])), [state.competencies]);
  const memberById = useCallback((id: string) => state.members.find((m) => m.id === id), [state.members]);
  const taskById = useCallback((id: string) => state.tasks.find((t) => t.id === id), [state.tasks]);
  const projectById = useCallback((id: string) => state.projects.find((p) => p.id === id), [state.projects]);
  return { ...state, ...meta, dispatch, names, memberById, taskById, projectById };
}
