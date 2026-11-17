import { afterEach, expect, it } from "vitest";

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_DATA_MODE;

afterEach(() => {
  if (ORIGINAL_MODE === undefined) {
    delete process.env.NEXT_PUBLIC_DATA_MODE;
  } else {
    process.env.NEXT_PUBLIC_DATA_MODE = ORIGINAL_MODE;
  }
});

it("menandai frontend sehat sesuai mode data aktif", async () => {
  delete process.env.NEXT_PUBLIC_DATA_MODE;
  const { GET } = await import("./route");
  const apiResponse = GET();

  expect(apiResponse.status).toBe(200);
  expect(await apiResponse.json()).toEqual({ status: "ok", service: "pantara-frontend", mode: "api" });

  process.env.NEXT_PUBLIC_DATA_MODE = "mock";
  const mockResponse = GET();
  expect(mockResponse.status).toBe(200);
  expect(await mockResponse.json()).toEqual({ status: "ok", service: "pantara-frontend", mode: "mock" });
});
