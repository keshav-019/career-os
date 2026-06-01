import { Code2, MessageSquare, Play, Swords, Timer } from "lucide-react";

const mocks = [
  { title: "Behavioral Story Drill", icon: MessageSquare, time: "30 min", score: "82" },
  { title: "AI Product Case", icon: Swords, time: "45 min", score: "76" },
  { title: "Frontend Architecture", icon: Code2, time: "60 min", score: "88" }
];

export default function MockTestsPage() {
  return (
    <div className="mock-grid">
      {mocks.map((mock) => {
        const Icon = mock.icon;

        return (
          <article className="career-card" key={mock.title}>
            <div className="card-header">
              <div className="metric-icon">
                <Icon size={18} />
              </div>
              <span className="score small">{mock.score}</span>
            </div>
            <h2>{mock.title}</h2>
            <p className="muted">
              <Timer size={12} /> {mock.time}
            </p>
            <button className="primary-button" style={{ marginTop: 18, width: "100%" }} type="button">
              <Play size={15} />
              Start
            </button>
          </article>
        );
      })}
    </div>
  );
}
