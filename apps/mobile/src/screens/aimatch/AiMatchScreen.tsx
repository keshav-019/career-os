import { useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Pressable, Text, View } from "react-native";
import { Check, Copy, Sparkles, Target, Upload } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useUserJobs } from "../../lib/jobs";
import { useUserResumes } from "../../lib/resumes";
import { pickAndUploadResume, ResumeUploadCancelledError } from "../../lib/resumeUpload";
import { apiPost } from "../../lib/apiClient";
import type { JobMatch, ResumeReview } from "../../types/aiMatch";
import {
  Card,
  Divider,
  EmptyState,
  ErrorText,
  GhostButton,
  LoadingView,
  Pill,
  PrimaryButton,
  Screen,
  SectionHeader,
  TextField
} from "../../components/ui/Primitives";
import { PickerField } from "../../components/ui/PickerField";

function BulletList({ items, empty = "No items returned." }: { items: string[]; empty?: string }) {
  const { colors, fontSize } = useTheme();
  if (items.length === 0) {
    return <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{empty}</Text>;
  }
  return (
    <View style={{ gap: 4 }}>
      {items.map((item, index) => (
        <Text key={index} style={{ color: colors.mutedStrong, fontSize: fontSize.sm, lineHeight: 18 }}>
          - {item}
        </Text>
      ))}
    </View>
  );
}

