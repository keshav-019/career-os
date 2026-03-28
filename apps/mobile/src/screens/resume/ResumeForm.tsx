import { Text, View } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import type { ResumeData } from "../../types/resume";
import { useTheme } from "../../theme/ThemeContext";
import { Card, FieldLabel, GhostButton, SectionHeader, TextField } from "../../components/ui/Primitives";

let counter = 0;
function newId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

type Props = {
  data: ResumeData;
  onChange: (updater: (current: ResumeData) => ResumeData) => void;
};

export function ResumeForm({ data, onChange }: Props) {
  const { colors, fontSize } = useTheme();

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
        <TextField label="Summary" value={data.personal.summary} onChangeText={(v) => onChange((c) => ({ ...c, personal: { ...c.personal, summary: v } }))} multiline numberOfLines={4} />
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Experience"
          title="Work history"
          right={
            <GhostButton
              label="Add"
              icon={<Plus color={colors.text} size={13} />}
              onPress={() =>
                onChange((c) => ({
                  ...c,
                  experience: [
                    ...c.experience,
                    { id: newId("exp"), company: "", position: "", location: "", startDate: "", endDate: "", current: false, description: [""] }
                  ]
                }))
              }
            />
          }
        />
        {data.experience.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No experience added yet.</Text> : null}
        {data.experience.map((exp, index) => (
          <View key={exp.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Company" value={exp.company} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, company: v } : e)) }))} />
            <TextField label="Position" value={exp.position} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, position: v } : e)) }))} />
            <TextField label="Location" value={exp.location} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, location: v } : e)) }))} />
            <TextField label="Start date" value={exp.startDate} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, startDate: v } : e)) }))} placeholder="Jan 2023" />
            <TextField label="End date" value={exp.endDate} onChangeText={(v) => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, endDate: v } : e)) }))} placeholder="Present" editable={!exp.current} />
            <FieldLabel text="Highlights" />
            {exp.description.map((bullet, bulletIndex) => (
              <TextField
                key={bulletIndex}
                value={bullet}
                onChangeText={(v) =>
                  onChange((c) => ({
                    ...c,
                    experience: c.experience.map((e, i) => (i === index ? { ...e, description: e.description.map((d, bi) => (bi === bulletIndex ? v : d)) } : e))
                  }))
                }
                placeholder="Shipped a feature that..."
              />
            ))}
            <GhostButton
              label="Add highlight"
              icon={<Plus color={colors.text} size={12} />}
              onPress={() => onChange((c) => ({ ...c, experience: c.experience.map((e, i) => (i === index ? { ...e, description: [...e.description, ""] } : e)) }))}
            />
            <GhostButton
              label="Remove experience"
              tone="danger"
              icon={<Trash2 color={colors.danger} size={13} />}
              onPress={() => onChange((c) => ({ ...c, experience: c.experience.filter((_, i) => i !== index) }))}
            />
          </View>
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
              onPress={() =>
                onChange((c) => ({
                  ...c,
                  education: [...c.education, { id: newId("edu"), institution: "", degree: "", field: "", startDate: "", endDate: "", gpa: "", description: "" }]
                }))
              }
            />
          }
        />
        {data.education.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No education added yet.</Text> : null}
        {data.education.map((edu, index) => (
          <View key={edu.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Institution" value={edu.institution} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, institution: v } : e)) }))} />
            <TextField label="Degree" value={edu.degree} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, degree: v } : e)) }))} />
            <TextField label="Field of study" value={edu.field} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, field: v } : e)) }))} />
            <TextField label="GPA" value={edu.gpa} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, gpa: v } : e)) }))} />
            <TextField label="Start date" value={edu.startDate} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, startDate: v } : e)) }))} />
            <TextField label="End date" value={edu.endDate} onChangeText={(v) => onChange((c) => ({ ...c, education: c.education.map((e, i) => (i === index ? { ...e, endDate: v } : e)) }))} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => onChange((c) => ({ ...c, education: c.education.filter((_, i) => i !== index) }))} />
          </View>
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
              onPress={() => onChange((c) => ({ ...c, skills: [...c.skills, { id: newId("skill"), category: "", items: [] }] }))}
            />
          }
        />
        {data.skills.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No skills added yet.</Text> : null}
        {data.skills.map((skill, index) => (
          <View key={skill.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Category" value={skill.category} onChangeText={(v) => onChange((c) => ({ ...c, skills: c.skills.map((s, i) => (i === index ? { ...s, category: v } : s)) }))} placeholder="Languages" />
            <TextField
              label="Skills (comma-separated)"
              value={skill.items.join(", ")}
              onChangeText={(v) => onChange((c) => ({ ...c, skills: c.skills.map((s, i) => (i === index ? { ...s, items: v.split(",").map((x) => x.trim()).filter(Boolean) } : s)) }))}
            />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => onChange((c) => ({ ...c, skills: c.skills.filter((_, i) => i !== index) }))} />
          </View>
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
              onPress={() => onChange((c) => ({ ...c, projects: [...c.projects, { id: newId("proj"), name: "", description: "", technologies: [], link: "" }] }))}
            />
          }
        />
        {data.projects.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No projects added yet.</Text> : null}
        {data.projects.map((project, index) => (
          <View key={project.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Name" value={project.name} onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, name: v } : p)) }))} />
            <TextField label="Link" value={project.link} onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, link: v } : p)) }))} autoCapitalize="none" />
            <TextField
              label="Technologies (comma-separated)"
              value={project.technologies.join(", ")}
              onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, technologies: v.split(",").map((x) => x.trim()).filter(Boolean) } : p)) }))}
            />
            <TextField label="Description" value={project.description} onChangeText={(v) => onChange((c) => ({ ...c, projects: c.projects.map((p, i) => (i === index ? { ...p, description: v } : p)) }))} multiline numberOfLines={3} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => onChange((c) => ({ ...c, projects: c.projects.filter((_, i) => i !== index) }))} />
          </View>
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
              onPress={() => onChange((c) => ({ ...c, certifications: [...c.certifications, { id: newId("cert"), name: "", issuer: "", date: "" }] }))}
            />
          }
        />
        {data.certifications.length === 0 ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>No certifications added yet.</Text> : null}
        {data.certifications.map((cert, index) => (
          <View key={cert.id} style={{ gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
            <TextField label="Name" value={cert.name} onChangeText={(v) => onChange((c) => ({ ...c, certifications: c.certifications.map((x, i) => (i === index ? { ...x, name: v } : x)) }))} />
            <TextField label="Issuer" value={cert.issuer} onChangeText={(v) => onChange((c) => ({ ...c, certifications: c.certifications.map((x, i) => (i === index ? { ...x, issuer: v } : x)) }))} />
            <TextField label="Date" value={cert.date} onChangeText={(v) => onChange((c) => ({ ...c, certifications: c.certifications.map((x, i) => (i === index ? { ...x, date: v } : x)) }))} />
            <GhostButton label="Remove" tone="danger" icon={<Trash2 color={colors.danger} size={13} />} onPress={() => onChange((c) => ({ ...c, certifications: c.certifications.filter((_, i) => i !== index) }))} />
          </View>
        ))}
      </Card>
    </View>
  );
}
