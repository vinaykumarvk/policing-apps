import { OFFICIALS, type Official } from "../officials";

/** State emblem placeholder: Ashoka-capital-inspired seal rendered inline. */
export function StateEmblem({ size = 56 }: { size?: number }): JSX.Element {
  return (
    <svg
      className="gov-emblem"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="State Emblem"
    >
      <circle cx="32" cy="32" r="30" fill="#0b2e59" stroke="#c8a94b" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#c8a94b" strokeWidth="1" />
      {/* Abstract pillar-and-lions silhouette */}
      <g fill="#f3e7c3">
        <rect x="26" y="34" width="12" height="4" rx="1" />
        <rect x="28" y="38" width="8" height="10" rx="1.5" />
        <path d="M32 14c-1.2 3-4.4 4.6-7 5.4 2 1.4 4.6 2 7 2s5-.6 7-2c-2.6-.8-5.8-2.4-7-5.4z" />
        <path d="M24 22.5c2.4 1.6 5.2 2.4 8 2.4s5.6-.8 8-2.4c-.6 3.6-1.6 6.8-2.6 9h-10.8c-1-2.2-2-5.4-2.6-9z" />
        <circle cx="32" cy="52" r="2.4" />
        <path d="M32 49.2l.8-2.4h-1.6z" />
      </g>
    </svg>
  );
}

function PortraitPlaceholder({ official }: { official: Official }): JSX.Element {
  return (
    <svg viewBox="0 0 96 112" role="img" aria-label={official.name ?? official.title}>
      <rect width="96" height="112" fill="#e8edf4" />
      <circle cx="48" cy="42" r="19" fill="#9fb2c8" />
      <path d="M16 112c3-24 15-33 32-33s29 9 32 33z" fill="#9fb2c8" />
    </svg>
  );
}

export function OfficialsRow(): JSX.Element {
  return (
    <section className="officials-row" aria-label="Dignitaries">
      {OFFICIALS.map((official) => (
        <figure key={official.id} className="official-card">
          <div className="official-photo">
            {official.photoUrl ? (
              <img src={official.photoUrl} alt={official.name ?? official.title} />
            ) : (
              <PortraitPlaceholder official={official} />
            )}
          </div>
          <figcaption>
            {official.name ? <strong>{official.name}</strong> : null}
            <span>{official.title}</span>
            <span className="official-title-ml" lang="ml">
              {official.titleMl}
            </span>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

export function GovBanner(): JSX.Element {
  return (
    <div className="gov-banner">
      <StateEmblem size={48} />
      <div className="gov-banner-text">
        <strong>
          Government of Kerala <span lang="ml">· കേരള സർക്കാർ</span>
        </strong>
        <span>
          Kerala Police <span lang="ml">· കേരള പോലീസ്</span>
        </span>
      </div>
    </div>
  );
}
