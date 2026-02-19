"use client";

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
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatShortDate } from "@/lib/format";
import { useUserJobs, type CareerJob } from "@/lib/firebase/jobs";

const ACTIVE_PIPELINE_STATUSES = new Set<CareerJob["status"]>(["saved", "applied", "interviewing", "offer"]);
const RESPONSE_STATUSES = new Set<CareerJob["status"]>(["interviewing", "offer", "rejected"]);
const RESPONSE_BASE_STATUSES = new Set<CareerJob["status"]>(["applied", "interviewing", "offer", "rejected"]);

function buildVelocityBars(jobs: CareerJob[]): number[] {
  const dayBuckets = new Array<number>(14).fill(0);
  const today = new Date();
  const startWindow = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13).getTime();

  jobs.forEach((job) => {
    const savedAtTime = Date.parse(job.savedAt);
    if (!Number.isFinite(savedAtTime) || savedAtTime < startWindow) {
      return;
    }

    const dayOffset = Math.floor((savedAtTime - startWindow) / (24 * 60 * 60 * 1000));
    if (dayOffset >= 0 && dayOffset < dayBuckets.length) {
      dayBuckets[dayOffset] += 1;
    }
  });

  const maxCount = Math.max(...dayBuckets, 0);
  if (maxCount === 0) {
    return dayBuckets.map(() => 0);
  }

  return dayBuckets.map((count) => Math.round((count / maxCount) * 100));
}

function buildPrepQuestions(job: CareerJob): string[] {
  const firstTag = job.tags[0] ?? "core requirement";
  const secondTag = job.tags[1] ?? "cross-team collaboration";
  const shortRole = job.role.split(" ").slice(0, 2).join(" ");

  return [
    `Walk through a project where you delivered strong outcomes in a ${shortRole} context.`,
    `How would you evaluate tradeoffs around ${firstTag} for ${job.company}?`,
    `Describe how you would collaborate with stakeholders on ${secondTag}.`
  ];
}

function buildSkillRows(job: CareerJob | null): Array<{ label: string; tone: "success" | "warning"; value: number }> {
  if (!job) {
    return [
      { label: "Role fundamentals", tone: "warning", value: 0 },
      { label: "System design", tone: "warning", value: 0 },
      { label: "Communication", tone: "warning", value: 0 }
    ];
  }

  const labels = job.tags.slice(0, 3).map((tag) =>
    tag
      .split("-")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
      .join(" ")
  );

  while (labels.length < 3) {
    labels.push(labels.length === 0 ? "Role fundamentals" : labels.length === 1 ? "System design" : "Communication");
  }

  return labels.map((label, index) => {
    const value = Math.max(0, Math.min(100, job.fitScore - index * 12));
    return {
      label,
      tone: value >= 70 ? "success" : "warning",
      value
    };
  });
}

