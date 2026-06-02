"use client";

import type { JobStatus } from "@careeros/shared";
import { ChevronDown, ChevronUp, ExternalLink, Filter, GripVertical, LayoutGrid, MapPin, Rows3, Tag, Trash2 } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { createReminder, removeReminder } from "@/lib/firebase/reminders";
import { deleteJobRecord, updateJobRecord, useUserJobs, type CareerJob } from "@/lib/firebase/jobs";

type ViewMode = "kanban" | "table";
type EditableStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";
type BoardColumnId = "saved" | "applied" | "interviewing" | "offer" | "closed";

const boardColumns: Array<{ id: BoardColumnId; status: CareerJob["status"][]; title: string; dot: string }> = [
  { id: "saved", title: "Saved", dot: "", status: ["saved"] },
  { id: "applied", title: "Applied", dot: "", status: ["applied"] },
  { id: "interviewing", title: "Interviewing", dot: "brand", status: ["interviewing"] },
  { id: "offer", title: "Offer", dot: "success", status: ["offer"] },
  { id: "closed", title: "Closed", dot: "warning", status: ["rejected", "archived"] }
];

const statusOptions: Array<{ label: string; value: EditableStatus }> = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" }
];

const dropStatusByColumn: Record<BoardColumnId, EditableStatus> = {
  saved: "saved",
  applied: "applied",
  interviewing: "interviewing",
  offer: "offer",
  closed: "rejected"
};

const statusTransitions: Record<EditableStatus, EditableStatus[]> = {
  saved: ["saved", "applied"],
  applied: ["saved", "applied", "interviewing", "rejected"],
  interviewing: ["applied", "interviewing", "offer", "rejected"],
  offer: ["interviewing", "offer"],
  rejected: ["rejected"]
};

function statusLabel(status: EditableStatus): string {
  const selected = statusOptions.find((option) => option.value === status);
  return selected?.label ?? status;
}

function normalizeEditableStatus(status: CareerJob["status"]): EditableStatus {
  if (status === "archived") {
    return "rejected";
  }

  return status;
}

function canTransitionToStatus(from: EditableStatus, to: EditableStatus): boolean {
  return statusTransitions[from].includes(to);
}

function allowedStatusesFor(status: EditableStatus): EditableStatus[] {
  return statusTransitions[status];
}

