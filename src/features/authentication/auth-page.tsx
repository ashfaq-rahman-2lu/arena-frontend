import { apiUrl } from "../../shared/api/api-origin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  api,
  ApiError,
  errorMessage,
  safeReturnUrl,
} from "../../shared/api/arena-api";
import { Field, useSession } from "../../shared/ui/primitives";
export function AuthPage(): React.JSX.Element {
  const { mode = "login" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { data: session } = useSession();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [reason, setReason] = useState("");
  const locked = useRef(false);
  const operation = useMutation({
    mutationFn: (action: () => Promise<unknown>): Promise<unknown> => action(),
    retry: false,
  });
  const titles: Record<string, string> = {
    login: "Welcome back.",
    register: "Your arena awaits.",
    forgot: "Back in the game.",
    reset: "A fresh start.",
    verify: "Make it official.",
    "email-confirm": "Confirm your new email.",
  };
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    setPending(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const data = await api.login(email, password);
        cache.setQueryData(["session"], data);
        navigate(safeReturnUrl(params.get("returnTo")));
      } else if (mode === "register") {
        await api.register(name, email, password);
        setMessage(
          "Check your email to verify your account before signing in.",
        );
      } else if (mode === "forgot") {
        await api.forgot(email);
        setMessage("If your account is eligible, a reset link is on its way.");
      } else if (mode === "reset") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        await api.reset(params.get("token") || "", password);
        cache.clear();
        api.resetIdentity();
        window.location.replace("/auth/login?notice=password_updated");
      } else if (mode === "verify") {
        await api.verify(params.get("token") || "");
        setMessage("Email verified. You can now sign in.");
      } else if (mode === "email-confirm") {
        await api.confirmEmailChange(params.get("token") || "");
        cache.clear();
        api.resetIdentity();
        window.location.replace("/auth/login?notice=email_updated");
      } else throw new Error("Unknown sign-in page");
    } catch (e) {
      setError(errorMessage(e));
      setReason(e instanceof ApiError ? e.code : "");
    } finally {
      setPending(false);
    }
  };
  return (
    <main id="main-content" className="container auth-layout">
      <div className="auth-story">
        <div className="eyebrow">FOR THE ONES WHO MAKE IT HAPPEN</div>
        <h1>
          YOU RUN
          <br />
          THE <span>SHOW.</span>
        </h1>
        <p>
          Bring your friends. Set the rules.
          <br />
          Let the standings do the talking.
        </p>
        <div className="auth-note">
          <ShieldCheck size={24} />
          <span>
            Only admins need an account.
            <br />
            <small>Your players are here to play.</small>
          </span>
        </div>
      </div>
      <div className="auth-card">
        <h2>{titles[mode] || titles.login}</h2>
        {mode === "login" && params.get("notice") === "password_updated" && (
          <div className="success-message" role="status">
            Password updated. Sign in again.
          </div>
        )}
        {mode === "login" && params.get("notice") === "email_updated" && (
          <div className="success-message" role="status">
            Email updated. Sign in again.
          </div>
        )}
        {mode === "login" && params.get("error") === "google_cancelled" && (
          <div className="inline-error" role="alert">
            Google sign-in was cancelled. You can try again or use your
            password.
          </div>
        )}
        {mode === "login" && params.get("error") === "google_failed" && (
          <div className="inline-error" role="alert">
            Google sign-in could not be completed. Please start again.
          </div>
        )}
        <p>
          {mode === "register"
            ? "Create your admin account to get started."
            : mode === "login"
              ? "Sign in to manage your competitions."
              : mode === "verify"
                ? "Confirm your email address below."
                : mode === "email-confirm"
                  ? "Confirm the new email address for your account."
                  : "We’ll get you back to your tournaments."}
        </p>
        {["login", "register"].includes(mode) && session?.googleEnabled && (
          <>
            <a
              className="button google-button"
              href={apiUrl(
                `/api/v1/auth/google?returnTo=${encodeURIComponent(safeReturnUrl(params.get("returnTo")))}`,
              )}
            >
              <span className="google-g">G</span>Continue with Google
            </a>
            <div className="divider">
              <span>or use your email</span>
            </div>
          </>
        )}
        <form
          onSubmit={(event: React.FormEvent<HTMLFormElement>): void => {
            event.preventDefault();
            if (locked.current) return;
            locked.current = true;
            operation.mutate((): Promise<void> => submit(event), {
              onSettled: (): void => {
                locked.current = false;
              },
            });
          }}
        >
          {mode === "register" && (
            <Field label="Your name">
              <input
                required
                value={name}
                autoComplete="name"
                maxLength={80}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
                ): void => setName(e.target.value)}
                placeholder="How should we call you?"
              />
            </Field>
          )}
          {["login", "register", "forgot"].includes(mode) && (
            <Field label="Email address">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                maxLength={254}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
                ): void => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          )}
          {["login", "register", "reset"].includes(mode) && (
            <Field
              label="Password"
              hint={mode === "login" ? undefined : "Use at least 8 characters."}
            >
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
                ): void => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </Field>
          )}
          {mode === "login" && (
            <Link className="forgot-link" to="/auth/forgot">
              Forgot password?
            </Link>
          )}
          {mode === "reset" && (
            <Field label="Confirm new password">
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
                  setConfirmPassword(event.currentTarget.value)
                }
              />
            </Field>
          )}
          {error && (
            <div role="alert" className="inline-error">
              {error}
              {mode === "login" && reason === "EMAIL_VERIFICATION_REQUIRED" && (
                <button
                  type="button"
                  className="text-button"
                  disabled={pending || operation.isPending}
                  onClick={async (): Promise<void> => {
                    if (locked.current) return;
                    locked.current = true;
                    try {
                      await operation.mutateAsync((): Promise<unknown> =>
                        api.resend(email),
                      );
                      setMessage("Verification email sent.");
                      setError("");
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      locked.current = false;
                    }
                  }}
                >
                  Resend verification email
                </button>
              )}
            </div>
          )}
          {message && (
            <div className="success-message" role="status">
              <Mail size={19} />
              {message}
            </div>
          )}
          {!message && (
            <button
              className="button full"
              type="submit"
              disabled={pending || operation.isPending}
            >
              {pending ? <LoaderCircle className="spin" size={18} /> : null}
              {mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Update password"
                      : "Verify email"}
              <ArrowRight size={17} />
            </button>
          )}
        </form>
        <div className="auth-bottom">
          {mode === "login" ? (
            <>
              New to Arena? <Link to="/auth/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/auth/login">Sign in</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
