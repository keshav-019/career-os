import { BookOpen, Check, GraduationCap, Hammer, Video } from "lucide-react";

const path = [
  { title: "Master AI evaluation language", type: "Module", icon: BookOpen, done: true, time: "45m" },
  { title: "Build a resume-fit scoring explainer", type: "Project", icon: Hammer, done: true, time: "3h" },
  { title: "Practice product tradeoff stories", type: "Practice", icon: GraduationCap, current: true, time: "1h" },
  { title: "Watch: system design for workflow tools", type: "Course", icon: Video, time: "2h" },
  { title: "Mock: ambiguous AI product interview", type: "Interview", icon: GraduationCap, time: "45m" }
];

export default function LearningPage() {
  return (
    <section className="two-column-grid">
      <div className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Active Path</p>
            <h2>AI Product Engineer</h2>
            <p>5 of 12 steps complete / estimated 8h remaining.</p>
          </div>
          <span className="score">42%</span>
        </div>
        <div className="progress-track" style={{ marginBottom: 18 }}>
          <div className="progress-fill" style={{ width: "42%" }} />
        </div>
        <div className="learning-path">
          {path.map((step) => {
            const Icon = step.icon;

            return (
              <div className="learning-step" key={step.title}>
                <span className={step.done ? "question-number success-step" : "question-number"}>
                  {step.done ? <Check size={15} /> : <Icon size={15} />}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.type} / {step.time}</p>
                </div>
                {step.current ? <span className="pill brand">In progress</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="page-stack">
        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Recommended Builds</p>
              <h2>Portfolio drills</h2>
            </div>
          </div>
          <ul className="question-list">
            {[
              "Chrome extension parser for messy job pages",
              "Gmail classifier with explainable recruiter signals",
              "Interview memory timeline for each company"
            ].map((project, index) => (
              <li className="numbered-question" key={project}>
                <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
                <p>{project}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">This Week</p>
              <h2>Study rhythm</h2>
            </div>
          </div>
          <div className="mini-chart">
            {[80, 40, 100, 60, 30, 90, 50].map((height, index) => (
              <span key={index}>
                <i style={{ height: `${height}%` }} />
              </span>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
