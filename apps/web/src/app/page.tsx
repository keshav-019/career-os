import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  MailCheck,
  Sparkles,
  Target,
  TrendingUp,
  Video
} from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatShortDate } from "@/lib/format";
import { mockAnalytics, mockEmails, mockInterviewRounds, mockJobs } from "@/lib/mock-data";

const chartBars = [40, 55, 35, 70, 50, 85, 60, 45, 65, 80, 55, 95, 70, 88];

const pipelineColumns = [
  {
    title: "Technical Round",
    dot: "brand",
    jobs: mockJobs.filter((job) => job.status === "interviewing")
  },
  {
    title: "Decision Queue",
    dot: "warning",
    jobs: mockJobs.filter((job) => job.status === "applied" || job.status === "saved")
  },
  {
    title: "Offers",
    dot: "success",
    jobs: mockJobs.filter((job) => job.status === "offer")
  }
];

export default function DashboardPage() {
  const nextInterview = mockInterviewRounds[0];
  const nextInterviewJob = mockJobs.find((job) => job.id === nextInterview.jobId);

  return (
    <div className="page-stack">
      <section className="metric-grid" aria-label="Career metrics">
        <MetricCard
          detail="+12% pipeline growth"
          icon={Briefcase}
          label="Active Pipeline"
          tone="blue"
          value={String(mockAnalytics.applications)}
        />
        <MetricCard
          detail={`${mockAnalytics.interviewRate}% interview rate`}
          icon={CalendarClock}
          label="Interviews"
          tone="green"
          value={String(mockAnalytics.interviews)}
        />
        <MetricCard
          detail="Average across saved roles"
          icon={Target}
          label="Resume Match"
          tone="amber"
          value="84"
        />
        <MetricCard
          detail={`${mockAnalytics.responseRate}% response rate`}
          icon={MailCheck}
          label="Recruiter Replies"
          tone="rose"
          value={String(mockAnalytics.recruiterReplies)}
        />
      </section>

      <section className="dashboard-grid">
        <div className="career-card">
          <div className="kanban-heading">
            <div>
              <p className="eyebrow">Command Pipeline</p>
              <h2>Active mission board</h2>
              <p>Synced job saves, recruiter signals, resume match, and next actions.</p>
            </div>
            <div className="segmented-control">
              <button className="segmented-button active" type="button">Kanban</button>
              <Link className="segmented-button" href="/applications">Table</Link>
            </div>
          </div>

          <div className="pipeline-columns">
            {pipelineColumns.map((column) => (
              <div className="pipeline-column" key={column.title}>
                <div className="column-title">
                  <span>
                    <i className={`column-dot ${column.dot === "success" ? "success" : column.dot === "warning" ? "warning" : ""}`} />
                    {column.title}
                  </span>
                  <strong>{column.jobs.length}</strong>
                </div>

                {column.jobs.length > 0 ? (
                  column.jobs.map((job) => (
                    <article className="pipeline-card" key={job.id}>
                      <div className="row-between">
                        <div className={`company-mark ${job.fitScore > 85 ? "brand" : job.fitScore > 70 ? "success" : "warning"}`}>
                          {job.company.charAt(0)}
                        </div>
                        <span className="card-id">#{job.id.slice(-5).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3>{job.role}</h3>
                        <p>{job.company} / {job.location}</p>
                      </div>
                      <div className="row-between">
                        <StatusBadge status={job.status} />
                        <span className={job.fitScore >= 85 ? "pill success" : "pill brand"}>
                          Match {job.fitScore}%
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-drop">No active offers</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">AI War Room</p>
              <h2>{nextInterviewJob?.company}</h2>
              <p>{nextInterviewJob?.role}</p>
            </div>
            <Sparkles size={20} />
          </div>

          <ul className="war-room-list">
            {nextInterview.prepQuestions.slice(0, 3).map((question, index) => (
              <li className="numbered-question" key={question}>
                <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
                <p>{question}</p>
              </li>
            ))}
          </ul>

          <div className="inline-section">
            <div className="card-header">
              <div>
                <p className="eyebrow">Skill Gap</p>
                <h3>Prep focus</h3>
              </div>
              <Link className="pill brand" href="/interview-prep">
                Full report <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="topic-list">
              {[
                { label: "Experiment design", value: 72, tone: "success" },
                { label: "Model evaluation", value: 48, tone: "warning" },
                { label: "Product storytelling", value: 84, tone: "success" }
              ].map((skill) => (
                <div className="progress-row" key={skill.label}>
                  <div className="progress-label">
                    <span>{skill.label}</span>
                    <strong>{skill.value}%</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${skill.tone}`}
                      style={{ width: `${skill.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="dashboard-grid">
        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Application Velocity</p>
              <h2>14-day trend</h2>
            </div>
            <TrendingUp size={19} />
          </div>
          <div className="mini-chart" aria-label="Application velocity chart">
            {chartBars.map((height, index) => (
              <span key={index}>
                <i style={{ height: `${height}%` }} />
                <b style={{ height: `${Math.max(8, height * 0.25)}%` }} />
              </span>
            ))}
          </div>
        </div>

        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Next Mission Event</p>
              <h2>{nextInterviewJob?.company} round</h2>
            </div>
            <Video size={19} />
          </div>
          <div className="event-line">
            <div className="calendar-day-tile">
              <span>Jun</span>
              <strong>03</strong>
            </div>
            <div>
              <h3>{nextInterviewJob?.role}</h3>
              <p>
                <Clock size={12} /> {nextInterview.interviewer} / hiring manager
              </p>
            </div>
          </div>

          <div className="signal-list" style={{ marginTop: 16 }}>
            {mockEmails.map((email) => (
              <div className="signal-row" key={email.id}>
                <span className={email.signal === "interview" ? "pill success" : "pill warning"}>
                  {email.signal}
                </span>
                <div>
                  <strong>{email.subject}</strong>
                  <p>{email.sender}</p>
                </div>
                <span>{Math.round(email.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Calendar Queue</p>
            <h2>Next actions</h2>
          </div>
          <CheckCircle2 size={19} />
        </div>
        <div className="timeline">
          {mockJobs
            .filter((job) => job.nextActionAt)
            .map((job) => (
              <div className="timeline-item" key={job.id}>
                <span className="question-number">
                  {job.company.charAt(0)}
                </span>
                <div>
                  <strong>{job.company}</strong>
                  <p>{job.role}</p>
                </div>
                <time className="pill">{formatShortDate(job.nextActionAt ?? "")}</time>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
