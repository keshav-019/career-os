'use client';

import { Clock3, Code2, Loader2, Play, RefreshCcw, ShieldCheck, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CODING_LANGUAGES,
  getCodingRuntimeStatus,
  listCodingProblems,
  type CodingProblemSummary,
  type CodingRuntimeStatus
} from '@/lib/interview/coding-arena-client';
import { buildCodingPapers, type CodingPaper } from '@/lib/interview/coding-paper-planner';

type CodingArenaTab = 'papers' | 'problems';

const PAPER_SESSION_PREFIX = 'careeros:coding-paper:';
const PROBLEMS_PAGE_SIZE = 10;

export default function CodingArenaBrowser() {
  const router = useRouter();
  const [problems, setProblems] = useState<CodingProblemSummary[] | null>(null);
  const [runtime, setRuntime] = useState<CodingRuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CodingArenaTab>('papers');
  const [problemsPage, setProblemsPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The problem catalog now comes straight from this web app's own API (Firestore-backed) and works with no
      // desktop app running at all. Local judge/runtime status is fetched separately and best-effort - it only
      // affects the per-language availability pills, never whether the catalog itself loads.
      const problemList = await listCodingProblems();
      setProblems(problemList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load coding problems.');
      setLoading(false);
      return;
    }

    setLoading(false);

    try {
      const runtimeStatus = await getCodingRuntimeStatus();
      setRuntime(runtimeStatus);
    } catch {
      setRuntime(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const papers = useMemo(() => buildCodingPapers(problems ?? []), [problems]);
  const totalProblemsPages = Math.max(1, Math.ceil((problems?.length ?? 0) / PROBLEMS_PAGE_SIZE));
  const activeProblemsPage = Math.min(problemsPage, totalProblemsPages);
  const paginatedProblems = useMemo(() => {
    const startIndex = (activeProblemsPage - 1) * PROBLEMS_PAGE_SIZE;
    return (problems ?? []).slice(startIndex, startIndex + PROBLEMS_PAGE_SIZE);
  }, [activeProblemsPage, problems]);

  const startPaper = useCallback(
    async (paper: CodingPaper) => {
      const firstProblem = paper.problems[0];
      if (!firstProblem) return;

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          `${PAPER_SESSION_PREFIX}${paper.id}`,
          JSON.stringify({
            id: paper.id,
            title: paper.title,
            durationMinutes: paper.durationMinutes,
            startedAt: Date.now(),
            problems: paper.problems
          })
        );
      }

      try {
        if (typeof document !== 'undefined' && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Some browsers only allow fullscreen from very specific user gestures.
        // The coding room still exposes a fullscreen control if this is denied.
      }

      router.push(`/coding-room/${firstProblem.id}?paper=${encodeURIComponent(paper.id)}`);
    },
    [router]
  );

  return (
    <section className="career-card coding-arena-shell" data-track="coding">
      <div className="card-header">
        <div>
          <p className="eyebrow">Coding Track</p>
          <h2>Desktop coding arena</h2>
          <p>Practice individual problems or start a 90-minute paper with local execution and hidden tests.</p>
        </div>
        <Code2 size={20} />
      </div>

      <div className="coding-arena-language-strip">
        {CODING_LANGUAGES.map(({ id, label }) => {
          const status = runtime?.[id];
          const tone = status?.available ? 'success' : 'warning';
          return (
            <span className={`pill ${tone}`} key={id} title={status?.message || 'Checking...'}>
              <Terminal size={11} />
              {label}
            </span>
          );
        })}
        <button className="ghost-button coding-arena-refresh" onClick={() => void load()} type="button">
          <RefreshCcw size={13} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty-drop">
          <Loader2 className="spin" size={16} /> Connecting to the local judge...
        </div>
      ) : error ? (
        <div className="empty-drop coding-arena-error">
          {error}
          <button className="ghost-button" onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      ) : !problems || problems.length === 0 ? (
        <div className="empty-drop">No problems found.</div>
      ) : (
        <>
          <div className="coding-arena-tabs" role="tablist" aria-label="Coding arena mode">
            <button
              aria-selected={activeTab === 'papers'}
              className={activeTab === 'papers' ? 'active' : ''}
              onClick={() => setActiveTab('papers')}
              role="tab"
              type="button"
            >
              <Clock3 size={14} />
              Test Papers
            </button>
            <button
              aria-selected={activeTab === 'problems'}
              className={activeTab === 'problems' ? 'active' : ''}
              onClick={() => setActiveTab('problems')}
              role="tab"
              type="button"
            >
              <Code2 size={14} />
              Problems
            </button>
          </div>

          {activeTab === 'papers' ? (
            <div className="coding-paper-grid">
              {papers.map((paper) => (
                <article className="coding-paper-row" key={paper.id}>
                  <div className="coding-paper-row-top">
                    <div>
                      <p className="eyebrow">90 minute paper</p>
                      <h3>{paper.title}</h3>
                      <p>{paper.focus}</p>
                    </div>
                    <span className="metric-icon">
                      <ShieldCheck size={16} />
                    </span>
                  </div>

                  <div className="coding-paper-problems">
                    {paper.problems.map((problem, index) => (
                      <div className="coding-paper-problem-chip" key={problem.id}>
                        <span>{index === 0 ? 'Easy-medium' : index === 1 ? 'Hard-medium' : 'Hard'}</span>
                        <strong>{problem.title}</strong>
                        <em>{problem.difficulty}</em>
                      </div>
                    ))}
                  </div>

                  <div className="coding-paper-row-footer">
                    <span>{paper.problems.length} problems</span>
                    <button className="primary-button" onClick={() => void startPaper(paper)} type="button">
                      <Play size={14} />
                      Start Paper
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <>
              <ul className="coding-arena-problem-list">
                {paginatedProblems.map((problem) => (
                  <li className="coding-arena-problem-row" key={problem.id}>
                    <div>
                      <div className="coding-arena-problem-title">
                        <strong>{problem.title}</strong>
                        <span className="pill danger">{problem.difficulty}</span>
                      </div>
                      <div className="tag-cloud">
                        {problem.companies.map((company) => (
                          <span key={`${problem.id}-${company}`}>{company}</span>
                        ))}
                        {problem.tags.slice(0, 3).map((tag) => (
                          <span key={`${problem.id}-${tag}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <Link className="primary-button" href={`/coding-room/${problem.id}`}>
                      Solve
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
        </>
      )}
    </section>
  );
}