export default function AiMatchScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { jobs } = useUserJobs(user?.uid);
  const { resumes } = useUserResumes(user?.uid);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [keywords, setKeywords] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);

  const [busy, setBusy] = useState<"match" | "review" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<JobMatch | null>(null);
  const [reviewResult, setReviewResult] = useState<ResumeReview | null>(null);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  async function handleUploadResume() {
    if (!user) return;
    setError(null);
    setUploadingResume(true);
    try {
      await pickAndUploadResume(user.uid);
    } catch (err) {
      if (!(err instanceof ResumeUploadCancelledError)) {
        setError(err instanceof Error ? err.message : "Could not upload this resume.");
      }
    } finally {
      setUploadingResume(false);
    }
  }

  const jobOptions = useMemo(() => jobs.map((j) => ({ value: j.id, label: `${j.company} / ${j.role}` })), [jobs]);

  function handleSelectJob(jobId: string) {
    setSelectedJobId(jobId);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setRole(job.role ?? "");
    setCompany(job.company ?? "");
    setLocation(job.location ?? "");
    setKeywords((job.tags ?? []).join(", "));
    setJobDescription(job.jdText || job.responsibilitiesText || job.eligibilityText || job.aboutText || "");
  }

  function toggleResume(id: string) {
    setSelectedResumeIds((current) => (current.includes(id) ? current.filter((r) => r !== id) : [...current, id]));
  }

  function buildJobPayload() {
    return {
      role,
      company,
      location,
      tags: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      jdText: jobDescription
    };
  }

  async function handleAnalyzeMatch() {
    setError(null);
    setMatchResult(null);
    const selected = resumes.filter((r) => selectedResumeIds.includes(r.id));
    if (selected.length === 0) {
      setError("Select at least one resume to match.");
      return;
    }
    if (!jobDescription.trim() && !role.trim()) {
      setError("Paste a job description or enter a role first.");
      return;
    }
    setBusy("match");
    try {
      const result = await apiPost<{ match: JobMatch }>("/api/ai/job-match", { job: buildJobPayload(), resumes: selected });
      setMatchResult(result.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this match.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReviewResume() {
    setError(null);
    setReviewResult(null);
    const primary = resumes.find((r) => r.id === selectedResumeIds[0]);
    if (!primary) {
      setError("Select a resume to review.");
      return;
    }
    setBusy("review");
    try {
      const result = await apiPost<{ review: ResumeReview }>("/api/ai/resume-review", { resume: primary });
      setReviewResult(result.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this resume.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Career AI" title="Resume intelligence and job matching" subtitle="Match a saved resume against a job, or paste one manually." />

      <Card>
        <SectionHeader eyebrow="Job Entry" title="Paste or load a role" />
        <PickerField
          label="Saved jobs"
          value={selectedJobId}
          options={jobOptions}
          onChange={handleSelectJob}
          placeholder={jobOptions.length === 0 ? "No saved jobs yet" : "Manual job entry"}
        />
        <TextField label="Role" value={role} onChangeText={setRole} placeholder="Frontend Engineer" />
        <TextField label="Company" value={company} onChangeText={setCompany} placeholder="Acme" />
        <TextField label="Location" value={location} onChangeText={setLocation} placeholder="Remote, Bengaluru, New York..." />
        <TextField label="Keywords" value={keywords} onChangeText={setKeywords} placeholder="React, TypeScript, AI tools" />
        <TextField
          label="Job description"
          value={jobDescription}
          onChangeText={setJobDescription}
          placeholder="Paste the job description here..."
          multiline
          numberOfLines={5}
        />
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Resume List"
          title="Select candidates"
          right={
            <View style={{ flexDirection: "row", gap: 6 }}>
              <GhostButton label="All" onPress={() => setSelectedResumeIds(resumes.map((r) => r.id))} />
              <GhostButton label="Clear" onPress={() => setSelectedResumeIds([])} />
            </View>
          }
        />
        <GhostButton
          label={uploadingResume ? "Uploading..." : "Upload a resume"}
          icon={<Upload color={colors.text} size={14} />}
          onPress={() => void handleUploadResume()}
          disabled={uploadingResume}
        />
        {resumes.length === 0 ? (
          <EmptyState text="No resumes yet. Upload one above, or add one in CareerOS Desktop / Resume Studio." />
        ) : (
          resumes.map((resume) => {
            const isSelected = selectedResumeIds.includes(resume.id);
            return (
              <Pressable
                key={resume.id}
                onPress={() => toggleResume(resume.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.brand : colors.border,
                  backgroundColor: isSelected ? `${colors.brand}18` : "transparent"
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.brand : colors.border,
                    backgroundColor: isSelected ? colors.brand : "transparent",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {isSelected ? <Check color="#fff" size={13} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{resume.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{resume.targetRoles.join(" / ") || "No target roles"}</Text>
                </View>
                <Pill label={`${resume.keywordCoverage}%`} tone="brand" />
              </Pressable>
            );
          })
        )}

        {error ? <ErrorText text={error} /> : null}

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <GhostButton label="Review Resume" icon={<Target color={colors.text} size={14} />} onPress={() => void handleReviewResume()} disabled={busy !== null} />
          <PrimaryButton
            label="Analyze Match"
            icon={<Sparkles color="#fff" size={14} />}
            onPress={() => void handleAnalyzeMatch()}
            disabled={busy !== null}
            loading={busy === "match"}
          />
        </View>
      </Card>

      {busy === "review" ? <LoadingView label="CareerOS is reading the resume and preparing feedback..." /> : null}
      {busy === "match" ? <LoadingView label="CareerOS is comparing resumes against the job and preparing a cover letter..." /> : null}

      {matchResult ? (
        <Card highlight>
          <SectionHeader eyebrow={matchResult.bestResumeLabel} title={`${matchResult.scoreOutOf10.toFixed(1)} / 10`} subtitle={matchResult.verdict} />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Matched Evidence</Text>
          <BulletList items={matchResult.matchedEvidence} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Gaps</Text>
          <BulletList items={matchResult.gaps} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Resume Tweaks</Text>
          <BulletList items={matchResult.resumeTweaks} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Application Strategy</Text>
          <BulletList items={matchResult.applicationStrategy} />
          <Divider />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Cover Letter</Text>
            <GhostButton
              label={copiedCoverLetter ? "Copied" : "Copy"}
              icon={<Copy color={colors.text} size={13} />}
              onPress={() => {
                void Clipboard.setStringAsync(matchResult.coverLetter);
                setCopiedCoverLetter(true);
                setTimeout(() => setCopiedCoverLetter(false), 1500);
              }}
            />
          </View>
          <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, lineHeight: 19 }}>{matchResult.coverLetter}</Text>
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Outreach</Text>
          <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, lineHeight: 19 }}>{matchResult.outreachMessage}</Text>
          <Text style={{ color: colors.text, fontWeight: "800", marginTop: 6 }}>Job Targets</Text>
          <BulletList items={matchResult.recommendedJobTargets} />
        </Card>
      ) : null}

      {reviewResult ? (
        <Card highlight>
          <SectionHeader eyebrow="Resume Review" title={`${reviewResult.overallScore.toFixed(1)} / 10 market readiness`} subtitle={reviewResult.marketPosition} />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Target Roles</Text>
          <BulletList items={reviewResult.targetRoles} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Strengths</Text>
          <BulletList items={reviewResult.strengths} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Improve</Text>
          <BulletList items={reviewResult.gaps} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>ATS Keywords</Text>
          <BulletList items={reviewResult.atsKeywords} />
          <Divider />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Recruiter Summary</Text>
          <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, lineHeight: 19 }}>{reviewResult.recruiterSummary}</Text>
          <Text style={{ color: colors.text, fontWeight: "800", marginTop: 6 }}>Notes</Text>
          <BulletList items={reviewResult.latexOrVisualNotes} />
        </Card>
      ) : null}
    </Screen>
  );
}
