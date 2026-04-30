import { ExternalLink, Filter, LayoutGrid, Rows3, Tag } from "lucide-react";
import { mockJobs } from "@/lib/mock-data";

const columns = [
  { id: "saved", title: "Saved", dot: "", jobs: mockJobs.filter((job) => job.status === "saved") },
  { id: "applied", title: "Applied", dot: "", jobs: mockJobs.filter((job) => job.status === "applied") },
  { id: "technical", title: "Interviewing", dot: "brand", jobs: mockJobs.filter((job) => job.status === "interviewing") },
  { id: "offer", title: "Offer", dot: "success", jobs: mockJobs.filter((job) => job.status === "offer") },
  { id: "rejected", title: "Closed", dot: "warning", jobs: mockJobs.filter((job) => job.status === "rejected") }
];

export default function ApplicationsPage() {
  return (
    <div className="page-stack">
      <section className="kanban-toolbar">
        <div className="segmented-control" aria-label="Application view">
          <button className="segmented-button active" type="button">
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button className="segmented-button" type="button">
            <Rows3 size={14} />
            Table
          </button>
        </div>

        <div className="filter-group" aria-label="Source filters">
          {["All", "Chrome", "Gmail", "LinkedIn", "Referral"].map((filter, index) => (
            <button className={index === 0 ? "segmented-button active" : "segmented-button"} key={filter} type="button">
              {filter}
            </button>
          ))}
          <button className="icon-button" aria-label="Filter applications" type="button">
            <Filter size={16} />
          </button>
        </div>
      </section>

      <section className="kanban-board" aria-label="Application pipeline">
        {columns.map((column) => (
          <div className="kanban-column" key={column.id}>
            <div className="column-title">
              <span>
                <i className={`column-dot ${column.dot}`} />
                {column.title}
              </span>
              <strong>{column.jobs.length}</strong>
            </div>

            {column.jobs.length > 0 ? (
              column.jobs.map((job) => (
                <article className="kanban-card" key={job.id}>
                  <div className="row-between">
                    <div className={`company-mark ${job.fitScore >= 85 ? "brand" : job.fitScore >= 70 ? "success" : "warning"}`}>
                      {job.company.charAt(0)}
                    </div>
                    <span className="card-id">#{job.id.slice(-5).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3>{job.role}</h3>
                    <p>{job.company} / {job.location}</p>
                    <p>{job.salaryRange ? `${job.salaryRange.currency} ${job.salaryRange.min}-${job.salaryRange.max}` : job.remotePolicy}</p>
                  </div>
                  <div className="row-between">
                    <span className="pill">
                      <Tag size={11} />
                      {job.source}
                    </span>
                    <span className={job.fitScore >= 85 ? "pill success" : "pill brand"}>
                      {job.fitScore}% match
                    </span>
                  </div>
                  {job.sourceUrl ? (
                    <a className="ghost-button" href={job.sourceUrl}>
                      <ExternalLink size={13} />
                      Source
                    </a>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="empty-drop">Empty</div>
            )}

            <button className="ghost-button" type="button">Add card</button>
          </div>
        ))}
      </section>
    </div>
  );
}
