import { Check, ChevronDown, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from "react";
import type { Entrant } from "../../shared/api/arena-api";

interface TeamFilterProps {
  entrants: Entrant[];
  value: string;
  onChange: (value: string) => void;
}
interface TeamChoice {
  id: string;
  name: string;
}

export function TeamFilter({
  entrants,
  value,
  onChange,
}: TeamFilterProps): ReactElement {
  const label =
    entrants.find((entrant: Entrant): boolean => entrant.id === value)?.name ??
    "All teams";
  const selection = `${value}:${label}`;
  const [previousSelection, setPreviousSelection] = useState<string>(selection);
  const listId = useId();
  const [search, setSearch] = useState<string | null>(null);
  const [active, setActive] = useState<number>(-1);
  // Reset an unfinished draft when navigation changes the committed selection,
  // while preserving the input node and keyboard focus.
  if (previousSelection !== selection) {
    setPreviousSelection(selection);
    setSearch(null);
    setActive(-1);
  }
  const open = search !== null;
  const choices: TeamChoice[] = [
    { id: "", name: "All teams" },
    ...entrants,
  ].filter((team: TeamChoice): boolean =>
    team.name
      .toLocaleLowerCase()
      .includes((search ?? "").trim().toLocaleLowerCase()),
  );
  useEffect((): void => {
    if (active >= 0)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);
  const close = (): void => {
    setSearch(null);
    setActive(-1);
  };
  const choose = (id: string): void => {
    onChange(id);
    close();
  };
  const start = (): void => {
    if (!open) {
      setSearch("");
      setActive(-1);
    }
  };
  return (
    <div className="team-filter">
      <Search className="team-filter-search" size={16} aria-hidden="true" />
      <input
        role="combobox"
        aria-label="Filter by team"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 && choices[active]
            ? `${listId}-${active}`
            : undefined
        }
        autoComplete="off"
        placeholder="Search teams…"
        value={open ? search : label}
        onFocus={start}
        onClick={start}
        onBlur={close}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          setSearch(event.currentTarget.value);
          setActive(-1);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>): void => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setSearch("");
              setActive(-1);
            } else if (choices.length)
              setActive((current: number): number =>
                event.key === "ArrowDown"
                  ? (current + 1) % choices.length
                  : (current <= 0 ? choices.length : current) - 1,
              );
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (choices[active]) choose(choices[active].id);
          }
        }}
      />
      <ChevronDown
        className="team-filter-chevron"
        size={16}
        aria-hidden="true"
      />
      {open && (
        <div className="team-filter-popup">
          <div
            id={listId}
            role="listbox"
            aria-label="Teams"
            className="team-filter-options"
          >
            {choices.map((team: TeamChoice, index: number): ReactElement => (
              <button
                type="button"
                role="option"
                id={`${listId}-${index}`}
                key={team.id}
                tabIndex={-1}
                aria-selected={team.id === value}
                data-active={index === active}
                onPointerDown={(event: PointerEvent<HTMLButtonElement>): void =>
                  event.preventDefault()
                }
                onClick={(): void => choose(team.id)}
              >
                <span>{team.name}</span>
                {team.id === value && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {!choices.length && (
            <p role="status" className="team-filter-empty">
              No teams found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
