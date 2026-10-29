import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactElement } from "react";

interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  visibilityLabel?: string;
}

export function PasswordInput({
  visibilityLabel = "password",
  ...props
}: PasswordInputProps): ReactElement {
  const [visible, setVisible] = useState<boolean>(false);
  return (
    <div className="password-input">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="icon-button password-input-toggle"
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={(): void =>
          setVisible((current: boolean): boolean => !current)
        }
      >
        {visible ? (
          <EyeOff size={19} aria-hidden="true" />
        ) : (
          <Eye size={19} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
