import {
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface TournamentLookupProps {
  initialValue?: string;
}

function tournamentCode(input: string): string | null {
  const value = input.trim();
  if (/^[a-z0-9]{8,10}$/i.test(value)) return value.toUpperCase();
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return (
      /^\/t\/([a-z0-9]{8,10})\/?$/i.exec(url.pathname)?.[1]?.toUpperCase() ??
      null
    );
  } catch {
    return null;
  }
}

export function TournamentLookup({
  initialValue = "",
}: TournamentLookupProps): ReactElement {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<string>("");
  const inputId = useId();
  const navigate = useNavigate();
  return (
    <form
      className="lookup"
      onSubmit={(event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const code = tournamentCode(value);
        if (!code) {
          setError(
            "Enter an ID with 8–10 letters or numbers, or paste a tournament link.",
          );
          return;
        }
        setError("");
        navigate(`/t/${encodeURIComponent(code)}`);
      }}
    >
      <div className="lookup-field">
        <label className="sr-only" htmlFor={inputId}>
          Tournament ID or link
        </label>
        <input
          id={inputId}
          placeholder="Tournament ID or link"
          value={value}
          maxLength={2048}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            setValue(event.currentTarget.value);
            setError("");
          }}
        />
        {error && (
          <p id={`${inputId}-error`} className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button className="button" type="submit">
        Find tournament <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
