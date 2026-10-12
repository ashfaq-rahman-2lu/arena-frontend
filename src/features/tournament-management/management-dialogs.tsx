import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "../../generated/api";
import type { Entrant } from "../../shared/api/arena-api";
import { type Tournament } from "../../shared/api/arena-api";
import { ConflictReview } from "../../shared/ui/conflict-review";
import { Field, Modal, ModalCancel } from "../../shared/ui/primitives";
export interface DialogRecoveryContext {
  conflicted: boolean;
  error: string;
  latest: Tournament;
  onReapply: () => void;
  onLatest: () => void;
  signInPath?: string;
}
interface DialogFeedbackProps {
  recovery: DialogRecoveryContext;
  local: unknown;
  latest: unknown;
  valid: boolean;
}
export function DialogFeedback({
  recovery,
  local,
  latest,
  valid,
}: DialogFeedbackProps): React.JSX.Element | null {
  return (
    <>
      {recovery.error && (
        <p role="alert" className="inline-error">
          {recovery.error}
          {recovery.signInPath && (
            <Link to={recovery.signInPath}>Sign in to continue</Link>
          )}
        </p>
      )}
      {recovery.conflicted && (
        <>
          <ConflictReview
            local={local}
            latest={latest}
            onUseLatest={recovery.onLatest}
            onReapply={(): void => {
              if (valid) recovery.onReapply();
            }}
          />
          {!valid && (
            <p role="alert">
              The latest teams or eligibility changed. Use latest and correct
              the draft before saving.
            </p>
          )}
        </>
      )}
    </>
  );
}
function requireValue<T>(value: T | null | undefined): T {
  if (value == null)
    throw new Error(
      "This item is no longer available. Refresh the tournament.",
    );
  return value;
}
interface PairingModalProps {
  recovery: DialogRecoveryContext;
  t: Tournament;
  onClose: () => void;
  onSave: (pairs: [string, string][], byes: string[]) => Promise<void>;
}
interface TieModalProps {
  recovery: DialogRecoveryContext;
  t: Tournament;
  tie: {
    order: string[];
  };
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}
interface RenameModalProps {
  recovery: DialogRecoveryContext;
  t: Tournament;
  entrantId: string;
  onClose: () => void;
  onSave: (n: string, a: string[]) => Promise<void>;
}
export function PairingModal({
  t,
  recovery,
  onClose,
  onSave,
}: PairingModalProps): React.JSX.Element {
  const e = requireValue(t.knockoutEligibility),
    [byes, setByes] = useState<string[]>([]),
    [pairs, setPairs] = useState<[string, string][]>(
      Array.from(
        { length: (e.entrantIds.length - e.byeCount) / 2 },
        (): [string, string] => ["", ""],
      ),
    ),
    [pending, setPending] = useState(false);
  const used = [...byes, ...pairs.flat().filter(Boolean)],
    name = (id: string): string | undefined =>
      t.entrants.find((x: Entrant): boolean => x.id === id)?.name;
  const valid =
    used.length === e.entrantIds.length &&
    new Set(used).size === used.length &&
    byes.length === e.byeCount;
  return (
    <Modal
      title={`Set knockout round ${e.round}`}
      onClose={onClose}
      pending={pending}
      dirty={byes.length > 0 || pairs.flat().some(Boolean)}
    >
      <DialogFeedback
        recovery={recovery}
        local={{ pairs, byes, eligibility: e }}
        latest={recovery.latest.knockoutEligibility}
        valid={
          valid &&
          JSON.stringify(e) ===
            JSON.stringify(recovery.latest.knockoutEligibility)
        }
      />
      <p className="muted">
        Every advancing team must appear once. You choose the opponents.
      </p>
      {e.byeCount > 0 && (
        <div className="bye-picker">
          <h3>Choose {e.byeCount} bye recipients</h3>
          <p className="muted">
            These teams advance without playing this round.
          </p>
          {e.entrantIds.map((id: string): React.JSX.Element => (
            <label key={id}>
              <input
                type="checkbox"
                checked={byes.includes(id)}
                disabled={
                  !byes.includes(id) &&
                  (byes.length >= e.byeCount || pairs.flat().includes(id))
                }
                onChange={(
                  event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
                ): void =>
                  setByes((all: string[]): string[] =>
                    event.target.checked
                      ? [...all, id]
                      : all.filter((x: string): boolean => x !== id),
                  )
                }
              />
              <span>{name(id)}</span>
            </label>
          ))}
        </div>
      )}
      <div className="pairing-list">
        {pairs.map((pair: [string, string], i: number): React.JSX.Element => (
          <div className="pairing-row" key={i}>
            <span className="mono muted">{i + 1}</span>
            {pair.map((value: string, j: number): React.JSX.Element => (
              <select
                key={j}
                aria-label={`Match ${i + 1} ${j === 0 ? "first" : "second"} team`}
                value={value}
                onChange={(
                  event: React.ChangeEvent<
                    HTMLSelectElement,
                    HTMLSelectElement
                  >,
                ): void =>
                  setPairs((all: [string, string][]): [string, string][] =>
                    all.map(
                      (p: [string, string], n: number): [string, string] =>
                        n === i
                          ? j === 0
                            ? [event.target.value, p[1]]
                            : [p[0], event.target.value]
                          : p,
                    ),
                  )
                }
              >
                <option value="">Choose team</option>
                {e.entrantIds.map((id: string): React.JSX.Element => (
                  <option
                    key={id}
                    value={id}
                    disabled={used.includes(id) && value !== id}
                  >
                    {name(id)}
                  </option>
                ))}
              </select>
            ))}
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <ModalCancel disabled={pending} />
        <button
          className="button"
          disabled={!valid || pending || recovery.conflicted}
          onClick={async (): Promise<void> => {
            setPending(true);
            try {
              await onSave(pairs, byes);
            } finally {
              setPending(false);
            }
          }}
        >
          Create round <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
export function TieModal({
  t,
  recovery,
  tie,
  onClose,
  onSave,
}: TieModalProps): React.JSX.Element {
  const [order, setOrder] = useState(tie.order),
    [pending, setPending] = useState(false);
  const move = (i: number, d: number): void =>
    setOrder((all: string[]): string[] => {
      const next = [...all];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  return (
    <Modal
      title="Decide the tied order"
      onClose={onClose}
      pending={pending}
      dirty={JSON.stringify(order) !== JSON.stringify(tie.order)}
    >
      <DialogFeedback
        recovery={recovery}
        local={order}
        latest={recovery.latest.standings}
        valid={
          order.every((id: string): boolean =>
            recovery.latest.entrants.some(
              (entrant: Entrant): boolean => entrant.id === id,
            ),
          ) &&
          recovery.latest.standings.some(
            (scope: components["schemas"]["ScopeStanding"]): boolean =>
              scope.rows.some(
                (row: components["schemas"]["Standing"]): boolean =>
                  row.tieSignature ===
                  t.standings
                    .flatMap(
                      (
                        group: components["schemas"]["ScopeStanding"],
                      ): components["schemas"]["Standing"][] => group.rows,
                    )
                    .find(
                      (row: components["schemas"]["Standing"]): boolean =>
                        row.entrantId === order[0],
                    )?.tieSignature,
              ),
          )
        }
      />
      <p className="muted">
        These teams are equal on points, score difference and score for. Choose
        their final order.
      </p>
      <div className="tie-order">
        {order.map((id: string, i: number): React.JSX.Element => (
          <div key={id}>
            <span className="mono muted">{i + 1}</span>
            <strong>
              {t.entrants.find((e: Entrant): boolean => e.id === id)?.name}
            </strong>
            <button
              className="icon-button"
              aria-label={`Move team ${i + 1} up`}
              disabled={i === 0}
              onClick={(): void => move(i, -1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={`Move team ${i + 1} down`}
              disabled={i === order.length - 1}
              onClick={(): void => move(i, 1)}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <ModalCancel disabled={pending} />
        <button
          className="button"
          disabled={pending || recovery.conflicted}
          onClick={async (): Promise<void> => {
            setPending(true);
            try {
              await onSave(order);
            } finally {
              setPending(false);
            }
          }}
        >
          Save order
        </button>
      </div>
    </Modal>
  );
}
export function RenameModal({
  t,
  recovery,
  entrantId,
  onClose,
  onSave,
}: RenameModalProps): React.JSX.Element {
  const e = requireValue(
      t.entrants.find((e: Entrant): boolean => e.id === entrantId),
    ),
    [name, setName] = useState(e.name),
    [aliases, setAliases] = useState(e.aliases.join(", ")),
    [pending, setPending] = useState(false);
  return (
    <Modal
      title="Edit team identity"
      onClose={onClose}
      pending={pending}
      dirty={name !== e.name || aliases !== e.aliases.join(", ")}
    >
      <DialogFeedback
        recovery={recovery}
        local={{ name, aliases }}
        latest={recovery.latest.entrants.find(
          (entrant: Entrant): boolean => entrant.id === entrantId,
        )}
        valid={
          Boolean(
            recovery.latest.entrants.find(
              (entrant: Entrant): boolean => entrant.id === entrantId,
            ),
          ) &&
          name.trim().length > 0 &&
          !recovery.latest.entrants.some(
            (entrant: Entrant): boolean =>
              entrant.id !== entrantId &&
              entrant.name.toLowerCase() === name.trim().toLowerCase(),
          )
        }
      />
      <form
        onSubmit={async (
          event: React.SubmitEvent<HTMLFormElement>,
        ): Promise<void> => {
          event.preventDefault();
          if (pending || recovery.conflicted) return;
          const parsed = aliases
            .split(",")
            .map((alias: string): string => alias.trim())
            .filter(Boolean);
          if (
            !name.trim() ||
            parsed.length > 10 ||
            parsed.some((alias: string): boolean => alias.length > 80)
          ) {
            return;
          }
          setPending(true);
          try {
            await onSave(
              name.trim(),
              aliases
                .split(",")
                .map((a: string): string => a.trim())
                .filter(Boolean),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <Field label="Team name">
          <input
            value={name}
            required
            maxLength={80}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
            ): void => setName(e.target.value)}
          />
        </Field>
        <Field
          label="In-game names"
          hint="Separate aliases with commas to help recognize scorecards."
        >
          <input
            value={aliases}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
            ): void => setAliases(e.target.value)}
          />
        </Field>
        <div className="modal-actions">
          <ModalCancel disabled={pending} />
          <button
            className="button"
            type="submit"
            disabled={pending || recovery.conflicted}
          >
            Save team
          </button>
        </div>
      </form>
    </Modal>
  );
}
