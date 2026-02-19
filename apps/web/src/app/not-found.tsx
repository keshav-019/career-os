import { Compass, Home, SearchX, Swords } from "lucide-react";
import Link from "next/link";

const helperCards = [
  {
    title: "Check the URL",
    description: "A small typo in the route can land you here. Verify spelling and try again.",
    tone: "brand"
  },
  {
    title: "Use navigation",
    description: "Jump back into your workflow from Dashboard, Applications, or Interview War Room.",
    tone: "success"
  },
  {
    title: "Saved data is safe",
    description: "Nothing in your account was changed. This page only means the route does not exist.",
    tone: "warning"
  }
] as const;

export default function NotFoundPage() {
  return (
    <div className="page-stack not-found-shell">
      <section className="career-card highlight not-found-hero">
        <span className="not-found-code" aria-hidden="true">
          404
        </span>
        <p className="eyebrow">Page Not Found</p>
        <h2>This route drifted out of orbit.</h2>
        <p>
          The page you are looking for does not exist in CareerOS. Use one of the actions below to return to
          your command center.
        </p>

        <div className="not-found-actions">
          <Link className="primary-button" href="/dashboard">
            <Home size={15} /> Go to Dashboard
          </Link>
          <Link className="ghost-button" href="/applications">
            <Compass size={15} /> Open Applications
          </Link>
          <Link className="ghost-button" href="/interview-prep">
            <Swords size={15} /> Interview War Room
          </Link>
        </div>
      </section>

      <section className="not-found-grid" aria-label="Not found guidance">
        {helperCards.map((card) => (
          <article className="career-card not-found-tip-card" key={card.title}>
            <div className={`not-found-tip-icon ${card.tone}`}>
              <SearchX size={16} />
            </div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
