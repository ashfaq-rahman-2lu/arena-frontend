import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  type UseQueryResult,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { api, type ApiError, type Tournament } from "./arena-api";
import { tournament } from "../../test/fixtures";
import { useCompetition } from "./query-hooks";

interface WrapperProps {
  children: ReactNode;
}
test("public competition polling waits a full minute between refreshes", async (): Promise<void> => {
  vi.useFakeTimers();
  focusManager.setFocused(true);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const read = vi.spyOn(api, "public").mockResolvedValue(tournament);
  function Wrapper({ children }: WrapperProps): ReactElement {
    return <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
  }
  const { unmount } = renderHook(
    (): UseQueryResult<Tournament, ApiError> =>
      useCompetition(false, "", "", "ARENA2026"),
    { wrapper: Wrapper },
  );
  try {
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(read).toHaveBeenCalledTimes(1);
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(read).toHaveBeenCalledTimes(1);
    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(45000);
    });
    expect(read).toHaveBeenCalledTimes(2);
  } finally {
    unmount();
    cache.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  }
});
