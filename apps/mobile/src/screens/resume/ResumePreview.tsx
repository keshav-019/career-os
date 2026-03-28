import { Text, View } from "react-native";
import type { ResumeData, ResumeTemplateId } from "../../types/resume";
import { RESUME_VISUAL_TEMPLATES } from "../../types/resume";

function accentFor(templateId: ResumeTemplateId): string {
  return RESUME_VISUAL_TEMPLATES.find((t) => t.id === templateId)?.accent ?? "#c1652f";
}

function ContactLine({ data }: { data: ResumeData }) {
  const parts = [data.personal.email, data.personal.phone, data.personal.location, data.personal.linkedin, data.personal.github, data.personal.portfolio].filter(
    Boolean
  );
  return <Text style={{ color: "#555", fontSize: 11 }}>{parts.join("  |  ")}</Text>;
}

function SectionTitle({ text, accent, variant }: { text: string; accent: string; variant: ResumeTemplateId }) {
  if (variant === "coral") {
    return (
      <View style={{ backgroundColor: accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start" }}>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>{text}</Text>
      </View>
    );
  }
  if (variant === "spearmint") {
    return (
      <View style={{ borderBottomWidth: 2, borderBottomColor: accent, paddingBottom: 3, alignSelf: "stretch" }}>
        <Text style={{ color: "#111", fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</Text>
      </View>
    );
  }
  if (variant === "modern-writer") {
    return (
      <Text style={{ color: "#1c1c1c", fontSize: 12, fontWeight: "700", fontFamily: "monospace", letterSpacing: 1 }}>
        // {text.toUpperCase()}
      </Text>
    );
  }
  // swiss / sidebar
  return (
    <Text style={{ color: accent, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</Text>
  );
}

export function ResumePreview({ data, templateId }: { data: ResumeData; templateId: ResumeTemplateId }) {
  const accent = accentFor(templateId);
  const isMono = templateId === "modern-writer";
  const nameFont = isMono ? "monospace" : undefined;

  const body = (
    <View style={{ gap: 14 }}>
      {data.personal.summary ? (
        <View style={{ gap: 4 }}>
          <SectionTitle text="Summary" accent={accent} variant={templateId} />
          <Text style={{ color: "#222", fontSize: 12, lineHeight: 18 }}>{data.personal.summary}</Text>
        </View>
      ) : null}

      {data.experience.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionTitle text="Experience" accent={accent} variant={templateId} />
          {data.experience.map((exp) => (
            <View key={exp.id} style={{ gap: 2 }}>
              <Text style={{ color: "#111", fontSize: 12.5, fontWeight: "700" }}>
                {exp.position} - {exp.company}
              </Text>
              <Text style={{ color: "#666", fontSize: 10.5 }}>
                {exp.location} | {exp.startDate} - {exp.current ? "Present" : exp.endDate}
              </Text>
              {exp.description.map((bullet, i) => (
                <Text key={i} style={{ color: "#333", fontSize: 11, lineHeight: 16 }}>
                  - {bullet}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {data.projects.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionTitle text="Projects" accent={accent} variant={templateId} />
          {data.projects.map((project) => (
            <View key={project.id} style={{ gap: 2 }}>
              <Text style={{ color: "#111", fontSize: 12.5, fontWeight: "700" }}>{project.name}</Text>
              {project.technologies.length ? <Text style={{ color: "#666", fontSize: 10.5 }}>{project.technologies.join(", ")}</Text> : null}
              <Text style={{ color: "#333", fontSize: 11, lineHeight: 16 }}>{project.description}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {data.education.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionTitle text="Education" accent={accent} variant={templateId} />
          {data.education.map((edu) => (
            <View key={edu.id} style={{ gap: 2 }}>
              <Text style={{ color: "#111", fontSize: 12.5, fontWeight: "700" }}>
                {edu.degree} {edu.field ? `in ${edu.field}` : ""}
              </Text>
              <Text style={{ color: "#666", fontSize: 10.5 }}>
                {edu.institution} | {edu.startDate} - {edu.endDate} {edu.gpa ? `| ${edu.gpa}` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {data.certifications.length > 0 ? (
        <View style={{ gap: 6 }}>
          <SectionTitle text="Certifications" accent={accent} variant={templateId} />
          {data.certifications.map((cert) => (
            <Text key={cert.id} style={{ color: "#333", fontSize: 11 }}>
              {cert.name} - {cert.issuer} ({cert.date})
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  const skillsBlock =
    data.skills.length > 0 ? (
      <View style={{ gap: 6 }}>
        <SectionTitle text="Skills" accent={accent} variant={templateId} />
        {data.skills.map((skill) => (
          <Text key={skill.id} style={{ color: "#333", fontSize: 11, lineHeight: 16 }}>
            <Text style={{ fontWeight: "700" }}>{skill.category}: </Text>
            {skill.items.join(", ")}
          </Text>
        ))}
      </View>
    ) : null;

  if (templateId === "sidebar") {
    return (
      <View style={{ backgroundColor: "#fff", borderRadius: 8, padding: 16, flexDirection: "row", gap: 14 }}>
        <View style={{ width: "34%", gap: 12, borderRightWidth: 1, borderRightColor: "#eee", paddingRight: 12 }}>
          <Text style={{ color: accent, fontSize: 18, fontWeight: "900" }}>
            {data.personal.firstName} {data.personal.lastName}
          </Text>
          <Text style={{ color: "#555", fontSize: 11 }}>{data.personal.title}</Text>
          <ContactLine data={data} />
          {skillsBlock}
        </View>
        <View style={{ flex: 1 }}>{body}</View>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 8, padding: 18, gap: 14 }}>
      <View style={{ alignItems: templateId === "swiss" ? "center" : "flex-start", gap: 4 }}>
        <Text style={{ color: templateId === "modern-writer" ? "#1c1c1c" : accent, fontSize: 20, fontWeight: "900", fontFamily: nameFont }}>
          {data.personal.firstName} {data.personal.lastName}
        </Text>
        {data.personal.title ? <Text style={{ color: "#555", fontSize: 12 }}>{data.personal.title}</Text> : null}
        <ContactLine data={data} />
      </View>
      {body}
      {skillsBlock}
    </View>
  );
}
