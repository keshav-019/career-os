import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react-native";
import type { ResumeData } from "../../types/resume";
import { useTheme } from "../../theme/ThemeContext";
import { Card, FieldLabel, GhostButton, SectionHeader, TextField } from "../../components/ui/Primitives";
import { PickerField } from "../../components/ui/PickerField";

let counter = 0;
function newId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_OPTIONS = MONTHS.map((m) => ({ value: m, label: m }));
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 60 }, (_, i) => String(CURRENT_YEAR + 1 - i)).map((y) => ({ value: y, label: y }));

function parseMonthYear(value: string): { month: string | null; year: string | null } {
  const [month, year] = value.trim().split(/\s+/);
  return { month: month && MONTHS.includes(month) ? month : null, year: year && /^\d{4}$/.test(year) ? year : null };
}

function formatMonthYear(month: string | null, year: string | null): string {
  return month && year ? `${month} ${year}` : "";
}

/** A month + year picker pair (no native month/year-only calendar exists in RN, so two dropdowns stand in for
 *  it) - stores/returns "MMM YYYY" strings, matching what templates/PDF export already expect. */
function MonthYearField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { month, year } = parseMonthYear(value);
  return (
    <View style={{ gap: 5 }}>
      <FieldLabel text={label} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PickerField
            value={month}
            options={MONTH_OPTIONS}
            onChange={(m) => onChange(formatMonthYear(m, year ?? String(CURRENT_YEAR)))}
            placeholder="Month"
          />
        </View>
        <View style={{ flex: 1 }}>
          <PickerField
            value={year}
            options={YEAR_OPTIONS}
            onChange={(y) => onChange(formatMonthYear(month ?? "Jan", y))}
            placeholder="Year"
          />
        </View>
      </View>
    </View>
  );
}

function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const { colors, fontSize } = useTheme();
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: checked ? colors.brand : colors.border,
          backgroundColor: checked ? colors.brand : "transparent",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {checked ? <Check color="#fff" size={13} /> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** Shared collapse/expand shell for one entry in a repeatable section (experience, education, skills, projects,
 *  certifications). Only one entry per section is expanded at a time (controlled by the parent's expandedId
 *  state) - everything else shows as a compact one-line summary. This replaces showing every entry fully expanded
 *  at once, which meant adding a second entry pushed the new (empty) one below everything already filled in,
 *  forcing a manual scroll to find it every time. */
function CollapsibleEntry({
  summaryTitle,
  summarySubtitle,
  expanded,
  onToggle,
  onRemove,
  children
}: {
  summaryTitle: string;
  summarySubtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" }}>
      <Pressable onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: colors.surface }}>
        {expanded ? <ChevronDown color={colors.muted} size={16} /> : <ChevronRight color={colors.muted} size={16} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }} numberOfLines={1}>
            {summaryTitle || "Untitled"}
          </Text>
          {summarySubtitle ? (
            <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
              {summarySubtitle}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Trash2 color={colors.danger} size={15} />
        </Pressable>
      </Pressable>
      {expanded ? <View style={{ gap: 8, padding: 10, paddingTop: 0 }}>{children}</View> : null}
    </View>
  );
}

type Props = {
  data: ResumeData;
  onChange: (updater: (current: ResumeData) => ResumeData) => void;
};

