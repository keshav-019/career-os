"use client";

import { Loader2, Network, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSystemDesignProblems, type SystemDesignProblemSummary } from "@/lib/interview/system-design-client";

type TrackFilter = "all" | "classic" | "ml" | "mlops";

const TRACK_FILTERS: { id: TrackFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic Systems" },
  { id: "ml", label: "ML" },
  { id: "mlops", label: "MLOps" }
];

const PROBLEMS_PAGE_SIZE = 10;

function matchesTrackFilter(problem: SystemDesignProblemSummary, filter: TrackFilter): boolean {
  if (filter === "all") return true;
  if (filter === "ml") return problem.tags.includes("ML");
  if (filter === "mlops") return problem.tags.includes("MLOps");
  return !problem.tags.includes("ML") && !problem.tags.includes("MLOps");
}

export default function SystemDesignBrowser() {
  const [problems, setProblems] = useState<SystemDesignProblemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [problemsPage, setProblemsPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const problemList = await listSystemDesignProblems();
      setProblems(problemList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the system design catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProblems = useMemo(() => {
    if (!problems) return null;
    return problems.filter((problem) => matchesTrackFilter(problem, trackFilter));
  }, [problems, trackFilter]);
  const totalProblemsPages = Math.max(1, Math.ceil((filteredProblems?.length ?? 0) / PROBLEMS_PAGE_SIZE));
  const activeProblemsPage = Math.min(problemsPage, totalProblemsPages);
  const paginatedProblems = useMemo(() => {
    const startIndex = (activeProblemsPage - 1) * PROBLEMS_PAGE_SIZE;
    return (filteredProblems ?? []).slice(startIndex, startIndex + PROBLEMS_PAGE_SIZE);
  }, [activeProblemsPage, filteredProblems]);

  return (
    <section className="career-card sd-shell" data-track="system-design">
      <div className="card-header">
        <div>
          <p className="eyebrow">System Design Track</p>
          <h2>{problems?.length ?? 26} real interview architectures, built top-down</h2>
          <p>Drag the right component onto the right slot - starting from a single client, branching down. Now with ML & MLOps design problems too.</p>
        </div>
        <Network size={20} />
      </div>

      {!loading && !error && problems && problems.length > 0 ? (
        <div className="sd-track-filters">
          {TRACK_FILTERS.map((filter) => (
            <button
              className={`sd-track-filter-chip${trackFilter === filter.id ? " sd-track-filter-active" : ""}`}
              key={filter.id}
              onClick={() => setTrackFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="empty-drop">
          <Loader2 className="spin" size={16} /> Loading the system design catalog...
        </div>
      ) : error ? (
        <div className="empty-drop coding-arena-error">
          {error}
          <button className="ghost-button" onClick={() => void load()} type="button">
            <RefreshCcw size={13} />
            Retry
          </button>
        </div>
      ) : !filteredProblems || filteredProblems.length === 0 ? (
        <div className="empty-drop">No problems found for this filter.</div>
      ) : (
        <>
          <ul className="sd-problem-list">
            {paginatedProblems.map((problem) => (
              <li className="sd-problem-row" key={problem.id}>
                <div>
                  <div className="row-between" style={{ alignItems: "center", gap: 10 }}>
                    <strong>{problem.title}</strong>
                    <span
                      className={`pill ${
                        problem.difficulty === "easy" ? "success" : problem.difficulty === "medium" ? "warning" : "danger"
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>
                  <p className="sd-problem-summary">{problem.summary}</p>
                  <div className="tag-cloud" style={{ marginTop: 8 }}>
                    {problem.companies.map((company) => (
                      <span key={`${problem.id}-${company}`}>{company}</span>
                    ))}
                    {problem.tags.slice(0, 3).map((tag) => (
                      <span key={`${problem.id}-${tag}`}>{tag}</span>
                    ))}
                  </div>
                </div>
                <Link className="primary-button" href={`/system-design/${problem.id}`}>
                  Design It
                </Link>
              </li>
            ))}
          </ul>

          {totalProblemsPages > 1 ? (
            <div className="analytics-pagination">
              <button
                className="ghost-button"
                disabled={activeProblemsPage <= 1}
                onClick={() => setProblemsPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="analytics-page-indicator">
                Page {activeProblemsPage} / {totalProblemsPages}
              </span>
              <button
                className="ghost-button"
                disabled={activeProblemsPage >= totalProblemsPages}
                onClick={() => setProblemsPage((current) => Math.min(totalProblemsPages, current + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
