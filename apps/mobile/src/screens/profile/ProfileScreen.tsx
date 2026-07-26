import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { FileText, Plus, Trash2, Upload, UserRound } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { loadProfile, saveProfile } from "../../lib/profile";
import { uploadImageUriToCloudinary } from "../../lib/cloudinaryUpload";
import { useUserResumes } from "../../lib/resumes";
import { deleteUploadedResume, pickAndUploadResume, ResumeUploadCancelledError } from "../../lib/resumeUpload";
import { makeLocalId, type CareerPreference, type ProfileData } from "../../types/profile";
import {
  Card,
  ErrorText,
  FieldLabel,
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

const CAREER_PREFERENCE_OPTIONS: { value: CareerPreference; label: string }[] = [
  { value: "job", label: "Job" },
  { value: "internship", label: "Internship" },
  { value: "both", label: "Both" }
];

const GENDER_OPTIONS = [
  { value: "Prefer not to say", label: "Prefer not to say" },
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Non-binary", label: "Non-binary" },
  { value: "Other", label: "Other" }
];

function StringListEditor({ title, items, onAdd, onRemove }: { title: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void }) {
  const { colors, fontSize } = useTheme();
  const [draft, setDraft] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel text={title} />
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, flex: 1 }}>{item}</Text>
          <Pressable onPress={() => onRemove(index)}>
            <Trash2 color={colors.danger} size={14} />
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField value={draft} onChangeText={setDraft} placeholder="Add an item" />
        </View>
        <GhostButton
          label="Add"
          icon={<Plus color={colors.text} size={13} />}
          onPress={() => {
            if (!draft.trim()) return;
            onAdd(draft.trim());
            setDraft("");
          }}
        />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, fontSize } = useTheme();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { resumes } = useUserResumes(user?.uid);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile().then((p) => setProfile({ ...p, email: p.email || user?.email || "" }));
  }, [user?.email]);

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleUploadResume() {
    if (!user) return;
    setResumeError(null);
    setUploadingResume(true);
    try {
      await pickAndUploadResume(user.uid);
      setNotice("Resume uploaded. It's now available in AI Match.");
    } catch (err) {
      if (!(err instanceof ResumeUploadCancelledError)) {
        setResumeError(err instanceof Error ? err.message : "Could not upload this resume.");
      }
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleDeleteResume(resumeId: string) {
    if (!user) return;
    try {
      await deleteUploadedResume(user.uid, resumeId);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Could not remove this resume.");
    }
  }

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is required to change your avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadImageUriToCloudinary(result.assets[0].uri, "avatar.jpg");
      update("photoURL", url);
      setNotice("Profile photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveProfile(profile);
      setNotice(`Saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <Screen>
        <LoadingView label="Loading your profile..." />
      </Screen>
    );
  }

  const initials = (profile.fullName || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <Screen>
      <SectionHeader eyebrow="Profile" title="Career identity and preferences" subtitle="Keep this updated so suggestions and opportunities stay personalized." />

      <Card>
        <SectionHeader eyebrow="Profile Photo" title="Avatar" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {profile.photoURL ? <Image source={{ uri: profile.photoURL }} style={{ width: 64, height: 64 }} /> : <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: "800" }}>{initials}</Text>}
          </View>
          <View style={{ gap: 6 }}>
            <GhostButton label={uploadingPhoto ? "Uploading..." : "Change avatar"} onPress={() => void handlePickPhoto()} disabled={uploadingPhoto} />
            <GhostButton label="Remove" onPress={() => update("photoURL", "")} disabled={uploadingPhoto || !profile.photoURL} />
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader eyebrow="Personal" title="Basic information" right={<UserRound color={colors.text} size={18} />} />
        <TextField label="Full name" value={profile.fullName} onChangeText={(v) => update("fullName", v)} placeholder="Your full name" />
        <TextField label="Email" value={profile.email} onChangeText={(v) => update("email", v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Phone number" value={profile.phone} onChangeText={(v) => update("phone", v)} placeholder="+91 98xxxxxx" keyboardType="phone-pad" />
        <PickerField label="Gender" value={profile.gender} options={GENDER_OPTIONS} onChange={(v) => update("gender", v)} />
        <TextField label="Current location" value={profile.location} onChangeText={(v) => update("location", v)} placeholder="City, State, Country" />
        <TextField label="Profile summary" value={profile.profileSummary} onChangeText={(v) => update("profileSummary", v)} placeholder="A short summary about your background, strengths, and goals." multiline numberOfLines={4} />
      </Card>

      <Card>
        <SectionHeader eyebrow="Career" title="Career preferences" />
        <PickerField label="Looking for" value={profile.careerPreference} options={CAREER_PREFERENCE_OPTIONS} onChange={(v) => update("careerPreference", v)} />
        <DateTimeField label="Available to work from" value={profile.availabilityDateTime ? new Date(profile.availabilityDateTime) : null} onChange={(d) => update("availabilityDateTime", d.toISOString())} />
        <TextField label="Expected salary / stipend" value={profile.expectedSalary} onChangeText={(v) => update("expectedSalary", v)} placeholder="12 LPA or 30k/month" />
        <TextField label="Preferred locations" value={profile.preferredLocations} onChangeText={(v) => update("preferredLocations", v)} placeholder="Bengaluru, Pune, Remote" multiline numberOfLines={2} />
        <TextField label="Key skills" value={profile.keySkills} onChangeText={(v) => update("keySkills", v)} placeholder="React, TypeScript, System Design" multiline numberOfLines={2} />
        <TextField label="Blocked companies" value={profile.blockedCompanies} onChangeText={(v) => update("blockedCompanies", v)} placeholder="Companies to exclude from opportunities" multiline numberOfLines={2} />
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Education"
          title="Academic history"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("education", [...profile.education, { id: makeLocalId("edu"), institute: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", isPursuing: false, gradingType: "CGPA", score: "" }])} />}
        />
        {profile.education.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Institute" value={record.institute} onChangeText={(v) => update("education", profile.education.map((r, i) => (i === index ? { ...r, institute: v } : r)))} />
            <TextField label="Degree" value={record.degree} onChangeText={(v) => update("education", profile.education.map((r, i) => (i === index ? { ...r, degree: v } : r)))} />
            <TextField label="Field of study" value={record.fieldOfStudy} onChangeText={(v) => update("education", profile.education.map((r, i) => (i === index ? { ...r, fieldOfStudy: v } : r)))} />
            <TextField label="Score" value={record.score} onChangeText={(v) => update("education", profile.education.map((r, i) => (i === index ? { ...r, score: v } : r)))} placeholder="8.5 CGPA" />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("education", profile.education.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Skills"
          title="Languages"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("languages", [...profile.languages, { id: makeLocalId("lang"), language: "", canSpeak: false, canRead: false, canWrite: false, fluent: false }])} />}
        />
        {profile.languages.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Language" value={record.language} onChangeText={(v) => update("languages", profile.languages.map((r, i) => (i === index ? { ...r, language: v } : r)))} placeholder="English" />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("languages", profile.languages.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Experience"
          title="Internships"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("internships", [...profile.internships, { id: makeLocalId("intern"), company: "", role: "", startDate: "", endDate: "", isCurrent: false, description: "", skillsGained: "" }])} />}
        />
        {profile.internships.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Company" value={record.company} onChangeText={(v) => update("internships", profile.internships.map((r, i) => (i === index ? { ...r, company: v } : r)))} />
            <TextField label="Role" value={record.role} onChangeText={(v) => update("internships", profile.internships.map((r, i) => (i === index ? { ...r, role: v } : r)))} />
            <TextField label="Description" value={record.description} onChangeText={(v) => update("internships", profile.internships.map((r, i) => (i === index ? { ...r, description: v } : r)))} multiline numberOfLines={3} />
            <TextField label="Skills gained" value={record.skillsGained ?? ""} onChangeText={(v) => update("internships", profile.internships.map((r, i) => (i === index ? { ...r, skillsGained: v } : r)))} placeholder="e.g. REST API design, SQL optimization" multiline numberOfLines={2} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("internships", profile.internships.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Experience"
          title="Employment history"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("employmentHistory", [...profile.employmentHistory, { id: makeLocalId("job"), company: "", role: "", startDate: "", endDate: "", isCurrent: false, description: "", skillsGained: "" }])} />}
        />
        {profile.employmentHistory.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Company" value={record.company} onChangeText={(v) => update("employmentHistory", profile.employmentHistory.map((r, i) => (i === index ? { ...r, company: v } : r)))} />
            <TextField label="Role" value={record.role} onChangeText={(v) => update("employmentHistory", profile.employmentHistory.map((r, i) => (i === index ? { ...r, role: v } : r)))} />
            <TextField label="Description" value={record.description} onChangeText={(v) => update("employmentHistory", profile.employmentHistory.map((r, i) => (i === index ? { ...r, description: v } : r)))} multiline numberOfLines={3} />
            <TextField label="Skills gained" value={record.skillsGained ?? ""} onChangeText={(v) => update("employmentHistory", profile.employmentHistory.map((r, i) => (i === index ? { ...r, skillsGained: v } : r)))} placeholder="e.g. REST API design, SQL optimization" multiline numberOfLines={2} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("employmentHistory", profile.employmentHistory.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Projects"
          title="Project portfolio"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("projects", [...profile.projects, { id: makeLocalId("proj"), title: "", projectType: "hobby", startDate: "", endDate: "", description: "", techStack: "", skillsGained: "" }])} />}
        />
        {profile.projects.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Title" value={record.title} onChangeText={(v) => update("projects", profile.projects.map((r, i) => (i === index ? { ...r, title: v } : r)))} />
            <TextField label="Tech stack" value={record.techStack} onChangeText={(v) => update("projects", profile.projects.map((r, i) => (i === index ? { ...r, techStack: v } : r)))} />
            <TextField label="Description" value={record.description} onChangeText={(v) => update("projects", profile.projects.map((r, i) => (i === index ? { ...r, description: v } : r)))} multiline numberOfLines={3} />
            <TextField label="Skills gained" value={record.skillsGained ?? ""} onChangeText={(v) => update("projects", profile.projects.map((r, i) => (i === index ? { ...r, skillsGained: v } : r)))} placeholder="e.g. state management, API integration" multiline numberOfLines={2} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("projects", profile.projects.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Certifications"
          title="Credentials"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("certifications", [...profile.certifications, { id: makeLocalId("cert"), title: "", issuer: "", issueDate: "", fileName: "" }])} />}
        />
        {profile.certifications.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Title" value={record.title} onChangeText={(v) => update("certifications", profile.certifications.map((r, i) => (i === index ? { ...r, title: v } : r)))} />
            <TextField label="Issuer" value={record.issuer} onChangeText={(v) => update("certifications", profile.certifications.map((r, i) => (i === index ? { ...r, issuer: v } : r)))} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("certifications", profile.certifications.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Competitive Exams"
          title="Exam scores and ranks"
          right={<GhostButton label="Add" icon={<Plus color={colors.text} size={13} />} onPress={() => update("competitiveExams", [...profile.competitiveExams, { id: makeLocalId("exam"), examName: "", examYear: "", score: "", rank: "" }])} />}
        />
        {profile.competitiveExams.map((record, index) => (
          <View key={record.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Exam name" value={record.examName} onChangeText={(v) => update("competitiveExams", profile.competitiveExams.map((r, i) => (i === index ? { ...r, examName: v } : r)))} />
            <TextField label="Score" value={record.score} onChangeText={(v) => update("competitiveExams", profile.competitiveExams.map((r, i) => (i === index ? { ...r, score: v } : r)))} />
            <TextField label="Rank" value={record.rank} onChangeText={(v) => update("competitiveExams", profile.competitiveExams.map((r, i) => (i === index ? { ...r, rank: v } : r)))} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => update("competitiveExams", profile.competitiveExams.filter((_, i) => i !== index))} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHeader eyebrow="Accomplishments" title="Awards, clubs & achievements" />
        <StringListEditor title="Awards" items={profile.awards} onAdd={(v) => update("awards", [...profile.awards, v])} onRemove={(i) => update("awards", profile.awards.filter((_, idx) => idx !== i))} />
        <StringListEditor title="Clubs and committees" items={profile.clubsAndCommittees} onAdd={(v) => update("clubsAndCommittees", [...profile.clubsAndCommittees, v])} onRemove={(i) => update("clubsAndCommittees", profile.clubsAndCommittees.filter((_, idx) => idx !== i))} />
        <StringListEditor title="Academic achievements" items={profile.academicAchievements} onAdd={(v) => update("academicAchievements", [...profile.academicAchievements, v])} onRemove={(i) => update("academicAchievements", profile.academicAchievements.filter((_, idx) => idx !== i))} />
      </Card>

      <Card>
        <SectionHeader eyebrow="Resume" title="Uploaded resumes" subtitle="Upload a PDF, DOCX, or TXT resume - it's usable right away in AI Match." />
        {resumes.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No resumes uploaded yet.</Text>
        ) : (
          resumes.map((resume) => (
            <View
              key={resume.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface
              }}
            >
              <FileText color={colors.brand} size={18} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm, flex: 1 }} numberOfLines={1}>
                {resume.label}
              </Text>
              <Pressable onPress={() => void handleDeleteResume(resume.id)} hitSlop={8}>
                <Trash2 color={colors.danger} size={16} />
              </Pressable>
            </View>
          ))
        )}
        {resumeError ? <ErrorText text={resumeError} /> : null}
        <PrimaryButton
          label={uploadingResume ? "Uploading..." : "Upload Resume"}
          icon={<Upload color="#fff" size={14} />}
          onPress={() => void handleUploadResume()}
          loading={uploadingResume}
        />
      </Card>

      {error ? <ErrorText text={error} /> : null}
      {notice ? <SuccessText text={notice} /> : null}
      <PrimaryButton label={saving ? "Saving..." : "Update Profile"} onPress={() => void handleSave()} loading={saving} />
    </Screen>
  );
}
