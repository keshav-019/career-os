import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Download, FilePlus, Pencil, Sparkles, Trash2 } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useMobileResumes, saveMobileResume, deleteMobileResume } from "../../lib/mobileResumes";
import { buildResumeHtml } from "../../lib/resumeHtml";
import { useUserJobs } from "../../lib/jobs";
import { loadProfile } from "../../lib/profile";
import { generateAtsResumeForJob, hasMeaningfulProfileContent } from "../../lib/resumeGeneration";
import {
  createEmptyResumeData,
  DEFAULT_RESUME_TEMPLATE_ID,
  RESUME_VISUAL_TEMPLATES,
  type MobileResumeRecord,
  type ResumeData,
  type ResumeTemplateId
} from "../../types/resume";
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
import { TemplateGallery } from "./TemplateGallery";
import { ResumeForm } from "./ResumeForm";
import { ResumePreview } from "./ResumePreview";

type Mode = "list" | "templates" | "editor";

export default function ResumeScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();
  const { resumes, loading } = useMobileResumes(user?.uid);
  const { jobs } = useUserJobs(user?.uid);

  const [mode, setMode] = useState<Mode>("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [label, setLabel] = useState("Untitled resume");
  const [templateId, setTemplateId] = useState<ResumeTemplateId>(DEFAULT_RESUME_TEMPLATE_ID);
  const [data, setData] = useState<ResumeData>(createEmptyResumeData());
  const [createdAt, setCreatedAt] = useState<string | undefined>(undefined);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const jobOptions = useMemo(
    () => jobs.map((job) => ({ value: job.id, label: `${job.role || "Untitled role"}${job.company ? ` @ ${job.company}` : ""}` })),
    [jobs]
  );

  const activeTemplateMeta = useMemo(() => RESUME_VISUAL_TEMPLATES.find((t) => t.id === templateId), [templateId]);

  function startNew() {
    setActiveId(null);
    setLabel("Untitled resume");
    setTemplateId(DEFAULT_RESUME_TEMPLATE_ID);
    setData(createEmptyResumeData());
    setCreatedAt(undefined);
    setError(null);
    setMode("templates");
  }

  function openExisting(resume: MobileResumeRecord) {
    setActiveId(resume.id);
    setLabel(resume.label);
    setTemplateId(resume.templateId);
    setData(resume.data);
    setCreatedAt(resume.createdAt);
    setError(null);
    setMode("editor");
  }

  function handlePickTemplate(id: ResumeTemplateId) {
    setTemplateId(id);
    setMode("editor");
  }

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const id = activeId ?? `resume-${Date.now()}`;
      await saveMobileResume(user.uid, id, label.trim() || "Untitled resume", templateId, data, createdAt);
      setActiveId(id);
      setMode("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this resume.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(resume: MobileResumeRecord) {
    if (!user) return;
    Alert.alert("Delete resume", `Delete "${resume.label}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteMobileResume(user.uid, resume.id)
      }
    ]);
  }

  async function handleGenerateForJob() {
    const selectedJob = jobs.find((job) => job.id === selectedJobId);
    if (!selectedJob) {
      setGenerateError("Pick a job to tailor the resume for first.");
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateNotice(null);
    try {
      const profile = await loadProfile();
      if (!hasMeaningfulProfileContent(profile)) {
        setGenerateError(
          "We don't have enough detail about you yet to tailor a resume. Update your Profile (experience, projects, education) with some real detail, or fill in the fields below yourself."
        );
        return;
      }

      const generated = await generateAtsResumeForJob(selectedJob, profile);
      setData((current) => ({
        ...generated,
        personal: {
          ...generated.personal,
          github: current.personal.github,
          linkedin: current.personal.linkedin,
          portfolio: current.personal.portfolio
        }
      }));
      setGenerateNotice(`Resume tailored for ${selectedJob.role || "this role"}. Review it below, then export.`);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Unable to generate a tailored resume.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExportPdf() {
    setError(null);
    setExporting(true);
    try {
      const html = buildResumeHtml(data, templateId);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${label || "Resume"}.pdf` });
      } else {
        Alert.alert("Exported", `PDF saved to ${uri}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export a PDF.");
    } finally {
      setExporting(false);
    }
  }

  if (mode === "templates") {
    return (
      <Screen>
        <GhostButton label="Back" onPress={() => setMode("list")} />
        <TemplateGallery onSelect={handlePickTemplate} />
      </Screen>
    );
  }

  if (mode === "editor") {
    return (
      <Screen>
        <SectionHeader
          eyebrow="Visual Mode"
          title="Edit resume"
          subtitle="LaTeX mode is desktop-only - phone editing uses Visual Mode."
          right={<GhostButton label="Resumes" onPress={() => setMode("list")} />}
        />

        <Card>
          <TextField label="Resume label" value={label} onChangeText={setLabel} placeholder="Untitled resume" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pill label={activeTemplateMeta?.name ?? "Template"} tone="brand" />
            <GhostButton label="Change template" icon={<Pencil color={colors.text} size={13} />} onPress={() => setMode("templates")} />
          </View>
        </Card>

        <Card>
          <SectionHeader eyebrow="Career AI" title="Tailor this resume for a saved job" />
          <PickerField
            label="Saved jobs"
            value={selectedJobId}
            options={jobOptions}
            onChange={(value) => {
              setSelectedJobId(value);
              setGenerateError(null);
              setGenerateNotice(null);
            }}
            placeholder={jobOptions.length === 0 ? "No saved jobs yet" : "Select a job..."}
          />
          <GhostButton
            label={isGenerating ? "Generating..." : "Generate resume"}
            tone="brand"
            icon={<Sparkles color={colors.brand} size={14} />}
            onPress={() => void handleGenerateForJob()}
            disabled={isGenerating || !selectedJobId}
          />
          {generateError ? <ErrorText text={generateError} /> : null}
          {generateNotice ? <SuccessText text={generateNotice} /> : null}
          <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
            This regenerates the summary, experience bullets, project highlights, and skills below to match the job
            every time - nothing is saved until you export the PDF.
          </Text>
        </Card>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <GhostButton label={showPreview ? "Show form" : "Show preview"} onPress={() => setShowPreview((v) => !v)} />
        </View>

        {showPreview ? (
          <Card>
            <ResumePreview data={data} templateId={templateId} />
          </Card>
        ) : (
          <ResumeForm data={data} onChange={(updater) => setData((current) => updater(current))} />
        )}

        {error ? <ErrorText text={error} /> : null}

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <PrimaryButton label="Save resume" onPress={() => void handleSave()} loading={saving} disabled={exporting} />
          <GhostButton
            label="Export PDF"
            tone="brand"
            icon={<Download color={colors.brand} size={14} />}
            onPress={() => void handleExportPdf()}
            disabled={saving || exporting}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        eyebrow="Resume Studio"
        title="Visual Mode resumes"
        subtitle="Build and export resumes on your phone. LaTeX mode stays on CareerOS Desktop."
        right={<GhostButton label="New" icon={<FilePlus color={colors.text} size={14} />} onPress={startNew} />}
      />

      {loading ? <LoadingView label="Loading your resumes..." /> : null}

      {!loading && resumes.length === 0 ? (
        <EmptyState text="No resumes yet. Tap New to build your first one with a Visual Mode template." />
      ) : null}

      {resumes.map((resume) => {
        const meta = RESUME_VISUAL_TEMPLATES.find((t) => t.id === resume.templateId);
        return (
          <Pressable
            key={resume.id}
            onPress={() => openExisting(resume)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 4,
              borderLeftColor: meta?.accent ?? colors.brand,
              borderRadius: 12,
              padding: 14,
              backgroundColor: colors.surface,
              flexDirection: "row",
              alignItems: "center",
              gap: 10
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{resume.label}</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
                {meta?.name ?? resume.templateId} - updated {new Date(resume.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <GhostButton label="" icon={<Trash2 color={colors.danger} size={16} />} onPress={() => handleDelete(resume)} />
          </Pressable>
        );
      })}
    </Screen>
  );
}