function toDatetimeLocalInputValue(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  const date = new Date(parsed);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function sourceLabel(source: string): string {
  if (source === "chrome-extension") {
    return "Chrome";
  }

  if (source === "gmail") {
    return "Gmail";
  }

  if (source === "linkedin") {
    return "LinkedIn";
  }

  if (source === "indeed") {
    return "Indeed";
  }

  return source;
}

function remotePolicyLabel(value: CareerJob["remotePolicy"]): string {
  if (value === "remote") {
    return "Remote";
  }

  if (value === "hybrid") {
    return "Hybrid";
  }

  if (value === "onsite") {
    return "On-site";
  }

  return "Not specified";
}

function friendlyDateTimeLabel(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toLocaleString();
}

export default function ApplicationsPage() {
  const { error, jobs, loading, user } = useUserJobs();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [activeSourceFilter, setActiveSourceFilter] = useState("All");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [interviewJob, setInterviewJob] = useState<CareerJob | null>(null);
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});
  const [isInterviewSubmitting, setIsInterviewSubmitting] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<CareerJob | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<BoardColumnId | null>(null);

  const availableSources = useMemo(() => {
    const sourceValues = Array.from(new Set(jobs.map((job) => sourceLabel(job.source))));
    return ["All", ...sourceValues];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (activeSourceFilter === "All") {
      return jobs;
    }

    return jobs.filter((job) => sourceLabel(job.source) === activeSourceFilter);
  }, [activeSourceFilter, jobs]);

  const columns = useMemo(
    () =>
      boardColumns.map((column) => ({
        ...column,
        jobs: filteredJobs.filter((job) => column.status.includes(job.status))
      })),
    [filteredJobs]
  );
  const jobsById = useMemo(() => new Map(filteredJobs.map((job) => [job.id, job])), [filteredJobs]);

  const showEmptyState = !loading && filteredJobs.length === 0;
  const isMutationBusy = Boolean(updatingJobId) || isInterviewSubmitting || isDeleteSubmitting;

  const resetFeedback = () => {
    setActionError(null);
    setActionNotice(null);
  };

  const closeInterviewModal = () => {
    setInterviewJob(null);
    setInterviewAt("");
    setInterviewNotes("");
  };

  const closeDeleteModal = () => {
    if (isDeleteSubmitting) {
      return;
    }

    setDeleteCandidate(null);
  };

  const isJobExpanded = (jobId: string) => Boolean(expandedJobIds[jobId]);

  const toggleJobExpanded = (jobId: string) => {
    setExpandedJobIds((current) => ({
      ...current,
      [jobId]: !current[jobId]
    }));
  };

  const stageTransitionError = (currentStatus: EditableStatus, targetStatus: EditableStatus) => {
    const allowed = allowedStatusesFor(currentStatus)
      .filter((status) => status !== currentStatus)
      .map((status) => statusLabel(status))
      .join(" or ");

    setActionError(
      `Stage change ${statusLabel(currentStatus)} → ${statusLabel(targetStatus)} is not allowed. ${
        allowed ? `Move to ${allowed} first.` : "No forward transition is available from this stage."
      }`
    );
  };

  const updateStatus = async (job: CareerJob, nextStatus: EditableStatus) => {
    if (!user) {
      setActionError("Please sign in to update application status.");
      return;
    }

    const currentStatus = normalizeEditableStatus(job.status);
    if (currentStatus === nextStatus) {
      return;
    }

    if (!canTransitionToStatus(currentStatus, nextStatus)) {
      stageTransitionError(currentStatus, nextStatus);
      return;
    }

    setUpdatingJobId(job.id);
    resetFeedback();

    const shouldClearInterviewData = nextStatus !== "interviewing" && (job.status === "interviewing" || Boolean(job.interviewReminderId));
    try {
      if (shouldClearInterviewData && job.interviewReminderId) {
        await removeReminder(user.uid, job.interviewReminderId);
      }

      const payload: {
        appliedAt?: string;
        interviewReminderId?: string | null;
        nextActionAt?: string | null;
        status: JobStatus;
      } = {
        status: nextStatus
      };

      if (nextStatus === "applied" && !job.appliedAt) {
        payload.appliedAt = new Date().toISOString();
      }

      if (shouldClearInterviewData) {
        payload.interviewReminderId = null;
        payload.nextActionAt = null;
      }

      await updateJobRecord(user.uid, job.id, payload);
      setActionNotice(`${job.company} updated to ${statusLabel(nextStatus)}.`);
    } catch (statusError) {
      setActionError(statusError instanceof Error ? statusError.message : "Unable to update status.");
    } finally {
      setUpdatingJobId(null);
    }
  };

  const openDeleteModal = (job: CareerJob) => {
    resetFeedback();
    setDeleteCandidate(job);
  };

  const confirmDeleteJob = async () => {
    const job = deleteCandidate;
    if (!job) {
      return;
    }

    if (!user) {
      setActionError("Please sign in to delete applications.");
      return;
    }

    setUpdatingJobId(job.id);
    setIsDeleteSubmitting(true);
    resetFeedback();

    try {
      if (job.interviewReminderId) {
        try {
          await removeReminder(user.uid, job.interviewReminderId);
        } catch {
          // Ignore stale reminder cleanup failures so users can still delete the application.
        }
      }

      await deleteJobRecord(user.uid, job.id);
      setActionNotice(`${job.role} at ${job.company} was deleted.`);
      setDeleteCandidate(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete application.");
    } finally {
      setUpdatingJobId(null);
      setIsDeleteSubmitting(false);
    }
  };

  const handleStatusChange = async (job: CareerJob, event: ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value as EditableStatus;
    const currentStatus = normalizeEditableStatus(job.status);

    if (!user) {
      setActionError("Please sign in to update application status.");
      return;
    }

    if (!canTransitionToStatus(currentStatus, nextStatus)) {
      stageTransitionError(currentStatus, nextStatus);
      return;
    }

    if (nextStatus === "interviewing") {
      resetFeedback();
      setInterviewJob(job);
      setInterviewAt(toDatetimeLocalInputValue(job.nextActionAt));
      setInterviewNotes("");
      return;
    }

    await updateStatus(job, nextStatus);
  };

  const canDropOnColumn = (columnId: BoardColumnId) => {
    if (!draggingJobId) {
      return false;
    }

    const draggedJob = jobsById.get(draggingJobId);
    if (!draggedJob) {
      return false;
    }

    const currentStatus = normalizeEditableStatus(draggedJob.status);
    const targetStatus = dropStatusByColumn[columnId];

    return canTransitionToStatus(currentStatus, targetStatus);
  };

  const handleCardDragStart = (event: DragEvent<HTMLElement>, job: CareerJob) => {
    if (isMutationBusy) {
      event.preventDefault();
      return;
    }

    setDraggingJobId(job.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", job.id);
  };

  const handleCardDragEnd = () => {
    setDraggingJobId(null);
    setDragOverColumnId(null);
  };

  const handleColumnDragOver = (event: DragEvent<HTMLDivElement>, columnId: BoardColumnId) => {
    if (!canDropOnColumn(columnId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleColumnDragLeave = (columnId: BoardColumnId) => {
    if (dragOverColumnId === columnId) {
      setDragOverColumnId(null);
    }
  };

  const handleColumnDrop = async (event: DragEvent<HTMLDivElement>, columnId: BoardColumnId) => {
    event.preventDefault();

    const droppedJobId = event.dataTransfer.getData("text/plain") || draggingJobId;
    setDragOverColumnId(null);
    setDraggingJobId(null);

    if (!droppedJobId) {
      return;
    }

    const droppedJob = jobsById.get(droppedJobId);
    if (!droppedJob) {
      return;
    }

    const currentStatus = normalizeEditableStatus(droppedJob.status);
    const targetStatus = dropStatusByColumn[columnId];

    if (!canTransitionToStatus(currentStatus, targetStatus)) {
      stageTransitionError(currentStatus, targetStatus);
      return;
    }

    if (targetStatus === "interviewing") {
      resetFeedback();
      setInterviewJob(droppedJob);
      setInterviewAt(toDatetimeLocalInputValue(droppedJob.nextActionAt));
      setInterviewNotes("");
      return;
    }

    await updateStatus(droppedJob, targetStatus);
  };

  const handleInterviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !interviewJob) {
      setActionError("Please sign in to schedule interview reminders.");
      return;
    }

    if (!interviewAt) {
      setActionError("Please choose interview date and time.");
      return;
    }

    const startsAtIso = new Date(interviewAt).toISOString();
    if (!Number.isFinite(Date.parse(startsAtIso))) {
      setActionError("Please provide a valid interview date and time.");
      return;
    }

    setIsInterviewSubmitting(true);
    resetFeedback();

    try {
      if (interviewJob.interviewReminderId) {
        await removeReminder(user.uid, interviewJob.interviewReminderId);
      }

      const reminderId = await createReminder(user.uid, {
        title: `Interview: ${interviewJob.role} at ${interviewJob.company}`,
        startsAt: startsAtIso,
        type: "interview",
        notes: interviewNotes.trim()
      });

      await updateJobRecord(user.uid, interviewJob.id, {
        status: "interviewing",
        nextActionAt: startsAtIso,
        interviewReminderId: reminderId
      });

      setActionNotice(`Interview scheduled for ${interviewJob.company}. Added to your calendar.`);
      closeInterviewModal();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Unable to schedule interview.");
    } finally {
      setIsInterviewSubmitting(false);
    }
  };

  const renderStatusSelect = (job: CareerJob, compact = false) => (
    <label className={compact ? "application-status-field compact" : "application-status-field"}>
      <span>Stage</span>
      <select
        className="application-status-select"
        disabled={isMutationBusy || updatingJobId === job.id}
        onChange={(event) => {
          void handleStatusChange(job, event);
        }}
        value={normalizeEditableStatus(job.status)}
      >
        {statusOptions
          .filter((option) => canTransitionToStatus(normalizeEditableStatus(job.status), option.value))
          .map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
          ))}
      </select>
    </label>
  );

  return (
    <div className="page-stack">
      {error ? <p className="settings-feedback error">{error}</p> : null}
      {actionError ? <p className="settings-feedback error">{actionError}</p> : null}
      {actionNotice ? <p className="settings-feedback success">{actionNotice}</p> : null}

      <section className="kanban-toolbar">
        <div className="segmented-control" aria-label="Application view">
          <button
            className={viewMode === "kanban" ? "segmented-button active" : "segmented-button"}
            onClick={() => setViewMode("kanban")}
            type="button"
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            className={viewMode === "table" ? "segmented-button active" : "segmented-button"}
            onClick={() => setViewMode("table")}
            type="button"
          >
            <Rows3 size={14} />
            Table
          </button>
        </div>

        <div className="filter-group" aria-label="Source filters">
          {availableSources.map((filter) => (
            <button
              className={activeSourceFilter === filter ? "segmented-button active" : "segmented-button"}
              key={filter}
              onClick={() => setActiveSourceFilter(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
          <button className="icon-button" aria-label="Filter applications" type="button">
            <Filter size={16} />
          </button>
        </div>
      </section>

      {showEmptyState ? (
        <section className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Applications</p>
              <h2>No jobs yet</h2>
              <p>Use the Chrome extension on a job page and this board updates instantly.</p>
            </div>
          </div>
          <div className="empty-drop">Nothing to show right now. Save your first role to start tracking progress.</div>
        </section>
      ) : null}

      {!showEmptyState && viewMode === "kanban" ? (
        <section className="page-stack">
          <p className="applications-drag-hint">
            Drag cards to move stage-by-stage. Saved jobs can move to Applied first, then Interviewing, Offer, or Rejected.
          </p>
          <section className="kanban-board" aria-label="Application pipeline">
          {columns.map((column) => (
            <div
              className={`kanban-column${canDropOnColumn(column.id) ? " drop-target" : ""}${dragOverColumnId === column.id ? " drag-over" : ""}`}
              key={column.id}
              onDragLeave={() => handleColumnDragLeave(column.id)}
              onDragOver={(event) => handleColumnDragOver(event, column.id)}
              onDrop={(event) => {
                void handleColumnDrop(event, column.id);
              }}
            >
              <div className="column-title">
                <span>
                  <i className={`column-dot ${column.dot}`} />
                  {column.title}
                </span>
                <strong>{column.jobs.length}</strong>
              </div>

              {column.jobs.length > 0 ? (
                column.jobs.map((job) => (
                  <article
                    className={draggingJobId === job.id ? "kanban-card dragging" : "kanban-card"}
                    draggable={!isMutationBusy}
                    key={job.id}
                    onDragEnd={handleCardDragEnd}
                    onDragStart={(event) => handleCardDragStart(event, job)}
                  >
                    <div className="row-between">
                      <CompanyAvatar
                        company={job.company}
                        logoUrl={job.companyLogoUrl}
                        toneClassName={job.fitScore >= 85 ? "brand" : job.fitScore >= 70 ? "success" : "warning"}
                      />
                      <span className="card-id">
                        <GripVertical size={12} />
                        #{job.id.slice(-5).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3>{job.role}</h3>
                      <p>
                        {job.company} / {job.location}
                      </p>
                      <p>{job.salaryText || job.remotePolicy}</p>
                    </div>
                    <div className="row-between">
                      <span className="pill">
                        <Tag size={11} />
                        {sourceLabel(job.source)}
                      </span>
                      <span className={job.fitScore >= 85 ? "pill success" : "pill brand"}>{job.fitScore}% match</span>
                    </div>
                    <div className="application-card-actions">
                      {job.sourceUrl ? (
                        <a className="ghost-button" href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
                          <ExternalLink size={13} />
                          Source
                        </a>
                      ) : (
                        <span />
                      )}
                      <button
                        className="ghost-button danger-button"
                        disabled={isMutationBusy || updatingJobId === job.id}
                        onClick={() => {
                          openDeleteModal(job);
                        }}
                        type="button"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-drop">No jobs in this stage.</div>
              )}
            </div>
          ))}
          </section>
        </section>
      ) : null}

      {!showEmptyState && viewMode === "table" ? (
        <section className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Applications List</p>
              <h2>Expandable job cards</h2>
              <p>Compact summary by default. Expand a card to review full context and manage status.</p>
            </div>
          </div>

          <div className="applications-list-view">
            {filteredJobs.map((job) => {
              const expanded = isJobExpanded(job.id);
              const richDescription =
                job.jdText || job.aboutText || job.responsibilitiesText || job.eligibilityText || "No detailed description captured yet.";
              const locationPreview = job.locationOptions?.length ? job.locationOptions.join(" / ") : job.location;

              return (
                <article className={expanded ? "application-expand-card expanded" : "application-expand-card"} key={job.id}>
                  <div className="application-expand-summary">
                    <div className="application-expand-title">
                      <CompanyAvatar
                        company={job.company}
                        logoUrl={job.companyLogoUrl}
                        toneClassName={job.fitScore >= 85 ? "brand" : job.fitScore >= 70 ? "success" : "warning"}
                      />
                      <div>
                        <h3>{job.role}</h3>
                        <p>{job.company}</p>
                        <p>
                          <MapPin size={12} /> {locationPreview}
                        </p>
                      </div>
                    </div>
                    <div className="application-expand-meta">
                      <StatusBadge status={job.status} />
                      <span className={job.fitScore >= 85 ? "pill success" : "pill brand"}>{job.fitScore}% match</span>
                      <button
                        className="ghost-button"
                        onClick={() => toggleJobExpanded(job.id)}
                        type="button"
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="application-expand-body">
                      <div className="application-expand-grid">
                        <div className="application-expand-field">
                          <strong>Source</strong>
                          <span>{sourceLabel(job.source)}</span>
                        </div>
                        <div className="application-expand-field">
                          <strong>Workplace</strong>
                          <span>{job.workplaceTypeText || remotePolicyLabel(job.remotePolicy)}</span>
                        </div>
                        <div className="application-expand-field">
                          <strong>Job Type</strong>
                          <span>{job.jobTypeText || job.employmentType || "Not specified"}</span>
                        </div>
                        <div className="application-expand-field">
                          <strong>Experience</strong>
                          <span>{job.experienceText || "Not specified"}</span>
                        </div>
                        <div className="application-expand-field">
                          <strong>Compensation</strong>
                          <span>{job.salaryText || "Not disclosed"}</span>
                        </div>
                        <div className="application-expand-field">
                          <strong>Posted</strong>
                          <span>{job.postedAtText || "Not captured"}</span>
                        </div>
                        {job.savedAt ? (
                          <div className="application-expand-field">
                            <strong>Saved</strong>
                            <span>{friendlyDateTimeLabel(job.savedAt) || job.savedAt}</span>
                          </div>
                        ) : null}
                        {job.appliedAt ? (
                          <div className="application-expand-field">
                            <strong>Applied</strong>
                            <span>{friendlyDateTimeLabel(job.appliedAt) || job.appliedAt}</span>
                          </div>
                        ) : null}
                        {job.nextActionAt ? (
                          <div className="application-expand-field">
                            <strong>Next Action</strong>
                            <span>{friendlyDateTimeLabel(job.nextActionAt) || job.nextActionAt}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="application-expand-description">
                        <h4>Job Description</h4>
                        <p>{richDescription}</p>
                      </div>

                      <div className="application-expand-actions">
                        <div className="application-status-cell">
                          <StatusBadge status={job.status} />
                          {renderStatusSelect(job, true)}
                        </div>
                        <div className="application-expand-actions-row">
                          {job.sourceUrl ? (
                            <a className="ghost-button" href={job.sourceUrl} rel="noopener noreferrer" target="_blank">
                              <ExternalLink size={13} />
                              Open Source Page
                            </a>
                          ) : null}
                          <button
                            className="ghost-button danger-button"
                            disabled={isMutationBusy || updatingJobId === job.id}
                            onClick={() => {
                              openDeleteModal(job);
                            }}
                            type="button"
                          >
                            <Trash2 size={13} />
                            Delete Application
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {interviewJob ? (
        <div className="profile-modal-overlay" onClick={closeInterviewModal} role="presentation">
          <section
            aria-labelledby="interview-modal-title"
            aria-modal="true"
            className="profile-modal application-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="card-header">
              <div>
                <p className="eyebrow">Interview Details</p>
                <h2 id="interview-modal-title">Schedule interview</h2>
                <p>
                  {interviewJob.role} / {interviewJob.company}
                </p>
              </div>
            </div>

            <form
              className="calendar-form"
              onSubmit={(event) => {
                void handleInterviewSubmit(event);
              }}
            >
              <label className="profile-field">
                Interview date and time
                <input
                  onChange={(event) => setInterviewAt(event.target.value)}
                  required
                  type="datetime-local"
                  value={interviewAt}
                />
              </label>

              <label className="profile-field">
                Notes (optional)
                <textarea
                  onChange={(event) => setInterviewNotes(event.target.value)}
                  placeholder="Round type, interviewer, prep notes..."
                  value={interviewNotes}
                />
              </label>

              <div className="modal-actions">
                <button className="ghost-button" onClick={closeInterviewModal} type="button">
                  Cancel
                </button>
                <button className="primary-button" disabled={isInterviewSubmitting} type="submit">
                  {isInterviewSubmitting ? "Saving..." : "Save interview"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deleteCandidate ? (
        <div className="profile-modal-overlay" onClick={closeDeleteModal} role="presentation">
          <section
            aria-labelledby="delete-application-modal-title"
            aria-modal="true"
            className="profile-modal application-modal application-delete-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="card-header">
              <div>
                <p className="eyebrow">Delete Application</p>
                <h2 id="delete-application-modal-title">Remove this application?</h2>
                <p>
                  {deleteCandidate.role} / {deleteCandidate.company}
                </p>
              </div>
            </div>

            <p className="application-delete-copy">This removes the application from your pipeline and cannot be undone.</p>

            <div className="application-delete-warning">
              <strong>Role</strong>
              <span>{deleteCandidate.role}</span>
              <strong>Company</strong>
              <span>{deleteCandidate.company}</span>
            </div>

            <div className="modal-actions">
              <button className="ghost-button" disabled={isDeleteSubmitting} onClick={closeDeleteModal} type="button">
                Cancel
              </button>
              <button
                className="primary-button danger-solid-button"
                disabled={isDeleteSubmitting}
                onClick={() => {
                  void confirmDeleteJob();
                }}
                type="button"
              >
                {isDeleteSubmitting ? "Deleting..." : "Delete Application"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
