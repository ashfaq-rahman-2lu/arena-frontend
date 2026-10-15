import { DraftNavigationBoundary } from "../../shared/hooks/use-dirty-draft";
import { useState, type ChangeEvent, type ReactElement } from "react";
import {
  api,
  ApiError,
  errorMessage,
  type DrawPreview,
  type PairingOptions,
  type Tournament,
} from "../../shared/api/arena-api";
import { Field, Modal, ModalCancel } from "../../shared/ui/primitives";
import {
  DialogFeedback,
  type DialogRecoveryContext,
} from "./management-dialogs";
interface KnockoutPairingProps {
  t: Tournament;
  recovery: DialogRecoveryContext;
  onClose: () => void;
  onSave: (
    pairs: [string, string][],
    byes: string[],
    options: PairingOptions,
  ) => Promise<void>;
}
type Method = "MANUAL" | "RANDOM" | "FIXED";
interface OpeningSlot {
  kind: "PAIR" | "BYE";
  index: number;
}
interface BracketPreviewRound {
  number: number;
  pairs: string[];
}
function futureBracket(
  slots: OpeningSlot[],
  pairs: [string, string][],
  byes: string[],
  name: (id: string) => string,
): BracketPreviewRound[] {
  let nodes = slots.map((slot: OpeningSlot): string =>
    slot.kind === "BYE"
      ? name(byes[slot.index])
      : `Winner: ${name(pairs[slot.index][0])} vs ${name(pairs[slot.index][1])}`,
  );
  const rounds: BracketPreviewRound[] = [];
  let number = 2;
  while (nodes.length > 1) {
    const next: string[] = [];
    const labels: string[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      labels.push(`${nodes[i]} / ${nodes[i + 1]}`);
      next.push(`Winner of round ${number}, tie ${i / 2 + 1}`);
    }
    rounds.push({ number, pairs: labels });
    nodes = next;
    number++;
  }
  return rounds;
}
export function KnockoutPairing({
  t,
  recovery,
  onClose,
  onSave,
}: KnockoutPairingProps): ReactElement | null {
  const eligible = t.knockoutEligibility;
  const [revision, setRevision] = useState(t.revision);
  const [method, setMethod] = useState<Method>("MANUAL"),
    [byes, setByes] = useState<string[]>([]),
    [pairs, setPairs] = useState<[string, string][]>(
      Array.from(
        {
          length: eligible
            ? (eligible.entrantIds.length - eligible.byeCount) / 2
            : 0,
        },
        (): [string, string] => ["", ""],
      ),
    ),
    [pending, setPending] = useState(false),
    [draw, setDraw] = useState<DrawPreview | null>(null),
    [error, setError] = useState(""),
    [order, setOrder] = useState<OpeningSlot[] | null>(null),
    [reviewed, setReviewed] = useState(false);
  if (!eligible) return null;
  const used = [...byes, ...pairs.flat().filter(Boolean)];
  const valid =
    byes.length === eligible.byeCount &&
    used.length === eligible.entrantIds.length &&
    new Set(used).size === used.length &&
    used.every((id: string): boolean => eligible.entrantIds.includes(id));
  const slots = order ?? [
    ...pairs.map((_p: [string, string], index: number): OpeningSlot => ({
      kind: "PAIR",
      index,
    })),
    ...byes.map((_id: string, index: number): OpeningSlot => ({
      kind: "BYE",
      index,
    })),
  ];
  const name = (id: string): string =>
    t.entrants.find((e: Tournament["entrants"][number]): boolean => e.id === id)
      ?.name ?? "Choose team";
  const reset = (): void => {
    setReviewed(false);
    setError("");
    setDraw(null);
  };
  const move = (index: number, delta: number): void => {
    const next = [...slots];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setOrder(next);
    setReviewed(false);
  };
  return (
    <Modal
      title={`Set knockout round ${eligible.round}`}
      onClose={onClose}
      pending={pending}
      dirty={used.length > 0 || method !== "MANUAL"}
    >
      <DraftNavigationBoundary
        dirty={used.length > 0 || method !== "MANUAL" || pending}
      />
      <DialogFeedback
        recovery={{
          ...recovery,
          onReapply: (): void => {
            setRevision(recovery.latest.revision);
            setDraw(null);
            setReviewed(false);
            recovery.onReapply();
          },
        }}
        local={{ pairs, byes, method }}
        latest={recovery.latest.knockoutEligibility}
        valid={
          valid &&
          JSON.stringify(eligible) ===
            JSON.stringify(recovery.latest.knockoutEligibility)
        }
      />
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={pending}>
        <legend className="sr-only">Round pairings</legend>
        <Field label="Pairing method">
          <select
            value={method}
            onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
              const value = event.currentTarget.value;
              if (value !== "MANUAL" && value !== "RANDOM" && value !== "FIXED")
                return;
              setMethod(value);
              setPairs(pairs.map((): [string, string] => ["", ""]));
              setOrder(null);
              reset();
            }}
          >
            <option value="MANUAL">Manual pairings</option>
            <option value="RANDOM">Random draw</option>
            {!t.rounds.length && <option value="FIXED">Fixed bracket</option>}
          </select>
        </Field>
        <p>
          Every eligible team appears once.{" "}
          {eligible.entrantIds.length === 2
            ? t.knockoutFinalLegs
            : t.knockoutLegs}{" "}
          match(es) per tie in this round.
        </p>
        {eligible.byeCount > 0 && (
          <div className="bye-picker">
            <h3>Choose {eligible.byeCount} bye recipients</h3>
            {eligible.entrantIds.map((id: string): ReactElement => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={byes.includes(id)}
                  disabled={
                    !byes.includes(id) &&
                    (byes.length >= eligible.byeCount ||
                      pairs.flat().includes(id))
                  }
                  onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                    const checked = event.currentTarget.checked;
                    setByes((all: string[]): string[] =>
                      checked
                        ? [...all, id]
                        : all.filter((x: string): boolean => x !== id),
                    );
                    setOrder(null);
                    reset();
                    if (method === "RANDOM")
                      setPairs(pairs.map((): [string, string] => ["", ""]));
                  }}
                />
                {name(id)}
              </label>
            ))}
          </div>
        )}
        {method === "RANDOM" ? (
          <>
            <button
              type="button"
              className="button secondary"
              disabled={
                pending ||
                byes.length !== eligible.byeCount ||
                recovery.conflicted
              }
              onClick={async (): Promise<void> => {
                setPending(true);
                setError("");
                try {
                  const result = await api.draw(t.id, byes, revision);
                  setDraw(result);
                  setPairs(
                    result.pairs.map((p: string[]): [string, string] => [
                      p[0],
                      p[1],
                    ]),
                  );
                } catch (e: unknown) {
                  setError(errorMessage(e));
                  setDraw(null);
                  if (e instanceof ApiError && e.code === "REVISION_CONFLICT") {
                    try {
                      await recovery.onRefresh?.();
                    } catch (refresh: unknown) {
                      setError(errorMessage(refresh));
                    }
                  }
                } finally {
                  setPending(false);
                }
              }}
            >
              {draw ? "Redraw opponents" : "Draw opponents"}
            </button>
            {draw && (
              <div className="panel">
                <h3>Review the draw</h3>
                {pairs.map(
                  (p: [string, string], index: number): ReactElement => (
                    <p key={index}>
                      {name(p[0])} vs {name(p[1])}
                    </p>
                  ),
                )}
              </div>
            )}
          </>
        ) : (
          <div className="pairing-list">
            {pairs.map(
              (pair: [string, string], index: number): ReactElement => (
                <div key={index} className="pairing-row">
                  <span>{index + 1}</span>
                  {pair.map((value: string, side: number): ReactElement => (
                    <select
                      key={side}
                      aria-label={`Match ${index + 1} ${side === 0 ? "first" : "second"} team`}
                      value={value}
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ): void => {
                        const id = event.currentTarget.value;
                        setPairs(
                          (all: [string, string][]): [string, string][] =>
                            all.map(
                              (
                                p: [string, string],
                                i: number,
                              ): [string, string] =>
                                i === index
                                  ? side === 0
                                    ? [id, p[1]]
                                    : [p[0], id]
                                  : p,
                            ),
                        );
                        reset();
                      }}
                    >
                      <option value="">Choose team</option>
                      {eligible.entrantIds.map((id: string): ReactElement => (
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
              ),
            )}
          </div>
        )}
        {method === "FIXED" && valid && (
          <section className="panel">
            <h3>Opening bracket slots</h3>
            <p>
              Adjacent slots meet in the next round. This order stays fixed.
            </p>
            {slots.map((slot: OpeningSlot, index: number): ReactElement => (
              <div key={`${slot.kind}:${slot.index}`} className="bracket-slot">
                <span>
                  {index + 1}.{" "}
                  {slot.kind === "PAIR"
                    ? `${name(pairs[slot.index][0])} vs ${name(pairs[slot.index][1])}`
                    : `Bye: ${name(byes[slot.index])}`}
                </span>
                <button
                  type="button"
                  className="button secondary small"
                  aria-label={`Move slot ${index + 1} up`}
                  disabled={index === 0}
                  onClick={(): void => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="button secondary small"
                  aria-label={`Move slot ${index + 1} down`}
                  disabled={index === slots.length - 1}
                  onClick={(): void => move(index, 1)}
                >
                  ↓
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button secondary"
              onClick={(): void => setReviewed(true)}
            >
              Review bracket
            </button>
            {reviewed && (
              <p role="status">
                Bracket reviewed. Winners advance automatically after each
                complete round.
              </p>
            )}
            {reviewed &&
              futureBracket(slots, pairs, byes, name).map(
                (round: BracketPreviewRound): ReactElement => (
                  <div key={round.number}>
                    <h4>
                      {round.pairs.length === 1
                        ? "Final"
                        : `Round ${round.number}`}
                    </h4>
                    <ol>
                      {round.pairs.map(
                        (pair: string, index: number): ReactElement => (
                          <li key={index}>{pair}</li>
                        ),
                      )}
                    </ol>
                  </div>
                ),
              )}
          </section>
        )}
      </fieldset>
      <div className="modal-actions">
        <ModalCancel disabled={pending} />
        <button
          type="button"
          className="button"
          disabled={
            !valid ||
            pending ||
            recovery.conflicted ||
            (method === "RANDOM" && !draw) ||
            (method === "FIXED" && !reviewed)
          }
          onClick={async (): Promise<void> => {
            setPending(true);
            try {
              await onSave(pairs, byes, {
                method,
                ...(method === "RANDOM" ? { drawToken: draw?.drawToken } : {}),
                ...(method === "FIXED" ? { slots } : {}),
              });
            } finally {
              setPending(false);
            }
          }}
        >
          Create round
        </button>
      </div>
    </Modal>
  );
}
