import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const ORIGINAL_BACKEND = process.env.BACKEND_INTERNAL_URL;
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_BACKEND === undefined) {
    delete process.env.BACKEND_INTERNAL_URL;
  } else {
    process.env.BACKEND_INTERNAL_URL = ORIGINAL_BACKEND;
  }
  vi.restoreAllMocks();
});

describe("/api/v1/[...path] runtime proxy", () => {
  it("memakai BACKEND_INTERNAL_URL saat runtime dan meneruskan header Set-Cookie", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://127.0.0.1:18000/";
    const fetchMock = vi.fn().mockImplementation(() => {
      const headers = new Headers({
        "content-type": "application/json",
        "content-encoding": "gzip",
        "content-length": "999",
      });
      headers.append("set-cookie", "pantara_access=abc; Path=/; HttpOnly");
      headers.append("set-cookie", "pantara_refresh=def; Path=/; HttpOnly");
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = new NextRequest("http://localhost:3001/api/v1/auth/login?next=%2Fdashboard", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "theme=dark", "accept-encoding": "gzip, br" },
      body: JSON.stringify({ email: "krisna@pantara.id" }),
    });

    const res = await POST(req, { params: Promise.resolve({ path: ["auth", "login"] }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(res.headers.get("content-length")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:18000/api/v1/auth/login?next=%2Fdashboard");
    const forwardedHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(forwardedHeaders.get("cookie")).toBe("theme=dark");
    expect(forwardedHeaders.get("accept-encoding")).toBeNull();
    expect(res.headers.getSetCookie()).toEqual([
      "pantara_access=abc; Path=/; HttpOnly",
      "pantara_refresh=def; Path=/; HttpOnly",
    ]);
  });

  it("mengembalikan 502 BAD_GATEWAY saat backend upstream tidak terjangkau", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://127.0.0.1:19999";
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED")) as unknown as typeof fetch;

    const req = new NextRequest("http://localhost:3001/api/v1/auth/me", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ path: ["auth", "me"] }) });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: "BAD_GATEWAY" } });
  });
});
