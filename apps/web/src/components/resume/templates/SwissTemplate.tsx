import { Fragment } from 'react';
import { ResumeData } from '@/lib/resume-types';
import { formatDateRange, fullName, getContactItems } from './shared';

const ACCENT = '#c1652f';
const TEXT = '#1f2430';
const MUTED = '#5b6472';

const sectionTitleStyle = {
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: TEXT,
  margin: '0 0 5px',
  paddingBottom: 3,
  borderBottom: `1.5px solid ${ACCENT}`
};

/**
 * "Swiss" - inspired by the clean, ATS-strong single-column layout that leads Google Docs'
 * built-in resume gallery: subtle accent rule under each section, paragraph-first bullets,
 * no color blocks or sidebars so parsers read it top-to-bottom without confusion.
 */
export default function SwissTemplate({ data }: { data: ResumeData }) {
  const { personal, education, experience, skills, projects, certifications } = data;
  const contactItems = getContactItems(personal);
  const name = fullName(personal);

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: TEXT, fontSize: 10.5, lineHeight: 1.45, padding: '0.55in 0.6in' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '0.02em' }}>{name || 'Your Name'}</div>
        {personal.title ? <div style={{ fontSize: 12.5, color: ACCENT, fontWeight: 700, marginTop: 2 }}>{personal.title}</div> : null}
        {contactItems.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 14px', marginTop: 7, fontSize: 9.5, color: MUTED }}>
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
        <div style={{ marginBottom: 11 }}>
          <p style={sectionTitleStyle}>Summary</p>
          <p style={{ margin: 0 }}>{personal.summary}</p>
        </div>
      ) : null}

      {experience.length > 0 ? (
        <div style={{ marginBottom: 11 }}>
          <p style={sectionTitleStyle}>Experience</p>
          {experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: 7 }}>
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

      {education.length > 0 ? (
        <div style={{ marginBottom: 11 }}>
          <p style={sectionTitleStyle}>Education</p>
          {education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{edu.institution}</span>
                <span style={{ fontWeight: 600, color: MUTED, fontSize: 9.5 }}>{formatDateRange(edu.startDate, edu.endDate)}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 10 }}>
                {[edu.degree, edu.field].filter(Boolean).join(' in ')}
                {edu.gpa ? ` · GPA: ${edu.gpa}` : ''}
              </div>
              {edu.description ? <p style={{ margin: '2px 0 0' }}>{edu.description}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {skills.length > 0 ? (
        <div style={{ marginBottom: 11 }}>
          <p style={sectionTitleStyle}>Skills</p>
          {skills.map((skill) => (
            <div key={skill.id} style={{ marginBottom: 2 }}>
              <span style={{ fontWeight: 700 }}>{skill.category}: </span>
              <span>{skill.items.join(', ')}</span>
            </div>
          ))}
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div style={{ marginBottom: 11 }}>
          <p style={sectionTitleStyle}>Projects</p>
          {projects.map((proj) => (
            <Fragment key={proj.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>{proj.name}</span>
                {proj.link ? <span style={{ fontSize: 9.5, color: ACCENT }}>{proj.link}</span> : null}
              </div>
              <div style={{ marginBottom: 6 }}>
                {proj.description ? <p style={{ margin: '1px 0' }}>{proj.description}</p> : null}
                {proj.technologies.length > 0 ? (
                  <div style={{ fontSize: 9.5, color: MUTED }}>{proj.technologies.join(', ')}</div>
                ) : null}
              </div>
            </Fragment>
          ))}
        </div>
      ) : null}

      {certifications.length > 0 ? (
        <div>
          <p style={sectionTitleStyle}>Certifications</p>
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
