import { useMemo, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useUserJobs, updateJobRecord, deleteJobRecord, clearJobInterviewLink } from "../../lib/jobs";
import { createReminder, removeReminder } from "../../lib/reminders";
import {
  normalizeEditableStatus,
  remotePolicyLabel,
  sourceLabel,
  statusTransitions,
  type CareerJob,
  type JobStatus
} from "../../types/job";
import {
  Card,
  EmptyState,
  ErrorText,
  GhostButton,
  LoadingView,
  Pill,
  PrimaryButton,
  Screen,
  SectionHeader,
  SuccessText,
  TextField
} from "../../components/ui/Primitives";
import { PickerField } from "../../components/ui/PickerField";
import { DateTimeField } from "../../components/ui/DateTimeField";

const STATUS_LABEL: Record<JobStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  archived: "Archived"
};

function statusTone(status: JobStatus): "brand" | "success" | "warning" | "danger" | "muted" {
  if (status === "interviewing") return "brand";
  if (status === "offer") return "success";
  if (status === "rejected" || status === "archived") return "danger";
  if (status === "applied") return "warning";
  return "muted";
}

export default function ApplicationsScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { jobs, loading } = useUserJobs(user?.uid);

  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [interviewJob, setInterviewJob] = useState<CareerJob | null>(null);
  const [interviewDateTime, setInterviewDateTime] = useState<Date | null>(null);
  const [interviewNotes, setInterviewNotes] = useState("");
  const [savingInterview, setSavingInterview] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<CareerJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sources = useMemo(() => {
    const set = new Set<string>(jobs.map((j) => sourceLabel(j.source)));
    return ["All", ...Array.from(set)];
  }, [jobs]);

  const filteredJobs = useMemo(
    () => (sourceFilter === "All" ? jobs : jobs.filter((j) => sourceLabel(j.source) === sourceFilter)),
    [jobs, sourceFilter]
  );

  async function handleChangeStatus(job: CareerJob, nextStatus: JobStatus) {
    setStatusError(null);
    setNotice(null);
    if (!user) return;

    if (nextStatus === "interviewing") {
      setInterviewJob(job);
      setInterviewDateTime(null);
      setInterviewNotes("");
      return;
    }

    const updates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "applied" && !job.appliedAt) {
      updates.appliedAt = new Date().toISOString();
    }

    try {
      if (job.status === "interviewing" && job.interviewReminderId) {
        await removeReminder(user.uid, job.interviewReminderId);
        await clearJobInterviewLink(user.uid, job.id);
      }
      await updateJobRecord(user.uid, job.id, updates);
      setNotice(`${job.role} moved to ${STATUS_LABEL[nextStatus]}.`);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not update stage.");
    }
  }

  async function handleSaveInterview() {
    if (!user || !interviewJob || !interviewDateTime) return;
    setSavingInterview(true);
    try {
      if (interviewJob.interviewReminderId) {
        await removeReminder(user.uid, interviewJob.interviewReminderId);
      }
      const startsAtIso = interviewDateTime.toISOString();
      const reminderId = await createReminder(user.uid, {
        title: `Interview: ${interviewJob.role} at ${interviewJob.company}`,
        startsAt: startsAtIso,
        type: "interview",
        notes: interviewNotes
      });
      await updateJobRecord(user.uid, interviewJob.id, {
        status: "interviewing",
        nextActionAt: startsAtIso,
        interviewReminderId: reminderId
      });
      setNotice(`Interview scheduled for ${interviewJob.company}. Added to your calendar.`);
      setInterviewJob(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not schedule interview.");
    } finally {
      setSavingInterview(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user || !deleteCandidate) return;
    setDeleting(true);
    try {
      if (deleteCandidate.interviewReminderId) {
        try {
          await removeReminder(user.uid, deleteCandidate.interviewReminderId);
        } catch {
          // best-effort, same as web
        }
      }
      await deleteJobRecord(user.uid, deleteCandidate.id);
      setNotice(`${deleteCandidate.role} at ${deleteCandidate.company} was deleted.`);
      setDeleteCandidate(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not delete application.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading your applications..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Pipeline" title="Applications" subtitle="Tap Change Stage instead of dragging - pick the next valid stage." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {sources.map((source) => (
          <Pressable
            key={source}
            onPress={() => setSourceFilter(source)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: sourceFilter === source ? colors.brand : colors.surfaceMuted
            }}
          >
            <Text style={{ color: sourceFilter === source ? "#fff" : colors.muted, fontWeight: "700", fontSize: fontSize.sm }}>
              {source}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {statusError ? <ErrorText text={statusError} /> : null}
      {notice ? <SuccessText text={notice} /> : null}

      {filteredJobs.length === 0 ? (
        <EmptyState text="No jobs yet. Use the Chrome extension on a job page and this board updates instantly." />
      ) : (
        filteredJobs.map((job) => {
          const isExpanded = expandedId === job.id;
          const currentStatus = normalizeEditableStatus(job.status);
          // Same rule the web app's stage <select> uses (apps/web/src/app/applications/page.tsx's
          // renderStatusSelect): show exactly the transitions this stage's row in `statusTransitions` allows,
          // which already includes staying put.
          const allowedNext = statusTransitions[job.status];

          return (
            <Card key={job.id}>
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : job.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>{job.company.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }} numberOfLines={1}>
                    {job.role}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: fontSize.sm }} numberOfLines={1}>
                    {job.company} / {job.location}
                  </Text>
                </View>
                <Pill label={STATUS_LABEL[job.status]} tone={statusTone(job.status)} />
                {isExpanded ? <ChevronUp color={colors.muted} size={18} /> : <ChevronDown color={colors.muted} size={18} />}
              </Pressable>

              {isExpanded ? (
                <View style={{ gap: 10, marginTop: 4 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pill label={`${job.fitScore}% match`} tone={job.fitScore >= 85 ? "success" : "brand"} />
                    <Pill label={sourceLabel(job.source)} tone="muted" />
                    <Pill label={remotePolicyLabel(job.remotePolicy)} tone="muted" />
                  </View>

                  <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, lineHeight: 19 }}>
                    {job.jdText || job.aboutText || job.responsibilitiesText || job.eligibilityText || "No detailed description captured yet."}
                  </Text>

                  <PickerField
                    label="Change stage"
                    value={currentStatus}
                    options={allowedNext.map((status) => ({ value: status, label: STATUS_LABEL[status] }))}
                    onChange={(nextStatus) => void handleChangeStatus(job, nextStatus)}
                  />

                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {job.sourceUrl ? (
                      <GhostButton
                        label="Open Source"
                        icon={<ExternalLink color={colors.text} size={14} />}
                        onPress={() => void Linking.openURL(job.sourceUrl!)}
                      />
                    ) : null}
                    <GhostButton
                      label="Delete"
                      tone="danger"
                      icon={<Trash2 color={colors.danger} size={14} />}
                      onPress={() => setDeleteCandidate(job)}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      <Modal visible={Boolean(interviewJob)} transparent animationType="fade" onRequestClose={() => setInterviewJob(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
          <Card>
            <SectionHeader eyebrow="Interview Details" title="Schedule interview" subtitle={`${interviewJob?.role} / ${interviewJob?.company}`} />
            <DateTimeField label="Interview date and time" value={interviewDateTime} onChange={setInterviewDateTime} />
            <TextField
              label="Notes (optional)"
              value={interviewNotes}
              onChangeText={setInterviewNotes}
              placeholder="Round type, interviewer, prep notes..."
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <GhostButton label="Cancel" onPress={() => setInterviewJob(null)} />
              <PrimaryButton
                label={savingInterview ? "Saving..." : "Save interview"}
                onPress={() => void handleSaveInterview()}
                disabled={!interviewDateTime}
                loading={savingInterview}
              />
            </View>
          </Card>
        </View>
      </Modal>

      <Modal visible={Boolean(deleteCandidate)} transparent animationType="fade" onRequestClose={() => setDeleteCandidate(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
          <Card>
            <SectionHeader eyebrow="Delete Application" title="Remove this application?" subtitle={`${deleteCandidate?.role} / ${deleteCandidate?.company}`} />
            <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
              This removes the application from your pipeline and cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <GhostButton label="Cancel" onPress={() => setDeleteCandidate(null)} />
              <PrimaryButton
                label={deleting ? "Deleting..." : "Delete Application"}
                onPress={() => void handleConfirmDelete()}
                loading={deleting}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
