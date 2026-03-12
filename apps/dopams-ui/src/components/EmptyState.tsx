type IconName = "search" | "chart" | "inbox" | "shield";

const ICONS: Record<IconName, string> = {
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  chart: "M3 3v18h18M9 17V9m4 8V5m4 12v-4",
  inbox: "M20 21V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2zM9 10h6M9 14h4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

type Props = {
  icon?: IconName;
  title: string;
  subtitle?: string;
};

export default function EmptyState({ icon = "inbox", title, subtitle }: Props) {
  return (
    <div className="empty-state">
      <svg
        className="empty-state__icon"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ICONS[icon]} />
      </svg>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
