import { ResumeData } from '@/lib/resume-types';
import { formatDateRange, fullName, getContactItems } from './shared';

const ACCENT = '#1f9d73';
const TEXT = '#20272c';
const MUTED = '#5f6b72';

const sectionHeader = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.04em',
  color: TEXT,
  margin: '0 0 6px',
  paddingBottom: 6,
  borderBottom: `3px solid ${ACCENT}`
};

/**
 * "Spearmint" - inspired by the built-in Google Docs template known for strong section
 * separation that makes skills and education easy to scan; a natural fit for students and
 * early-career applicants, so Education is promoted above Experience here.
 */
export default function SpearmintTemplate({ data }: { data: ResumeData }) {
  const { personal, education, experience, skills, projects, certifications } = data;
  const contactItems = getContactItems(personal);
  const name = fullName(personal);

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: TEXT, fontSize: 10.5, lineHeight: 1.5, padding: '0.55in 0.65in' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 27, fontWeight: 800 }}>{name || 'Your Name'}</div>
        {personal.title ? <div style={{ fontSize: 13, color: ACCENT, fontWeight: 700, marginTop: 3 }}>{personal.title}</div> : null}
        {contactItems.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '5px 16px', marginTop: 9, fontSize: 9.5, color: MUTED }}>
            {contactItems.map(({ key, icon: Icon, text }) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon size={10} color={ACCENT} strokeWidth={2.2} />
                {text}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {personal.summary ? (
        <div style={{ marginBottom: 14 }}>
          <p style={sectionHeader}>Summary</p>
          <p style={{ margin: 0 }}>{personal.summary}</p>
        </div>
      ) : null}

      {education.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <p style={sectionHeader}>Education</p>
          {education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{edu.institution}</span>
                <span style={{ fontWeight: 600, color: MUTED, fontSize: 9.5 }}>{formatDateRange(edu.startDate, edu.endDate)}</span>
              </div>
              <div style={{ color: MUTED }}>
                {[edu.degree, edu.field].filter(Boolean).join(' in ')}
                {edu.gpa ? ` · GPA: ${edu.gpa}` : ''}
              </div>
              {edu.description ? <p style={{ margin: '2px 0 0' }}>{edu.description}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {skills.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <p style={sectionHeader}>Skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
            {skills.map((skill) => (
              <div key={skill.id} style={{ fontSize: 9.5 }}>
                <span style={{ fontWeight: 700 }}>{skill.category}: </span>
                <span style={{ color: MUTED }}>{skill.items.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {experience.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <p style={sectionHeader}>Experience</p>
          {experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{exp.company}</span>
                <span style={{ fontWeight: 600, color: MUTED, fontSize: 9.5 }}>{formatDateRange(exp.startDate, exp.endDate, exp.current)}</span>
              </div>
              <div style={{ fontStyle: 'italic', color: MUTED, fontSize: 10 }}>
                {exp.position}
                {exp.location ? ` — ${exp.location}` : ''}
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
        <div style={{ marginBottom: certifications.length > 0 ? 14 : 0 }}>
          <p style={sectionHeader}>Projects</p>
          {projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: 6 }}>
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

      {certifications.length > 0 ? (
        <div>
          <p style={sectionHeader}>Certifications</p>
          {certifications.map((cert) => (
            <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span><strong>{cert.name}</strong>{cert.issuer ? ` — ${cert.issuer}` : ''}</span>
              <span style={{ color: MUTED, fontSize: 9.5 }}>{cert.date}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