export default function DashboardPage() {
  const { error, jobs, loading } = useUserJobs();
  const activeJobs = jobs.filter((job) => ACTIVE_PIPELINE_STATUSES.has(job.status));
  const interviewingJobs = jobs.filter((job) => job.status === "interviewing");
  const offerJobs = jobs.filter((job) => job.status === "offer");
  const queueJobs = jobs.filter((job) => job.status === "applied" || job.status === "saved");
  const recruiterReplies = jobs.filter((job) => RESPONSE_STATUSES.has(job.status)).length;
  const responseBase = jobs.filter((job) => RESPONSE_BASE_STATUSES.has(job.status)).length;
  const responseRate = responseBase > 0 ? Math.round((recruiterReplies / responseBase) * 100) : 0;
  const interviewRate = responseBase > 0 ? Math.round(((interviewingJobs.length + offerJobs.length) / responseBase) * 100) : 0;
  const averageFit = jobs.length > 0 ? Math.round(jobs.reduce((sum, job) => sum + job.fitScore, 0) / jobs.length) : 0;
  const chartBars = buildVelocityBars(jobs);

  const nextActionJobs = jobs
    .filter((job) => Boolean(job.nextActionAt))
    .sort((first, second) => Date.parse(first.nextActionAt ?? "") - Date.parse(second.nextActionAt ?? ""));
  const nextMissionJob = nextActionJobs[0] ?? null;
  const prepQuestions = nextMissionJob ? buildPrepQuestions(nextMissionJob) : [];
  const skillRows = buildSkillRows(nextMissionJob);
  const signalJobs = jobs.filter((job) => RESPONSE_STATUSES.has(job.status)).slice(0, 4);

  const pipelineColumns = [
    { title: "Technical Round", dot: "brand", jobs: interviewingJobs },
    { title: "Decision Queue", dot: "warning", jobs: queueJobs },
    { title: "Offers", dot: "success", jobs: offerJobs }
  ];

  return (
    <div className="page-stack">
      {error ? <p className="settings-feedback error">{error}</p> : null}

      <section className="metric-grid" aria-label="Career metrics">
        <MetricCard
          detail={loading ? "Syncing your latest jobs" : `${activeJobs.length} active opportunities`}
          icon={Briefcase}
          label="Active Pipeline"
          tone="blue"
          value={String(activeJobs.length)}
        />
        <MetricCard
          detail={loading ? "Syncing your latest jobs" : `${interviewRate}% interview rate`}
          icon={CalendarClock}
          label="Interviews"
          tone="green"
          value={String(interviewingJobs.length)}
        />
        <MetricCard
          detail={loading ? "Syncing your latest jobs" : "Average across saved jobs"}
          icon={Target}
          label="Resume Match"
          tone="amber"
          value={String(averageFit)}
        />
        <MetricCard
          detail={loading ? "Syncing your latest jobs" : `${responseRate}% response rate`}
          icon={MailCheck}
          label="Recruiter Replies"
          tone="rose"
          value={String(recruiterReplies)}
        />
      </section>

      <section className="dashboard-grid">
        <div className="career-card">
          <div className="kanban-heading">
            <div>
              <p className="eyebrow">Command Pipeline</p>
              <h2>Active mission board</h2>
              <p>Live applications, real statuses, and next actions from your account.</p>
            </div>
            <div className="segmented-control">
              <button className="segmented-button active" type="button">
                Kanban
              </button>
              <Link className="segmented-button" href="/applications">
                Table
              </Link>
            </div>
          </div>

          <div className="pipeline-columns">
            {pipelineColumns.map((column) => (
              <div className="pipeline-column" key={column.title}>
                <div className="column-title">
                  <span>
                    <i
                      className={`column-dot ${column.dot === "success" ? "success" : column.dot === "warning" ? "warning" : ""}`}
                    />
                    {column.title}
                  </span>
                  <strong>{column.jobs.length}</strong>
                </div>

                {column.jobs.length > 0 ? (
                  column.jobs.map((job) => (
                    <article className="pipeline-card" key={job.id}>
                      <div className="row-between">
                        <CompanyAvatar
                          company={job.company}
                          logoUrl={job.companyLogoUrl}
                          toneClassName={job.fitScore > 85 ? "brand" : job.fitScore > 70 ? "success" : "warning"}
                        />
                        <span className="card-id">#{job.id.slice(-5).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3>{job.role}</h3>
                        <p>
                          {job.company} / {job.location}
                        </p>
                      </div>
                      <div className="row-between">
                        <StatusBadge status={job.status} />
                        <span className={job.fitScore >= 85 ? "pill success" : "pill brand"}>Match {job.fitScore}%</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-drop">No roles in this lane yet.</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">AI War Room</p>
              <h2>{nextMissionJob ? nextMissionJob.company : "No interview mission yet"}</h2>
              <p>{nextMissionJob ? nextMissionJob.role : "Save and apply to jobs to unlock tailored prep."}</p>
            </div>
            <Sparkles size={20} />
          </div>

          {nextMissionJob ? (
            <ul className="war-room-list">
              {prepQuestions.map((question, index) => (
                <li className="numbered-question" key={question}>
                  <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
                  <p>{question}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-drop">No active interview context yet. Once a job reaches interview status, prep appears here.</div>
          )}

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
              {skillRows.map((skill) => (
                <div className="progress-row" key={skill.label}>
                  <div className="progress-label">
                    <span>{skill.label}</span>
                    <strong>{skill.value}%</strong>
                  </div>
                  <div className="progress-track">
                    <div className={`progress-fill ${skill.tone}`} style={{ width: `${skill.value}%` }} />
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
              <p>{jobs.length === 0 ? "No job activity yet." : "Based on saved job activity over the last 14 days."}</p>
            </div>
            <TrendingUp size={19} />
          </div>
          <div className="mini-chart" aria-label="Application velocity chart">
            {chartBars.map((height, index) => (
              <span key={index}>
                <i style={{ height: `${height}%` }} />
                <b style={{ height: `${Math.max(0, Math.round(height * 0.25))}%` }} />
              </span>
            ))}
          </div>
        </div>

        <div className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Next Mission Event</p>
              <h2>{nextMissionJob ? `${nextMissionJob.company} follow-up` : "No event scheduled"}</h2>
            </div>
            <Video size={19} />
          </div>

          {nextMissionJob?.nextActionAt ? (
            <div className="event-line">
              <div className="calendar-day-tile">
                <span>{new Date(nextMissionJob.nextActionAt).toLocaleDateString(undefined, { month: "short" })}</span>
                <strong>{String(new Date(nextMissionJob.nextActionAt).getDate()).padStart(2, "0")}</strong>
              </div>
              <div>
                <h3>{nextMissionJob.role}</h3>
                <p>
                  <Clock size={12} /> {new Date(nextMissionJob.nextActionAt).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="empty-drop">Set next actions in your workflow to surface mission events here.</div>
          )}

          <div className="signal-list" style={{ marginTop: 16 }}>
            {signalJobs.length === 0 ? (
              <div className="empty-drop">No response signals yet.</div>
            ) : (
              signalJobs.map((job) => (
                <div className="signal-row" key={job.id}>
                  <span className={job.status === "interviewing" || job.status === "offer" ? "pill success" : "pill warning"}>
                    {job.status}
                  </span>
                  <div>
                    <strong>{job.role}</strong>
                    <p>{job.company}</p>
                  </div>
                  <span>{job.fitScore}%</span>
                </div>
              ))
            )}
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
        {nextActionJobs.length === 0 ? (
          <div className="empty-drop">No pending follow-ups. Save jobs and add next-action dates to build your queue.</div>
        ) : (
          <div className="timeline">
            {nextActionJobs.slice(0, 8).map((job) => (
              <div className="timeline-item" key={job.id}>
                <span className="question-number">{job.company.charAt(0)}</span>
                <div>
                  <strong>{job.company}</strong>
                  <p>{job.role}</p>
                </div>
                <time className="pill">{formatShortDate(job.nextActionAt ?? "")}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
