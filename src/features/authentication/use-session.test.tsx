import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  focusManager,
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

function mountSession(
  cache: QueryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 } },
  }),
): RenderHookResult<UseQueryResult<Session, ApiError>, unknown> {
  return renderHook(useSession, {
    wrapper: ({ children }: WrapperProps): ReactElement => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  });
}

afterEach((): void => {
  cleanup();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

test.each([400, 401, 403, 409, 429, 502, 503, 504])(
  "session immediately reports HTTP %s without automatic retries",
  async (status: number): Promise<void> => {
    vi.useFakeTimers();
    const error = new ApiError("Cannot connect", status, "REQUEST_FAILED");
    const read = vi.spyOn(api, "session").mockRejectedValue(error);
    const { result } = mountSession();
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe(error);
    expect(result.current.data).toBeUndefined();
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(180000);
    });
    expect(read).toHaveBeenCalledTimes(1);
  },
);

test("network failures immediately report an error even while offline", async (): Promise<void> => {
  vi.useFakeTimers();
  onlineManager.setOnline(false);
  const error = new TypeError("Offline");
  const read = vi.spyOn(api, "session").mockRejectedValue(error);
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.error).toBe(error);
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(180000);
  });
  expect(read).toHaveBeenCalledTimes(1);
});

test("focus, reconnect and another consumer do not restart a failed session check", async (): Promise<void> => {
  vi.useFakeTimers();
  const cache = new QueryClient();
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValue(new TypeError("Unavailable"));
  const first = mountSession(cache);
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(first.result.current.isError).toBe(true);
  const second = mountSession(cache);
  await act(async (): Promise<void> => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(180000);
  });
  expect(second.result.current.isError).toBe(true);
  expect(read).toHaveBeenCalledTimes(1);
  first.unmount();
  second.unmount();
  cache.clear();
});

test("a manual retry makes one new request and can recover the session", async (): Promise<void> => {
  vi.useFakeTimers();
  const read = vi
    .spyOn(api, "session")
    .mockRejectedValueOnce(
      new ApiError("Unavailable", 503, "INTEGRATION_UNAVAILABLE"),
    )
    .mockResolvedValue(guest);
  const { result } = mountSession();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.isError).toBe(true);
  await act(async (): Promise<void> => {
    await result.current.refetch();
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.data).toEqual(guest);
  expect(read).toHaveBeenCalledTimes(2);
});

test("a slow session stays pending until the request completes without a frontend timeout", async (): Promise<void> => {
  vi.useFakeTimers();
  let requestSignal: AbortSignal | undefined;
  let finishSession: ((session: Session) => void) | undefined;
  const pending = new Promise<Session>(
    (resolve: (session: Session) => void): void => {
      finishSession = resolve;
    },
  );
  const read = vi
    .spyOn(api, "session")
    .mockImplementation((signal?: AbortSignal): Promise<Session> => {
      requestSignal = signal;
      return pending;
    });
  const { result } = mountSession();
  expect(result.current.isPending).toBe(true);
  expect(result.current.error).toBeNull();
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(180000);
  });
  expect(result.current.isPending).toBe(true);
  expect(result.current.error).toBeNull();
  expect(requestSignal?.aborted).toBe(false);
  expect(read).toHaveBeenCalledTimes(1);
  await act(async (): Promise<void> => {
    finishSession?.(guest);
    await pending;
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(result.current.data).toEqual(guest);
  expect(result.current.isPending).toBe(false);
});

test("leaving the page cancels the in-flight session request", async (): Promise<void> => {
  vi.useFakeTimers();
  let requestSignal: AbortSignal | undefined;
  const read = vi
    .spyOn(api, "session")
    .mockImplementation((signal?: AbortSignal): Promise<Session> => {
      requestSignal = signal;
      return new Promise<Session>((): void => {});
    });
  const { unmount } = mountSession();
  expect(requestSignal?.aborted).toBe(false);
  unmount();
  expect(requestSignal?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(180000);
  expect(read).toHaveBeenCalledTimes(1);
});

test("a failed background check preserves cached session data", async (): Promise<void> => {
  vi.useFakeTimers();
  const cache = new QueryClient();
  cache.setQueryData(["session"], guest);
  const error = new TypeError("Unavailable");
  const read = vi.spyOn(api, "session").mockRejectedValue(error);
  const { result, unmount } = mountSession(cache);
  expect(result.current.data).toEqual(guest);
  expect(result.current.error).toBeNull();
  await act(async (): Promise<void> => {
    await result.current.refetch();
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(result.current.error).toBe(error);
  expect(result.current.data).toEqual(guest);
  expect(read).toHaveBeenCalledTimes(1);
  unmount();
  cache.clear();
});
