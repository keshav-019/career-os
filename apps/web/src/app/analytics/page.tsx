import { BarChart3, PieChart, TrendingDown, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { mockAnalytics, mockJobs } from "@/lib/mock-data";

const funnel = [
  { label: "Saved", value: 142, pct: 100 },
  { label: "Applied", value: 96, pct: 68 },
  { label: "Recruiter Call", value: 38, pct: 27 },
  { label: "Technical", value: 18, pct: 13 },
  { label: "Final", value: 7, pct: 5 },
  { label: "Offer", value: 3, pct: 2 }
];

const demandRows = [
  { label: "TypeScript", value: 92 },
  { label: "React / Next.js", value: 88 },
  { label: "Firebase", value: 73 },
  { label: "AI product workflows", value: 68 },
  { label: "System design", value: 51 },
  { label: "Mobile notifications", value: 38 }
];

export default function AnalyticsPage() {
  const averageFit = Math.round(mockJobs.reduce((sum, job) => sum + job.fitScore, 0) / mockJobs.length);

  return (
    <div className="page-stack">
      <section className="metric-grid" aria-label="Analytics metrics">
        <MetricCard
          detail="+4.2 points over previous window"
          icon={TrendingUp}
          label="Response Rate"
          tone="green"
          value={`${mockAnalytics.responseRate}%`}
        />
        <MetricCard
          detail="+1.8 points over previous window"
          icon={BarChart3}
          label="Interview Rate"
          tone="blue"
          value={`${mockAnalytics.interviewRate}%`}
        />
        <MetricCard
          detail="Current mean across saved jobs"
          icon={PieChart}
          label="Average Fit"
          tone="amber"
          value={String(averageFit)}
        />
        <MetricCard
          detail="Offer conversion needs more data"
          icon={TrendingDown}
          label="Offer Rate"
          tone="rose"
          value="2.1%"
        />
      </section>

      <section className="career-grid-12">
        <div className="career-card span-7">
          <div className="card-header">
            <div>
              <p className="eyebrow">Application Funnel</p>
              <h2>90-day conversion</h2>
            </div>
            <span className="pill">142 tracked</span>
          </div>
          <div className="topic-list">
            {funnel.map((row) => (
              <div className="progress-row" key={row.label}>
                <div className="progress-label">
                  <span>{row.label}</span>
                  <strong>
                    {row.value} / {row.pct}%
                  </strong>
                </div>
                <div className="progress-track" style={{ height: 20 }}>
                  <div className="progress-fill" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="career-card span-5">
          <div className="card-header">
            <div>
              <p className="eyebrow">Market Signals</p>
              <h2>Technology demand</h2>
            </div>
          </div>
          <div className="topic-list">
            {demandRows.map((row) => (
              <div className="progress-row" key={row.label}>
                <div className="progress-label">
                  <span>{row.label}</span>
                  <strong>{row.value}%</strong>
                </div>
                <div className="progress-track">
                  <div className="progress-fill success" style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
