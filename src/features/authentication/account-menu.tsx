import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api, errorMessage, type Session } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
const ProfileSettings = lazy(
  async (): Promise<{
    default: typeof import("../dashboard/profile-settings").ProfileSettings;
  }> => ({
    default: (await import("../dashboard/profile-settings")).ProfileSettings,
  }),
);
interface AccountMenuProps {
  session: Session;
}
export function AccountMenu({
  session,
}: AccountMenuProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const contentId = useId();
  const cache = useQueryClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requested =
    location.pathname === "/dashboard" && params.get("settings") === "1";
  const logout = useMutation({
    mutationFn: api.logout,
    retry: false,
    onSuccess: async (data: Session): Promise<void> => {
      await cache.cancelQueries({ queryKey: ["private"] });
      cache.removeQueries({ queryKey: ["private"] });
      cache.setQueryData(queryKeys.session(), data);
    },
    onSettled: (): void => {
      submitting.current = false;
    },
  });
  useEffect((): (() => void) | undefined => {
    if (!open) return;
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return (): void => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (!session.user) return null;
  const user = session.user;
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part: string): string => part.charAt(0))
      .join("")
      .toLocaleUpperCase() || "A";
  return (
    <>
      <div className="account-menu" ref={container}>
        <button
          type="button"
          className="account-menu-trigger"
          ref={trigger}
          aria-label={`Account menu for ${user.name}`}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={(): void => setOpen(!open)}
        >
          <span className="account-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="account-name">{user.name}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <div
          className="account-menu-panel"
          id={contentId}
          role="group"
          aria-label="Account menu"
          hidden={!open}
        >
          <div className="account-menu-identity">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <Link to="/dashboard" onClick={(): void => setOpen(false)}>
            <LayoutDashboard size={17} aria-hidden="true" />
            My arena
          </Link>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={(): void => {
              setOpen(false);
              trigger.current?.focus();
              setSettingsOpen(true);
            }}
          >
            <Settings size={17} aria-hidden="true" />
            Profile settings
          </button>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={(): void => {
              if (submitting.current) return;
              submitting.current = true;
              logout.mutate();
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
          {logout.error && <p role="alert">{errorMessage(logout.error)}</p>}
        </div>
      </div>
      {(settingsOpen || requested) &&
        createPortal(
          <Suspense fallback={<p role="status">Loading profile settings…</p>}>
            <ProfileSettings
              session={session}
              onClose={(): void => {
                setSettingsOpen(false);
                if (requested) {
                  const next = new URLSearchParams(params);
                  next.delete("settings");
                  setParams(next, { replace: true });
                }
                trigger.current?.focus();
              }}
            />
          </Suspense>,
          document.body,
        )}
    </>
  );
}
