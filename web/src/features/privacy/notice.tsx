import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPrivacyNotice, type PrivacyNotice } from "../../lib/api";
import { isCloudDeployment } from "../../lib/deployment";
import { Card } from "../../ui/card";
import { EpureBrandMark } from "../../ui/logo";

export function PrivacyNoticePage() {
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const cloud = notice?.deployment === "cloud" || isCloudDeployment();

  useEffect(() => {
    let cancelled = false;
    void fetchPrivacyNotice()
      .then((body) => {
        if (!cancelled) {
          setNotice(body);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const contact = notice?.privacy_contact;
  const operatorLine = notice?.operator_name
    ? `${notice.operator_name} operates this Epure instance.`
    : cloud
      ? "The Epure Cloud operator runs this service. The company name belongs on the privacy policy and the data processing agreement."
      : "Whoever installed this Epure instance operates it. Set EPURE_OPERATOR_NAME and EPURE_PRIVACY_CONTACT to name them on this page.";

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <EpureBrandMark size={32} />
          <div>
            <h1 className="text-base font-semibold tracking-ui text-ink">Privacy</h1>
            <p className="text-xs text-ink-muted">
              {cloud ? "Epure Cloud" : "Self-hosted Epure"} · session cookie only
            </p>
          </div>
        </div>

        <Card className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xs">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Who this is for</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {operatorLine} Workspace members are the people who sign in. People who use your
              application are a separate group: their errors may be sent here by your SDK. You decide
              what the SDK attaches. Epure's default is to drop their email, username, and precise
              location, and to never store their IP address.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">What stays on this server</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Issues, stack traces, and the account you use to sign in are stored in this instance's
              PostgreSQL database. Epure does not phone home, does not load analytics, and does not
              store session replay. Fonts are served from this instance.
              {notice?.data_region ? ` Data region: ${notice.data_region}.` : ""}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Cookie</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              One cookie keeps you signed in ({notice?.cookies[0]?.host_prefix_when_https ?? "__Host-epure.sid"}{" "}
              on HTTPS, otherwise epure.sid). It is HttpOnly, SameSite=Lax, and lasts 14 days of
              inactivity. It is required to use Epure, so there is no consent banner.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Your account</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Signed-in members can export their account data and delete the account from Settings →
              Security. Deleting an account removes the login. Project data belongs to the workspace.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">People in your error reports</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Each project can store emails and usernames only when an admin turns that on. IP
              addresses are not stored. Admins can export or delete events for one user id or email,
              and can strip identifiers already saved. Events expire on the project retention window
              (14, 30, or 90 days).
            </p>
          </section>

          {notice && notice.subprocessors.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink">Services this instance can contact</h2>
              <ul className="space-y-2">
                {notice.subprocessors.map((item) => (
                  <li key={item.name} className="text-sm leading-relaxed text-ink-muted">
                    <span className="font-medium text-ink">{item.name}.</span> {item.purpose}. {item.data}.
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink">Services this instance can contact</h2>
              <p className="text-sm leading-relaxed text-ink-muted">
                Outbound mail, Google sign-in, and GitHub sign-in are off until the operator sets
                them. Webhooks go only to URLs you configure. Nothing is sent to Epure's authors.
              </p>
            </section>
          )}

          {cloud ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink">Cloud billing</h2>
              <p className="text-sm leading-relaxed text-ink-muted">
                Subscriptions, invoices, and the payment provider are not part of this binary. The
                cloud billing service has to publish the contract, the data processing agreement, and
                where payment data is processed. This page cannot invent that legal identity.
              </p>
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Contact</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              {contact ? (
                <a className="text-ink underline underline-offset-2" href={`mailto:${contact}`}>
                  {contact}
                </a>
              ) : (
                "The operator has not set a privacy contact on this instance yet."
              )}
              {notice?.privacy_policy_url ? (
                <>
                  {" "}
                  <a
                    className="text-ink underline underline-offset-2"
                    href={notice.privacy_policy_url}
                  >
                    Privacy policy
                  </a>
                </>
              ) : null}
              {notice?.dpa_url ? (
                <>
                  {" "}
                  <a className="text-ink underline underline-offset-2" href={notice.dpa_url}>
                    Data processing agreement
                  </a>
                </>
              ) : null}
            </p>
          </section>
        </Card>

        <p className="text-center text-xs text-ink-muted">
          <Link to="/login" className="text-ink underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
