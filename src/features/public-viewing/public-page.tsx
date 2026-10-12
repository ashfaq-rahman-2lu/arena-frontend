import type { ReactElement } from "react";
import { TournamentPage } from "../tournament-management/tournament-page";

/** Public routes reuse competition rendering while keeping all owner reads disabled. */
export function PublicPage(): ReactElement {
  return <TournamentPage />;
}
