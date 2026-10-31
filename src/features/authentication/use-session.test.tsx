import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  type RenderHookResult,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { api, ApiError, type Session } from "../../shared/api/arena-api";
import { useSession } from "./use-session";

const guest: Session = { csrf: "test", user: null, googleEnabled: true };
interface WrapperProps {
  children: ReactNode;
}

function mountSession(): RenderHookResult<
  UseQueryResult<Session, ApiError>,
  unknown
> {
  const cache = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  return renderHook(useSession, {
    wrapper: ({ children }: WrapperProps): ReactElement => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  });
}

afterEach((): void => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

test("an offline browser still reaches the session recovery deadline", async (): Promise<void> => {
  vi.useFakeTimers();
  onlineManager.setOnline(false);
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValue(new TypeError("Offline"));
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(120001);
  });
  expect(result.current.isError).toBe(true);
  expect(read).toHaveBeenCalled();
});

test("session recovers from a cold-start failure without exposing a signed-out result", async (): Promise<void> => {
  vi.useFakeTimers();
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValueOnce(
      new ApiError("Starting", 502, "INTEGRATION_UNAVAILABLE"),
    )
    .mockResolvedValue(guest);
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.isPending).toBe(true);
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(result.current.data).toEqual(guest);
  expect(read).toHaveBeenCalledTimes(2);
});

test("session respects Retry-After before retrying a 429", async (): Promise<void> => {
  vi.useFakeTimers();
  const error = Object.assign(new ApiError("Slow down", 429, "RATE_LIMITED"), {
    retryAfterMs: 10000,
  });
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValueOnce(error)
    .mockResolvedValue(guest);
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(9999);
  });
  expect(read).toHaveBeenCalledTimes(1);
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(result.current.data).toEqual(guest);
});

test.each([400, 401, 403, 409])(
  "session does not retry HTTP %s",
  async (status: number): Promise<void> => {
    vi.useFakeTimers();
    const read = vi
      .spyOn(api, "session")
      .mockRejectedValue(
        new ApiError("Cannot continue", status, "REQUEST_FAILED"),
      );
    const { result } = mountSession();
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(120001);
    });
    expect(result.current.isError).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  },
);

test("session stops retrying after two minutes and can start a fresh manual attempt", async (): Promise<void> => {
  vi.useFakeTimers();
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValue(
      new ApiError("Starting", 503, "INTEGRATION_UNAVAILABLE"),
    );
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(120001);
  });
  expect(result.current.isError).toBe(true);
  const attempts = read.mock.calls.length;
  expect(attempts).toBeGreaterThan(2);
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(read).toHaveBeenCalledTimes(attempts);
  read.mockResolvedValue(guest);
  await act(async (): Promise<void> => {
    await result.current.refetch();
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(result.current.data).toEqual(guest);
});

test("session deadline includes a request that never settles", async (): Promise<void> => {
  vi.useFakeTimers();
  vi.spyOn(api, "session").mockImplementation(
    (): Promise<Session> => new Promise<Session>((): void => {}),
  );
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(120001);
  });
  expect(result.current.isError).toBe(true);
});

test("leaving the page cancels pending session retries", async (): Promise<void> => {
  vi.useFakeTimers();
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValue(new TypeError("Network unavailable"));
  const { unmount } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(read).toHaveBeenCalledTimes(2);
  unmount();
  await vi.advanceTimersByTimeAsync(120001);
  expect(read).toHaveBeenCalledTimes(2);
});
