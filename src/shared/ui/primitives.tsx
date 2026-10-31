interface ToastProviderProps {
  children: ReactNode;
}
interface BadgeProps {
  children: ReactNode;
  kind?: string;
}
interface StatusBadgeProps {
  status: string;
}
interface TeamMarkProps {
  name: string;
  index?: number;
}
interface ErrorStateProps {
  error: unknown;
  retry?: () => void;
}
interface ShareButtonProps {
  code: string;
}
let openDialogs = 0;
let previousOverflow = "";
import { ArrowRight, Check, Copy, LoaderCircle, Trophy, X } from "lucide-react";
import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../features/authentication/use-session";
import { AccountMenu } from "../../features/authentication/account-menu";
import { SessionFeedback } from "../../features/authentication/session-feedback";
export { useSession };
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  (): void => {},
);
export function ToastProvider({
  children,
}: ToastProviderProps): React.JSX.Element {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  useEffect((): (() => void) | undefined => {
    if (toast) {
      const timer = setTimeout((): void => setToast(null), 5500);
      return (): void => clearTimeout(timer);
    }
  }, [toast]);
  return (
    <ToastContext.Provider
      value={(message: string, error: boolean | undefined = false): void =>
        setToast({ message, error })
      }
    >
      {children}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <X size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            onClick={(): void => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = (): ((message: string, error?: boolean) => void) =>
  useContext(ToastContext);
export function Logo(): React.JSX.Element {
  return (
    <Link to="/" className="logo" aria-label="Arena home">
      <span className="logo-mark">
        <Trophy size={21} strokeWidth={2.5} />
      </span>
      ARENA<span className="logo-dot">.</span>
    </Link>
  );
}
export function Nav(): React.JSX.Element {
  const session = useSession();
  const data = session.data;
  return (
    <header className="topbar">
      <div className="container nav">
        <Logo />
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/" className="quiet-link">
            Find a tournament
          </Link>
          {!data && (session.isPending || session.isError) ? (
            <SessionFeedback session={session} variant="inline" />
          ) : data?.user ? (
            <AccountMenu key={data.user.id} session={data} />
          ) : (
            <>
              <Link to="/auth/login" className="quiet-link">
                Sign in
              </Link>
              <Link to="/auth/register" className="button small">
                Get started <ArrowRight size={16} />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
export function Footer(): React.JSX.Element {
  return (
    <footer className="container footer">
      <Logo />
      <span>Built for the games. Run by you.</span>
      <span className="mono">LET THE BEST TEAM WIN.</span>
    </footer>
  );
}
export function Badge({
  children,
  kind = "neutral",
}: BadgeProps): React.JSX.Element {
  return (
    <span className={`badge ${kind}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  return (
    <Badge
      kind={
        status === "ACTIVE"
          ? "lime"
          : status === "COMPLETED"
            ? "blue"
            : "neutral"
      }
    >
      {status === "ACTIVE"
        ? "In play"
        : status === "COMPLETED"
          ? "Completed"
          : "Draft"}
    </Badge>
  );
}
export function TeamMark({
  name,
  index = 0,
}: TeamMarkProps): React.JSX.Element {
  return (
    <span className={`team-mark team-${index % 6}`}>
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((s: string): string => s[0])
        .join("")
        .toUpperCase() || "?"}
    </span>
  );
}
export function Spinner(): React.JSX.Element {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading your arena…
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div className="empty error-panel">
      <X size={28} />
      <h2>Couldn’t load this page</h2>
      <p>{error instanceof Error ? error.message : "Please try again."}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Try again
        </button>
      )}
      <Link to="/" className="quiet-link">
        Back home
      </Link>
    </div>
  );
}
const ModalDismissContext = createContext<(() => void) | null>(null);
export interface ModalCancelProps {
  disabled?: boolean;
}
export function ModalCancel({ disabled }: ModalCancelProps): ReactElement {
  const dismiss = useContext(ModalDismissContext);
  return (
    <button
      type="button"
      className="button secondary"
      disabled={disabled}
      onClick={(): void => dismiss?.()}
    >
      Cancel
    </button>
  );
}
export interface ModalProps {
  className?: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  dirty?: boolean;
  pending?: boolean;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
  dirty = false,
  pending = false,
}: ModalProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect((): (() => void) => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    if (openDialogs === 0) previousOverflow = document.body.style.overflow;
    openDialogs++;
    document.body.style.overflow = "hidden";
    (
      dialog?.querySelector<HTMLElement>(
        "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      ) ??
      dialog?.querySelector<HTMLElement>(
        ".modal-actions button:not([disabled]),button:not([disabled])",
      )
    )?.focus();
    return (): void => {
      openDialogs--;
      if (openDialogs === 0) document.body.style.overflow = previousOverflow;
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  const dismiss = (): void => {
    if (pending) return;
    if (!dirty || window.confirm("Discard unsaved changes?")) onClose();
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      onCancel={(event: React.SyntheticEvent<HTMLDialogElement>): void => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={pending}
            onClick={dismiss}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <ModalDismissContext.Provider value={dismiss}>
          {children}
        </ModalDismissContext.Provider>
      </div>
    </dialog>
  );
}
interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}
export interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}
export function Field({
  label,
  children,
  hint,
  error,
}: FieldProps): ReactElement {
  const id = useId();
  const control = isValidElement<FieldControlProps>(children) ? children : null;
  const descriptions = [
    control?.props["aria-describedby"],
    hint ? `${id}-hint` : undefined,
    error ? `${id}-error` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field">
      <label htmlFor={control?.props.id ?? id}>{label}</label>
      {control
        ? cloneElement(control, {
            id: control.props.id ?? id,
            "aria-describedby": descriptions || undefined,
            "aria-invalid": error ? true : control.props["aria-invalid"],
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small role="alert" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
export function ShareButton({ code }: ShareButtonProps): React.JSX.Element {
  const toast = useToast();
  return (
    <button
      className="button secondary small"
      onClick={async (): Promise<void> => {
        try {
          await navigator.clipboard.writeText(`${location.origin}/t/${code}`);
          toast("Tournament link copied");
        } catch {
          toast(`Share this link: ${location.origin}/t/${code}`);
        }
      }}
    >
      <Copy size={15} /> Share tournament
    </button>
  );
}
