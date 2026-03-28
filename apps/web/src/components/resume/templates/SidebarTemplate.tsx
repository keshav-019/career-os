import { ResumeData } from '@/lib/resume-types';
import { formatDateRange, fullName, getContactItems } from './shared';

const ACCENT = '#2f4d6e';
const SIDEBAR_BG = '#eef2f6';
const TEXT = '#1f2430';
const MUTED = '#5b6472';

const mainSectionTitle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.07em',
  textTransform: 'uppercase' as const,
  color: ACCENT,
  margin: '0 0 6px'
};

const sideSectionTitle = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.07em',
  textTransform: 'uppercase' as const,
  color: ACCENT,
  margin: '0 0 5px'
};

/**
 * "Sidebar" - inspired by the two-column layout that's the odd one out among Google Docs'
 * built-in templates (the only one with a sidebar): contact info, skills, education, and
 * certifications live in a tinted left rail, while the wider right column carries the narrative
 * (summary, experience, projects).
 */
export default function SidebarTemplate({ data }: { data: ResumeData }) {
  const { personal, education, experience, skills, projects, certifications } = data;
  const contactItems = getContactItems(personal);
  const name = fullName(personal);

  return (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: TEXT, fontSize: 10.5, lineHeight: 1.45, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0.5in 0.6in 0.2in', borderBottom: `2px solid ${ACCENT}` }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{name || 'Your Name'}</div>
        {personal.title ? <div style={{ fontSize: 13, color: ACCENT, fontStyle: 'italic', marginTop: 2 }}>{personal.title}</div> : null}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: '34%', background: SIDEBAR_BG, padding: '0.3in 0.35in 0.5in 0.6in', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {contactItems.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <p style={sideSectionTitle}>Contact</p>
              {contactItems.map(({ key, icon: Icon, text }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 9.5, color: MUTED, wordBreak: 'break-word' }}>
                  <Icon size={10} color={ACCENT} strokeWidth={2.2} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          ) : null}

          {skills.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <p style={sideSectionTitle}>Skills</p>
              {skills.map((skill) => (
                <div key={skill.id} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 9.5 }}>{skill.category}</div>
                  <div style={{ fontSize: 9.5, color: MUTED }}>{skill.items.join(', ')}</div>
                </div>
              ))}
            </div>
          ) : null}

          {education.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <p style={sideSectionTitle}>Education</p>
              {education.map((edu) => (
                <div key={edu.id} style={{ marginBottom: 7, fontSize: 9.5 }}>
                  <div style={{ fontWeight: 700 }}>{edu.institution}</div>
                  <div style={{ color: MUTED }}>{[edu.degree, edu.field].filter(Boolean).join(' in ')}</div>
                  <div style={{ color: MUTED }}>{formatDateRange(edu.startDate, edu.endDate)}</div>
                  {edu.gpa ? <div style={{ color: MUTED }}>GPA: {edu.gpa}</div> : null}
                </div>
              ))}
            </div>
          ) : null}

          {certifications.length > 0 ? (
            <div>
              <p style={sideSectionTitle}>Certifications</p>
              {certifications.map((cert) => (
                <div key={cert.id} style={{ marginBottom: 6, fontSize: 9.5 }}>
                  <div style={{ fontWeight: 700 }}>{cert.name}</div>
                  <div style={{ color: MUTED }}>{cert.issuer}{cert.issuer && cert.date ? ' · ' : ''}{cert.date}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ width: '66%', padding: '0.3in 0.6in 0.5in 0.4in' }}>
          {personal.summary ? (
            <div style={{ marginBottom: 12 }}>
              <p style={mainSectionTitle}>Profile</p>
              <p style={{ margin: 0 }}>{personal.summary}</p>
            </div>
          ) : null}

          {experience.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <p style={mainSectionTitle}>Experience</p>
              {experience.map((exp) => (
                <div key={exp.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>{exp.position}</span>
                    <span style={{ fontWeight: 600, color: MUTED, fontSize: 9.5 }}>{formatDateRange(exp.startDate, exp.endDate, exp.current)}</span>
                  </div>
                  <div style={{ fontStyle: 'italic', color: MUTED, fontSize: 10 }}>
                    {exp.company}
                    {exp.location ? `, ${exp.location}` : ''}
                  </div>
                  {exp.description.filter(Boolean).length > 0 ? (
                    <ul style={{ margin: '3px 0 0', paddingLeft: 16 }}>
                      {exp.description.filter(Boolean).map((line, idx) => (
                        <li key={idx} style={{ marginBottom: 1 }}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {projects.length > 0 ? (
            <div>
              <p style={mainSectionTitle}>Projects</p>
              {projects.map((proj) => (
                <div key={proj.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>{proj.name}</span>
                    {proj.link ? <span style={{ fontSize: 9.5, color: ACCENT }}>{proj.link}</span> : null}
                  </div>
                  {proj.description ? <p style={{ margin: '1px 0' }}>{proj.description}</p> : null}
                  {proj.technologies.length > 0 ? <div style={{ fontSize: 9.5, color: MUTED }}>{proj.technologies.join(', ')}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
