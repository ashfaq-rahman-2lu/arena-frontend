import { ReactElement, RefObject, useContext, useEffect } from "react";
import {
  Location,
  UNSAFE_DataRouterContext,
  useBlocker,
} from "react-router-dom";
import { Modal } from "../ui/primitives";
interface NavigationChange {
  currentLocation: Location;
  nextLocation: Location;
}
export interface DirtyDraftProps {
  dirty: boolean;
  allowNavigation?: RefObject<boolean>;
}
export function DirtyDraftGuard({
  dirty,
  allowNavigation,
}: DirtyDraftProps): ReactElement | null {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }: NavigationChange): boolean =>
      dirty &&
      !allowNavigation?.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect((): (() => void) => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (dirty && !allowNavigation?.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return (): void => window.removeEventListener("beforeunload", warn);
  }, [dirty, allowNavigation]);
  if (blocker.state !== "blocked") return null;
  return (
    <Modal
      title="Discard unsaved changes?"
      onClose={(): void => blocker.reset()}
    >
      <p>Your draft is kept until you choose to leave.</p>
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          onClick={(): void => blocker.reset()}
        >
          Keep editing
        </button>
        <button
          type="button"
          className="button danger"
          onClick={(): void => blocker.proceed()}
        >
          Discard and leave
        </button>
      </div>
    </Modal>
  );
}

export function DraftNavigationBoundary(
  props: DirtyDraftProps,
): ReactElement | null {
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <DirtyDraftGuard {...props} /> : null;
}