export function ResumeForm({ data, onChange }: Props) {
  const { colors, fontSize } = useTheme();

  const [expandedExperienceId, setExpandedExperienceId] = useState<string | null>(null);
  const [expandedEducationId, setExpandedEducationId] = useState<string | null>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedCertId, setExpandedCertId] = useState<string | null>(null);

  return (
    <View style={{ gap: 16 }}>
      <Card>
        <SectionHeader eyebrow="Personal information" title="About you" />
        <TextField label="First name" value={data.personal.firstName} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, firstName: v } }))} />
        <TextField label="Last name" value={data.personal.lastName} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, lastName: v } }))} />
        <TextField label="Professional title" value={data.personal.title ?? ""} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, title: v } }))} />
        <TextField label="Email" value={data.personal.email} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, email: v } }))} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Phone" value={data.personal.phone} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, phone: v } }))} keyboardType="phone-pad" />
        <TextField label="Location" value={data.personal.location} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, location: v } }))} />
        <TextField label="LinkedIn" value={data.personal.linkedin} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, linkedin: v } }))} autoCapitalize="none" />
        <TextField label="GitHub" value={data.personal.github} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, github: v } }))} autoCapitalize="none" />
        <TextField label="Portfolio" value={data.personal.portfolio} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, portfolio: v } }))} autoCapitalize="none" />
        <TextField
          label="Summary"
          value={data.personal.summary}
          onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, summary: v } }))}
          multiline
          numberOfLines={8}
          style={{ minHeight: 140, textAlignVertical: "top" }}
        />
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Experience"
          title="Work history"
          right={
            <GhostButton
              label="Add"
              icon={<Plus color={colors.text} size={13} />}
              onPress={() => {
                const id = newId("exp");
                onChange((c) => ({
                  ...c,
                  experience: [...c.experience, { id, company: "", position: "", location: "", startDate: "", endDate: "", current: false, description: [""] }]
                }));
                setExpandedExperienceId(id);
              }}
            />
          }
        />
        {data.experience.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No experience added yet.</Text> : null}
        {data.experience.map((exp, index) => (
          <CollapsibleEntry
            key={exp.id}
            summaryTitle={[exp.position, exp.company].filter(Boolean).join(" @ ")}
            summarySubtitle={exp.startDate || exp.endDate ? `${exp.startDate || "?"} - ${exp.current ? "Present" : exp.endDate || "?"}` : undefined}
            expanded={expandedExperienceId === exp.id}
            onToggle={() => setExpandedExperienceId((current) => (current === exp.id ? null : exp.id))}
            onRemove={() => onChange((c) => ({ ...c, experience: c.experience.filter((_, i) => i !== index) }))}
          >
            <TextField label="Company" value={exp.company} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, company: v } : e)) }))} />
            <TextField label="Position" value={exp.position} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, position: v } : e)) }))} />
            <TextField label="Location" value={exp.location} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, location: v } : e)) }))} />
            <MonthYearField label="Start date" value={exp.startDate} onChange={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, startDate: v } : e)) }))} />
            {exp.current ? null : (
              <MonthYearField label="End date" value={exp.endDate} onChange={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, endDate: v } : e)) }))} />
            )}
            <Checkbox
              label="I currently work here"
              checked={exp.current}
              onToggle={() =>
                onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, current: !e.current, endDate: !e.current ? "" : e.endDate } : e)) }))
              }
            />
            <FieldLabel text="Highlights" />
            {exp.description.map((bullet, bulletIndex) => (
              <View key={bulletIndex} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                <TextField
                  value={bullet}
                  onChangeText={(v) =>
                    onChange((c) => ({
                      ...c,
                      experience: c.experience.map((e, i) => (i === index ? { ...e, description: e.description.map((d, bi) => (bi === bulletIndex ? v : d)) } : e))
                    }))
                  }
                  placeholder="Shipped a feature that..."
                  multiline
                  numberOfLines={3}
                  style={{ flex: 1, minHeight: 64, textAlignVertical: "top" }}
                />
                {exp.description.length > 1 ? (
                  <Pressable
                    hitSlop={8}
                    style={{ paddingTop: 10 }}
                    onPress={() =>
                      onChange((c) => ({
                        ...c,
                        experience: c.experience.map((e, i) => (i === index ? { ...e, description: e.description.filter((_, bi) => bi !== bulletIndex) } : e))
                      }))
                    }
                  >
                    <Trash2 color={colors.danger} size={14} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <GhostButton
              label="Add highlight"
              icon={<Plus color={colors.text} size={12} />}
              onPress={() => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, description: [...e.description, ""] } : e)) }))}
            />
          </CollapsibleEntry>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Education"
          title="Academic history"
          right={
            <GhostButton
              label="Add"
              icon={<Plus color={colors.text} size={13} />}
              onPress={() => {
                const id = newId("edu");
                onChange((c) => ({ ...c, education: [...c.education, { id, institution: "", degree: "", field: "", startDate: "", endDate: "", gpa: "", description: "" }] }));
                setExpandedEducationId(id);
              }}
            />
          }
        />
        {data.education.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No education added yet.</Text> : null}
        {data.education.map((edu, index) => (
          <CollapsibleEntry
            key={edu.id}
            summaryTitle={[edu.degree, edu.institution].filter(Boolean).join(" - ")}
            summarySubtitle={edu.startDate || edu.endDate ? `${edu.startDate || "?"} - ${edu.endDate || "?"}` : undefined}
            expanded={expandedEducationId === edu.id}
            onToggle={() => setExpandedEducationId((current) => (current === edu.id ? null : edu.id))}
            onRemove={() => onChange((c) => ({ ...c, education: c.education.filter((_, i) => i !== index) }))}
          >
            <TextField label="Institution" value={edu.institution} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, institution: v } : e)) }))} />
            <TextField label="Degree" value={edu.degree} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, degree: v } : e)) }))} />
            <TextField label="Field of study" value={edu.field} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, field: v } : e)) }))} />
            <TextField label="GPA" value={edu.gpa} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, gpa: v } : e)) }))} />
            <MonthYearField label="Start date" value={edu.startDate} onChange={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, startDate: v } : e)) }))} />
            <MonthYearField label="End date" value={edu.endDate} onChange={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, endDate: v } : e)) }))} />
            <FieldLabel text="Highlights (honors, coursework, activities)" />
            <TextField
              value={edu.description}
              onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, description: v } : e)) }))}
              placeholder="Dean's list, relevant coursework..."
              multiline
              numberOfLines={3}
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
          </CollapsibleEntry>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Skills"
          title="Skill groups"
          right={
            <GhostButton
              label="Add"
              icon={<Plus color={colors.text} size={13} />}
              onPress={() => {
                const id = newId("skill");
                onChange((c) => ({ ...c, skills: [...c.skills, { id, category: "", items: [] }] }));
                setExpandedSkillId(id);
              }}
            />
          }
        />
        <PickerField
          label="Columns in resume"
          value={String(data.skillsColumns ?? 2)}
          options={[1, 2, 3].map((n) => ({ value: String(n), label: `${n} column${n > 1 ? "s" : ""}` }))}
          onChange={(v) => onChange((c) => ({ ...c, skillsColumns: Number(v) as 1 | 2 | 3 }))}
        />
        {data.skills.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No skills added yet.</Text> : null}
        {data.skills.map((skill, index) => (
          <CollapsibleEntry
            key={skill.id}
            summaryTitle={skill.category || "Uncategorized skills"}
            summarySubtitle={skill.items.join(", ") || undefined}
            expanded={expandedSkillId === skill.id}
            onToggle={() => setExpandedSkillId((current) => (current === skill.id ? null : skill.id))}
            onRemove={() => onChange((c) => ({ ...c, skills: c.skills.filter((_, i) => i !== index) }))}
          >
            <FieldLabel text="Category (leave blank for a plain bullet list with no heading)" />
            <TextField value={skill.category} onChangeText={(v) => onChange((c) => ({ ...c, skills: c.skills.map((s, i) => (i === index ? { ...s, category: v } : s)) }))} placeholder="Languages (optional)" />
            <TextField
              label="Skills (comma-separated)"
              value={skill.items.join(", ")}
              onChangeText={(v) => onChange((c) => ({ ...c, skills: c.skills.map((s, i) => (i === index ? { ...s, items: v.split(",").map((x) => x.trim()).filter(Boolean) } : s)) }))}
            />
          </CollapsibleEntry>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Projects"
          title="Project portfolio"
          right={
            <GhostButton
              label="Add"
              icon={<Plus color={colors.text} size={13} />}
              onPress={() => {
                const id = newId("proj");
                onChange((c) => ({ ...c, projects: [...c.projects, { id, name: "", description: "", technologies: [], link: "" }] }));
                setExpandedProjectId(id);
              }}
            />
          }
        />
        {data.projects.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No projects added yet.</Text> : null}
        {data.projects.map((project, index) => (
          <CollapsibleEntry
            key={project.id}
            summaryTitle={project.name}
            summarySubtitle={project.technologies.join(", ") || undefined}
            expanded={expandedProjectId === project.id}
            onToggle={() => setExpandedProjectId((current) => (current === project.id ? null : project.id))}
            onRemove={() => onChange((c) => ({ ...c, projects: c.projects.filter((_, i) => i !== index) }))}
          >
            <TextField label="Name" value={project.name} onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, name: v } : p)) }))} />
            <TextField label="Link" value={project.link} onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, link: v } : p)) }))} autoCapitalize="none" />
            <TextField
              label="Technologies (comma-separated)"
              value={project.technologies.join(", ")}
              onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, technologies: v.split(",").map((x) => x.trim()).filter(Boolean) } : p)) }))}
            />
            <TextField
              label="Description"
              value={project.description}
              onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, description: v } : p)) }))}
              multiline
              numberOfLines={4}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </CollapsibleEntry>
        ))}
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Certifications"
          title="Credentials"
          right={
            <GhostButton
              label="Add"
              icon={<Plus color={colors.text} size={13} />}
              onPress={() => {
                const id = newId("cert");
                onChange((c) => ({ ...c, certifications: [...c.certifications, { id, name: "", issuer: "", date: "" }] }));
                setExpandedCertId(id);
              }}
            />
          }
        />
        {data.certifications.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No certifications added yet.</Text> : null}
        {data.certifications.map((cert, index) => (
          <CollapsibleEntry
            key={cert.id}
            summaryTitle={cert.name}
            summarySubtitle={cert.issuer || undefined}
            expanded={expandedCertId === cert.id}
            onToggle={() => setExpandedCertId((current) => (current === cert.id ? null : cert.id))}
            onRemove={() => onChange((c) => ({ ...c, certifications: c.certifications.filter((_, i) => i !== index) }))}
          >
            <TextField label="Name" value={cert.name} onChangeText={(v) => onChange((c) => ({ ...c, certifications: c.certifications.map((x, i) => (i === index ? { ...x, name: v } : x)) }))} />
            <TextField label="Issuer" value={cert.issuer} onChangeText={(v) => onChange((c) => ({ ...c, certifications: c.certifications.map((x, i) => (i === index ? { ...x, issuer: v } : x)) }))} />
            <MonthYearField label="Date" value={cert.date} onChange={(v) => onChange((c) => ({ ...c, certifications: c.certifications.map((x, i) => (i === index ? { ...x, date: v } : x)) }))} />
          </CollapsibleEntry>
        ))}
      </Card>
    </View>
  );
}
