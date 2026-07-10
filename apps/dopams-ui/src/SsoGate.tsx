// Interstitial shown while a platform launch token (?sso=) is exchanged for a
// local session, so the user never sees this app's own login flash mid-handoff.
interface SsoGateProps {
  status: "exchanging" | "failed";
  onContinueToLogin: () => void;
}

export default function SsoGate({ status, onContinueToLogin }: SsoGateProps): JSX.Element {
  return (
    <div className="login-page sso-gate">
      <div className="sso-gate__card" role="status" aria-live="polite">
        {status === "exchanging" ? (
          <>
            <div className="sso-gate__spinner" aria-hidden="true" />
            <h1>Signing you in…</h1>
            <p>Completing single sign-on from the Integrated Policing Platform.</p>
          </>
        ) : (
          <>
            <div className="sso-gate__error-icon" aria-hidden="true">
              !
            </div>
            <h1>Single sign-on didn&rsquo;t complete</h1>
            <p>
              The platform launch link may have expired, or your platform account is not
              provisioned in this application yet. Sign in with your local credentials, or return
              to the platform and launch again.
            </p>
            <button type="button" className="sso-gate__continue" onClick={onContinueToLogin}>
              Continue to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
