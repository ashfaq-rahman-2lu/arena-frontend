import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiUrl } from "../../shared/api/api-origin";
import { api, errorMessage } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
import { Field, Modal } from "../../shared/ui/primitives";
import type { EmailChangeResult, Session } from "../../shared/api/arena-api";
interface ProfileSettingsProps {
  session: Session;
  onClose: () => void;
}
export function ProfileSettings({
  session,
  onClose,
}: ProfileSettingsProps): React.JSX.Element {
  return (
    <ProfileSettingsForm
      key={session.user?.id ?? "signed-out"}
      session={session}
      onClose={onClose}
    />
  );
}
function ProfileSettingsForm({
  session,
  onClose,
}: ProfileSettingsProps): React.JSX.Element {
  const [name, setName] = useState(session.user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const emailSubmitting = useRef(false);
  const [feedback, setFeedback] = useState((): string => {
    const result = new URLSearchParams(window.location.search).get("google");
    if (result === "linked") return "Google account connected.";
    if (result === "email_confirmation_sent")
      return "Check your email to confirm the address change.";
    if (result === "cancelled") return "Google confirmation was cancelled.";
    if (result === "failed")
      return "Google confirmation could not be completed. Start again.";
    return "";
  });
  const cache = useQueryClient();
  const saveName = useMutation({
    mutationFn: (): Promise<{ message: string }> => api.updateProfile(name),
    onSuccess: async (): Promise<void> => {
      const updated: Session = {
        ...session,
        user: session.user ? { ...session.user, name } : null,
      };
      cache.setQueryData(queryKeys.session(), updated);
      setFeedback("Name updated.");
    },
  });
  const setupPassword = useMutation({
    mutationFn: api.setupPassword,
    onSuccess: (result: { message: string }): void =>
      setFeedback(result.message),
  });
  const changeEmail = useMutation({
    mutationFn: (): Promise<EmailChangeResult> =>
      api.requestEmailChange(newEmail, emailCurrentPassword || undefined),
    onSuccess: (result: EmailChangeResult): void => {
      setEmailCurrentPassword("");
      if (result.status === "google_confirmation_required") {
        window.location.assign(result.authorizationUrl);
      } else {
        setFeedback(result.message);
      }
    },
    onSettled: (): void => {
      emailSubmitting.current = false;
    },
  });
  const changePassword = useMutation({
    mutationFn: (): Promise<{ message: string }> =>
      api.changePassword(currentPassword, password),
    onSuccess: (): void => {
      setPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      cache.clear();
      api.resetIdentity();
      onClose();
      window.location.replace("/auth/login?notice=password_updated");
    },
  });
  const pending =
    saveName.isPending ||
    setupPassword.isPending ||
    changePassword.isPending ||
    changeEmail.isPending;
  const error =
    saveName.error ??
    setupPassword.error ??
    changePassword.error ??
    changeEmail.error;
  return (
    <Modal title="Profile settings" onClose={onClose} pending={pending}>
      <section className="profile-settings">
        <h3>Profile</h3>
        <p>
          Account email: <strong>{session.user?.email}</strong>
        </p>
        <form
          onSubmit={(event: React.FormEvent<HTMLFormElement>): void => {
            event.preventDefault();
            if (pending || emailSubmitting.current) return;
            emailSubmitting.current = true;
            changeEmail.mutate();
          }}
        >
          <Field label="New email address">
            <input
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={newEmail}
              onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                setNewEmail(event.currentTarget.value)
              }
            />
          </Field>
          {session.user?.hasPassword && (
            <Field label="Current password">
              <input
                type="password"
                autoComplete="current-password"
                minLength={10}
                maxLength={128}
                required
                value={emailCurrentPassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                  setEmailCurrentPassword(event.currentTarget.value)
                }
              />
            </Field>
          )}
          {session.user?.hasPassword ? (
            <button
              className="button secondary"
              disabled={pending || !newEmail}
            >
              Send email confirmation
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={pending || !newEmail}
            >
              Continue with Google to confirm
            </button>
          )}
        </form>
        <form
          onSubmit={(event: React.FormEvent<HTMLFormElement>): void => {
            event.preventDefault();
            saveName.mutate();
          }}
        >
          <Field label="Name">
            <input
              value={name}
              maxLength={80}
              required
              onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                setName(event.currentTarget.value)
              }
            />
          </Field>
          <button
            className="button"
            disabled={pending || name.trim() === session.user?.name}
          >
            Save name
          </button>
        </form>
        <h3>Sign-in methods</h3>
        <p>Password: {session.user?.hasPassword ? "Set" : "Not set"}</p>
        {session.user?.hasPassword ? (
          <form
            onSubmit={(event: React.FormEvent<HTMLFormElement>): void => {
              event.preventDefault();
              changePassword.mutate();
            }}
          >
            <Field label="Current password">
              <input
                type="password"
                autoComplete="current-password"
                minLength={10}
                maxLength={128}
                required
                value={currentPassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                  setCurrentPassword(event.currentTarget.value)
                }
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={password}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                  setPassword(event.currentTarget.value)
                }
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                  setConfirmPassword(event.currentTarget.value)
                }
              />
            </Field>
            {password !== confirmPassword && confirmPassword !== "" && (
              <p role="alert">Passwords do not match.</p>
            )}
            <button
              className="button"
              disabled={pending || password !== confirmPassword}
            >
              Change password
            </button>
          </form>
        ) : (
          <button
            className="button"
            disabled={pending}
            onClick={(): void => setupPassword.mutate()}
          >
            Set password by email
          </button>
        )}
        <p>
          Google: {session.user?.googleLinked ? "Connected" : "Not connected"}
        </p>
        {session.googleEnabled && !session.user?.googleLinked && (
          <a
            className="text-button"
            href={apiUrl("/api/v1/auth/google?link=1")}
          >
            Connect Google
          </a>
        )}
        {feedback && <p role="status">{feedback}</p>}
        {error && <p role="alert">{errorMessage(error)}</p>}
      </section>
    </Modal>
  );
}
