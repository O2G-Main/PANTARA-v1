import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

describe("api client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("melempar ApiError dengan status, code, dan fields dari envelope server", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Data tidak valid.",
            fields: { title: "Judul wajib diisi" },
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(api.tasks.create({
      projectId: "klinik",
      title: "",
      description: "",
      dueDate: "2026-10-02",
      priority: "normal",
      draft: true,
    })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "validation_error",
      message: "Data tidak valid.",
      fields: { title: "Judul wajib diisi" },
    });
  });

  it("melakukan single-flight refresh sekali saat beberapa request bersamaan mendapat 401", async () => {
    let refreshCount = 0;
    let tasksCall = 0;
    let reportCall = 0;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/v1/auth/refresh") {
        refreshCount += 1;
        return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
      }
      if (url === "/api/v1/tasks") {
        tasksCall += 1;
        if (tasksCall === 1) return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), { status: 401 });
        return new Response(JSON.stringify({ tasks: [] }), { status: 200 });
      }
      if (url === "/api/v1/report") {
        reportCall += 1;
        if (reportCall === 1) return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), { status: 401 });
        return new Response(JSON.stringify({ baselineMinutes: 24 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const [tRes, rRes] = await Promise.all([api.tasks.list(), api.analytics.report()]);
    expect(tRes).toEqual({ tasks: [] });
    expect(rRes).toMatchObject({ baselineMinutes: 24 });
    expect(refreshCount).toBe(1);
    expect(tasksCall).toBe(2);
    expect(reportCall).toBe(2);
  });

  it("menangani kegagalan jaringan dengan ApiError status 0", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    try {
      await api.workspace.bootstrap();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).code).toBe("network_error");
    }
  });
});
