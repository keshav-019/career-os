import { ResumeData } from '@/lib/resume-types';
import { formatDateRange, fullName, getContactItems } from './shared';

const TEXT = '#1c1c1c';
const MUTED = '#6b6b6b';

const monoFont = '"Courier New", Courier, monospace';

const sectionHeader = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: TEXT,
  margin: '0 0 7px'
};

/**
 * "Modern Writer" - inspired by the minimalist, typewriter-style built-in Google Docs template
 * meant for design, writing, and other creative fields: monospace type, no color, no rules -
 * just generous whitespace doing the organizing.
 */
export default function ModernWriterTemplate({ data }: { data: ResumeData }) {
  const { personal, education, experience, skills, projects, certifications } = data;
  const contactItems = getContactItems(personal);
  const name = fullName(personal);

  return (
    <div style={{ fontFamily: monoFont, color: TEXT, fontSize: 10, lineHeight: 1.6, padding: '0.6in 0.65in' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>{name || 'Your Name'}</div>
        {personal.title ? <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{personal.title}</div> : null}
        {contactItems.length > 0 ? (
          <div style={{ marginTop: 8, fontSize: 9.5, color: MUTED }}>
            {contactItems.map(({ text }, idx) => (
              <span key={idx}>
                {text}
                {idx < contactItems.length - 1 ? '  /  ' : ''}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {personal.summary ? (
        <div style={{ marginBottom: 16 }}>
          <p style={sectionHeader}>Summary</p>
          <p style={{ margin: 0 }}>{personal.summary}</p>
        </div>
      ) : null}

      {experience.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <p style={sectionHeader}>Experience</p>
          {experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: 10 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{exp.position}</span>
                <span style={{ color: MUTED }}> — {exp.company}{exp.location ? `, ${exp.location}` : ''}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 9.5 }}>{formatDateRange(exp.startDate, exp.endDate, exp.current)}</div>
              {exp.description.filter(Boolean).length > 0 ? (
                <div style={{ margin: '4px 0 0' }}>
                  {exp.description.filter(Boolean).map((line, idx) => (
                    <div key={idx} style={{ marginBottom: 2 }}>– {line}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {education.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <p style={sectionHeader}>Education</p>
          {education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: 7 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{edu.institution}</span>
                <span style={{ color: MUTED }}> — {[edu.degree, edu.field].filter(Boolean).join(' in ')}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 9.5 }}>
                {formatDateRange(edu.startDate, edu.endDate)}
                {edu.gpa ? ` · GPA ${edu.gpa}` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <p style={sectionHeader}>Projects</p>
          {projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: 7 }}>
              <div style={{ fontWeight: 700 }}>
                {proj.name}
                {proj.link ? <span style={{ color: MUTED, fontWeight: 400 }}> — {proj.link}</span> : null}
              </div>
              {proj.description ? <div style={{ color: MUTED }}>{proj.description}</div> : null}
              {proj.technologies.length > 0 ? <div style={{ color: MUTED, fontSize: 9.5 }}>{proj.technologies.join(', ')}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {skills.length > 0 ? (
        <div style={{ marginBottom: certifications.length > 0 ? 16 : 0 }}>
          <p style={sectionHeader}>Skills</p>
          {skills.map((skill) => (
            <div key={skill.id} style={{ marginBottom: 3 }}>
              <span style={{ fontWeight: 700 }}>{skill.category}: </span>
              <span style={{ color: MUTED }}>{skill.items.join(', ')}</span>
            </div>
          ))}
        </div>
      ) : null}

      {certifications.length > 0 ? (
        <div>
          <p style={sectionHeader}>Certifications</p>
          {certifications.map((cert) => (
            <div key={cert.id} style={{ marginBottom: 3 }}>
              <span style={{ fontWeight: 700 }}>{cert.name}</span>
              <span style={{ color: MUTED }}> — {cert.issuer}{cert.issuer && cert.date ? ', ' : ''}{cert.date}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
