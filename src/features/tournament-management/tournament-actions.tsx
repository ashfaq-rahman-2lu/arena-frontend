import { MoreVertical } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

interface TournamentActionsProps {
  children: ReactNode;
}
export function TournamentActions({
  children,
}: TournamentActionsProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  useEffect((): (() => void) | undefined => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent): void => {
      if (document.querySelector("dialog[open]")) return;
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent): void => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return (): void => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);
  return (
    <div className="tournament-management" ref={container}>
      <button
        type="button"
        ref={trigger}
        className="icon-button tournament-actions-trigger"
        aria-label="Tournament actions"
        title="Tournament actions"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={(): void => setOpen(!open)}
      >
        <MoreVertical aria-hidden="true" size={22} />
      </button>
      <div
        id={contentId}
        className="management-actions"
        role="group"
        aria-label="Tournament actions"
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}
