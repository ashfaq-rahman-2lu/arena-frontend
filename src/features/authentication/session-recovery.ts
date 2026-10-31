import { ApiError, type Session } from "../../shared/api/arena-api";

export type SessionReader = (signal: AbortSignal) => Promise<Session>;
const recoveryWindowMs = 120000;

function cancellableRead(
  read: SessionReader,
  signal: AbortSignal,
): Promise<Session> {
  signal.throwIfAborted();
  return new Promise<Session>(
    (
      resolve: (value: Session) => void,
      reject: (reason: unknown) => void,
    ): void => {
      const abort = (): void => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      void read(signal).then(
        (session: Session): void => {
          signal.removeEventListener("abort", abort);
          resolve(session);
        },
        (error: unknown): void => {
          signal.removeEventListener("abort", abort);
          reject(error);
        },
      );
    },
  );
}

function pause(delayMs: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise<void>(
    (resolve: () => void, reject: (reason: unknown) => void): void => {
      const abort = (): void => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout((): void => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, delayMs);
      signal.addEventListener("abort", abort, { once: true });
    },
  );
}

export async function recoverSession(
  read: SessionReader,
  signal: AbortSignal,
): Promise<Session> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = (): void => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  const deadline = Date.now() + recoveryWindowMs;
  const timer = setTimeout(
    (): void =>
      controller.abort(
        new ApiError(
          "The server is taking longer than expected. Please try again.",
          503,
          "SESSION_UNAVAILABLE",
        ),
      ),
    recoveryWindowMs,
  );
  let attempt = 0;
  try {
    while (true) {
      try {
        return await cancellableRead(read, controller.signal);
      } catch (error: unknown) {
        controller.signal.throwIfAborted();
        const temporary =
          error instanceof ApiError
            ? [429, 502, 503, 504].includes(error.status)
            : error instanceof TypeError;
        if (!temporary) throw error;
        const backoff =
          Math.min(2000 * 2 ** attempt++, 15000) * (1 + Math.random() * 0.2);
        const delay = Math.max(
          backoff,
          error instanceof ApiError ? (error.retryAfterMs ?? 0) : 0,
        );
        if (delay >= deadline - Date.now()) throw error;
        await pause(delay, controller.signal);
      }
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
