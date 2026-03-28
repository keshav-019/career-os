import { Fragment } from 'react';
import { ResumeData } from '@/lib/resume-types';
import { formatDateRange, fullName, getContactItems } from './shared';

const ACCENT = '#c0392b';
const ACCENT_TINT = '#fbeae7';
const TEXT = '#2a2320';
const MUTED = '#7a6f68';

const sectionPill = {
  display: 'inline-block',
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: ACCENT,
  background: ACCENT_TINT,
  borderRadius: 5,
  padding: '3px 10px',
  margin: '0 0 7px'
};

/**
 * "Coral" - inspired by the friendlier, warmer-toned built-in Google Docs template: colored
 * section-header pills instead of plain rules, suited to customer-facing or less formal roles.
 */
export default function CoralTemplate({ data }: { data: ResumeData }) {
  const { personal, education, experience, skills, projects, certifications } = data;
  const contactItems = getContactItems(personal);
  const name = fullName(personal);

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: TEXT, fontSize: 10.5, lineHeight: 1.45, padding: '0.55in 0.6in' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: ACCENT }}>{name || 'Your Name'}</div>
        {personal.title ? <div style={{ fontSize: 12.5, color: TEXT, fontWeight: 700, marginTop: 2 }}>{personal.title}</div> : null}
        {contactItems.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8, fontSize: 9.5, color: MUTED }}>
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
        <div style={{ marginBottom: 12 }}>
          <p style={sectionPill}>Summary</p>
          <p style={{ margin: 0 }}>{personal.summary}</p>
        </div>
      ) : null}

      {experience.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <p style={sectionPill}>Experience</p>
          {experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{exp.position} <span style={{ color: MUTED, fontWeight: 500 }}>@ {exp.company}</span></span>
                <span style={{ fontWeight: 600, color: ACCENT, fontSize: 9.5 }}>{formatDateRange(exp.startDate, exp.endDate, exp.current)}</span>
              </div>
              {exp.location ? <div style={{ fontStyle: 'italic', color: MUTED, fontSize: 9.5 }}>{exp.location}</div> : null}
              {exp.description.filter(Boolean).length > 0 ? (
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, listStyleType: 'square' }}>
                  {exp.description.filter(Boolean).map((line, idx) => (
                    <li key={idx} style={{ marginBottom: 1 }}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1.2 }}>
          {education.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <p style={sectionPill}>Education</p>
              {education.map((edu) => (
                <div key={edu.id} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700 }}>{edu.institution}</div>
                  <div style={{ color: MUTED, fontSize: 9.5 }}>
                    {[edu.degree, edu.field].filter(Boolean).join(' in ')} · {formatDateRange(edu.startDate, edu.endDate)}
                    {edu.gpa ? ` · GPA ${edu.gpa}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {projects.length > 0 ? (
            <div>
              <p style={sectionPill}>Projects</p>
              {projects.map((proj) => (
                <Fragment key={proj.id}>
                  <div style={{ fontWeight: 700 }}>{proj.name}</div>
                  {proj.description ? <p style={{ margin: '1px 0 4px', fontSize: 9.5, color: MUTED }}>{proj.description}</p> : null}
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1 }}>
          {skills.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <p style={sectionPill}>Skills</p>
              {skills.map((skill) => (
                <div key={skill.id} style={{ marginBottom: 4, fontSize: 9.5 }}>
                  <span style={{ fontWeight: 700 }}>{skill.category}: </span>
                  <span style={{ color: MUTED }}>{skill.items.join(', ')}</span>
                </div>
              ))}
            </div>
          ) : null}

          {certifications.length > 0 ? (
            <div>
              <p style={sectionPill}>Certifications</p>
              {certifications.map((cert) => (
                <div key={cert.id} style={{ marginBottom: 4, fontSize: 9.5 }}>
                  <span style={{ fontWeight: 700 }}>{cert.name}</span>
                  <div style={{ color: MUTED }}>{cert.issuer}{cert.issuer && cert.date ? ' · ' : ''}{cert.date}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
