import { BookOpen, Building2, Clock, MessageSquare, Sparkles, Swords, Target } from "lucide-react";
import { mockInterviewRounds, mockJobs, mockResumeVersions } from "@/lib/mock-data";

const tabs = ["Overview", "Questions", "Company", "Notes", "History", "Resources"];

const topicRows = [
  { label: "React architecture", value: 92, tone: "success" },
  { label: "System design", value: 78, tone: "success" },
  { label: "AI evaluation", value: 54, tone: "warning" },
  { label: "Experiment framing", value: 41, tone: "warning" }
];

export default function InterviewPrepPage() {
  const round = mockInterviewRounds[0];
  const job = mockJobs.find((item) => item.id === round.jobId);
  const resume = mockResumeVersions.find((item) => item.id === job?.resumeVersionId);

  return (
    <div className="page-stack">
      <div className="tab-row" role="tablist" aria-label="Interview workspace sections">
        {tabs.map((tab, index) => (
          <button className={index === 0 ? "tab-button active" : "tab-button"} key={tab} type="button">
            {tab}
          </button>
        ))}
      </div>

      <section className="two-column-grid">
        <div className="page-stack">
          <div className="career-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Likely Questions</p>
                <h2>{job?.company} hiring manager round</h2>
              </div>
              <MessageSquare size={19} />
            </div>
            <ul className="question-list">
              {round.prepQuestions.map((question, index) => (
                <li className="numbered-question" key={question}>
                  <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p>{question}</p>
                    <span className={index === 1 ? "pill warning" : "pill brand"}>
                      {index === 1 ? "AI systems" : "Product judgment"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="career-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Resume Mapping</p>
                <h2>{resume?.label}</h2>
              </div>
              <span className="score">{resume?.keywordCoverage}</span>
            </div>
            <ul className="question-list">
              {resume?.bulletHighlights.map((bullet, index) => (
                <li className="numbered-question" key={bullet}>
                  <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
                  <p>{bullet}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="page-stack">
          <div className="career-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Company Intel</p>
                <h2>{job?.company}</h2>
              </div>
              <Building2 size={19} />
            </div>
            <dl className="details-list">
              {[
                ["Stage", "Growth-stage SaaS"],
                ["Team", "AI workflow platform"],
                ["Interviewer", round.interviewer ?? "Hiring manager"],
                ["Signal", "Product taste and speed"],
                ["Resume", resume?.label ?? "Unmapped"]
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="career-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Strengths & Gaps</p>
                <h2>Prep scorecard</h2>
              </div>
              <Target size={19} />
            </div>
            <div className="topic-list">
              {topicRows.map((topic) => (
                <div className="progress-row" key={topic.label}>
                  <div className="progress-label">
                    <span>{topic.label}</span>
                    <strong>{topic.value}%</strong>
                  </div>
                  <div className="progress-track">
                    <div className={`progress-fill ${topic.tone}`} style={{ width: `${topic.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="career-card highlight">
            <div className="card-header">
              <div>
                <p className="eyebrow">AI Recommendation</p>
                <h2>Next study block</h2>
              </div>
              <Sparkles size={19} />
            </div>
            <p className="muted">
              Spend the next 45 minutes tightening model evaluation vocabulary and turn one project bullet into a measurable story.
            </p>
            <div className="row-between" style={{ marginTop: 16 }}>
              <span className="pill warning">
                <Clock size={12} />
                45 min
              </span>
              <button className="ghost-button" type="button">
                <BookOpen size={14} />
                Schedule
              </button>
            </div>
          </div>

          <button className="primary-button" type="button">
            <Swords size={16} />
            Start Mock Interview
          </button>
        </aside>
      </section>
    </div>
  );
}
