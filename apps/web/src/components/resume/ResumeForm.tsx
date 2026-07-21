'use client';

import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ResumeData } from '@/lib/resume-types';

interface ResumeFormProps {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="resume-field">
      <label className="resume-field-label">{label}</label>
      {children}
    </div>
  );
}

export default function ResumeForm({ data, onChange }: ResumeFormProps) {
  const updatePersonal = (field: keyof ResumeData['personal'], value: string) => {
    onChange({ ...data, personal: { ...data.personal, [field]: value } });
  };

  // ---- Education ----
  const addEducation = () => {
    onChange({
      ...data,
      education: [
        ...data.education,
        { id: makeId(), institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', description: '' }
      ]
    });
  };
  const updateEducation = (index: number, field: string, value: string) => {
    const next = [...data.education];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, education: next });
  };
  const removeEducation = (index: number) => {
    onChange({ ...data, education: data.education.filter((_, i) => i !== index) });
  };

  // ---- Experience ----
  const addExperience = () => {
    onChange({
      ...data,
      experience: [
        ...data.experience,
        { id: makeId(), company: '', position: '', location: '', startDate: '', endDate: '', current: false, description: [''] }
      ]
    });
  };
  const updateExperience = (index: number, field: string, value: string | boolean) => {
    const next = [...data.experience];
    next[index] = { ...next[index], [field]: value } as (typeof next)[number];
    onChange({ ...data, experience: next });
  };
  const removeExperience = (index: number) => {
    onChange({ ...data, experience: data.experience.filter((_, i) => i !== index) });
  };
  const addBullet = (expIndex: number) => {
    const next = [...data.experience];
    next[expIndex] = { ...next[expIndex], description: [...next[expIndex].description, ''] };
    onChange({ ...data, experience: next });
  };
  const updateBullet = (expIndex: number, bulletIndex: number, value: string) => {
    const next = [...data.experience];
    const description = [...next[expIndex].description];
    description[bulletIndex] = value;
    next[expIndex] = { ...next[expIndex], description };
    onChange({ ...data, experience: next });
  };
  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const next = [...data.experience];
    next[expIndex] = { ...next[expIndex], description: next[expIndex].description.filter((_, i) => i !== bulletIndex) };
    onChange({ ...data, experience: next });
  };

  // ---- Skills ----
  const addSkillGroup = () => {
    onChange({ ...data, skills: [...data.skills, { id: makeId(), category: '', items: [] }] });
  };
  const updateSkillCategory = (index: number, value: string) => {
    const next = [...data.skills];
    next[index] = { ...next[index], category: value };
    onChange({ ...data, skills: next });
  };
  const updateSkillItems = (index: number, value: string) => {
    const next = [...data.skills];
    next[index] = { ...next[index], items: value.split(',').map((item) => item.trim()).filter(Boolean) };
    onChange({ ...data, skills: next });
  };
  const removeSkillGroup = (index: number) => {
    onChange({ ...data, skills: data.skills.filter((_, i) => i !== index) });
  };

  // ---- Projects ----
  const addProject = () => {
    onChange({ ...data, projects: [...data.projects, { id: makeId(), name: '', description: '', technologies: [], link: '' }] });
  };
  const updateProjectField = (index: number, field: 'name' | 'description' | 'link', value: string) => {
    const next = [...data.projects];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, projects: next });
  };
  const updateProjectTech = (index: number, value: string) => {
    const next = [...data.projects];
    next[index] = { ...next[index], technologies: value.split(',').map((item) => item.trim()).filter(Boolean) };
    onChange({ ...data, projects: next });
  };
  const removeProject = (index: number) => {
    onChange({ ...data, projects: data.projects.filter((_, i) => i !== index) });
  };

  // ---- Certifications ----
  const addCertification = () => {
    onChange({ ...data, certifications: [...data.certifications, { id: makeId(), name: '', issuer: '', date: '' }] });
  };
  const updateCertification = (index: number, field: 'name' | 'issuer' | 'date', value: string) => {
    const next = [...data.certifications];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, certifications: next });
  };
  const removeCertification = (index: number) => {
    onChange({ ...data, certifications: data.certifications.filter((_, i) => i !== index) });
  };

  return (
    <div className="resume-form">
      <section className="resume-form-section">
        <h3 className="resume-form-section-title">Personal information</h3>
        <div className="resume-field-grid">
          <Field label="First name">
            <input value={data.personal.firstName} onChange={(e) => updatePersonal('firstName', e.target.value)} placeholder="Avery" />
          </Field>
          <Field label="Last name">
            <input value={data.personal.lastName} onChange={(e) => updatePersonal('lastName', e.target.value)} placeholder="Chen" />
          </Field>
          <Field label="Professional title">
            <input value={data.personal.title ?? ''} onChange={(e) => updatePersonal('title', e.target.value)} placeholder="Senior Software Engineer" />
          </Field>
          <Field label="Email">
            <input type="email" value={data.personal.email} onChange={(e) => updatePersonal('email', e.target.value)} placeholder="you@email.com" />
          </Field>
          <Field label="Phone">
            <input value={data.personal.phone} onChange={(e) => updatePersonal('phone', e.target.value)} placeholder="(415) 555-0182" />
          </Field>
          <Field label="Location">
            <input value={data.personal.location} onChange={(e) => updatePersonal('location', e.target.value)} placeholder="San Francisco, CA" />
          </Field>
          <Field label="LinkedIn">
            <input value={data.personal.linkedin} onChange={(e) => updatePersonal('linkedin', e.target.value)} placeholder="linkedin.com/in/you" />
          </Field>
          <Field label="GitHub">
            <input value={data.personal.github} onChange={(e) => updatePersonal('github', e.target.value)} placeholder="github.com/you" />
          </Field>
          <Field label="Portfolio">
            <input type="url" value={data.personal.portfolio} onChange={(e) => updatePersonal('portfolio', e.target.value)} placeholder="you.dev" />
          </Field>
        </div>
        <Field label="Summary">
          <textarea
            value={data.personal.summary}
            onChange={(e) => updatePersonal('summary', e.target.value)}
            placeholder="Two to three sentences on who you are and what you're looking for."
            rows={3}
          />
        </Field>
      </section>

      <section className="resume-form-section">
        <div className="resume-form-section-head">
          <h3 className="resume-form-section-title">Experience</h3>
          <button className="resume-add-button" onClick={addExperience} type="button">
            <Plus size={13} /> Add
          </button>
        </div>
        {data.experience.length === 0 ? <p className="resume-form-empty">No experience added yet.</p> : null}
        {data.experience.map((exp, idx) => (
          <div className="resume-entry-card" key={exp.id}>
            <button aria-label="Remove experience" className="resume-entry-remove" onClick={() => removeExperience(idx)} type="button">
              <X size={13} />
            </button>
            <div className="resume-field-grid">
              <Field label="Company">
                <input value={exp.company} onChange={(e) => updateExperience(idx, 'company', e.target.value)} placeholder="Northwind Labs" />
              </Field>
              <Field label="Position">
                <input value={exp.position} onChange={(e) => updateExperience(idx, 'position', e.target.value)} placeholder="Senior Software Engineer" />
              </Field>
              <Field label="Location">
                <input value={exp.location} onChange={(e) => updateExperience(idx, 'location', e.target.value)} placeholder="San Francisco, CA" />
              </Field>
              <Field label="Start date">
                <input value={exp.startDate} onChange={(e) => updateExperience(idx, 'startDate', e.target.value)} placeholder="Jul 2022" />
              </Field>
              <Field label="End date">
                <input
                  disabled={exp.current}
                  value={exp.current ? '' : exp.endDate}
                  onChange={(e) => updateExperience(idx, 'endDate', e.target.value)}
                  placeholder={exp.current ? 'Present' : 'Jun 2022'}
                />
              </Field>
              <label className="resume-checkbox-field">
                <input checked={exp.current} onChange={(e) => updateExperience(idx, 'current', e.target.checked)} type="checkbox" />
                I currently work here
              </label>
            </div>

            <div className="resume-bullet-list">
              <span className="resume-field-label">Highlights</span>
              {exp.description.map((line, bulletIdx) => (
                <div className="resume-bullet-row" key={bulletIdx}>
                  <textarea
                    onChange={(e) => updateBullet(idx, bulletIdx, e.target.value)}
                    placeholder="Led migration of a monolithic billing service to event-driven microservices..."
                    rows={2}
                    value={line}
                  />
                  <button aria-label="Remove highlight" className="resume-entry-remove" onClick={() => removeBullet(idx, bulletIdx)} type="button">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button className="resume-add-bullet" onClick={() => addBullet(idx)} type="button">
                <Plus size={12} /> Add highlight
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="resume-form-section">
        <div className="resume-form-section-head">
          <h3 className="resume-form-section-title">Education</h3>
          <button className="resume-add-button" onClick={addEducation} type="button">
            <Plus size={13} /> Add
          </button>
        </div>
        {data.education.length === 0 ? <p className="resume-form-empty">No education added yet.</p> : null}
        {data.education.map((edu, idx) => (
          <div className="resume-entry-card" key={edu.id}>
            <button aria-label="Remove education" className="resume-entry-remove" onClick={() => removeEducation(idx)} type="button">
              <X size={13} />
            </button>
            <div className="resume-field-grid">
              <Field label="Institution">
                <input value={edu.institution} onChange={(e) => updateEducation(idx, 'institution', e.target.value)} placeholder="University of Washington" />
              </Field>
              <Field label="Degree">
                <input value={edu.degree} onChange={(e) => updateEducation(idx, 'degree', e.target.value)} placeholder="B.S." />
              </Field>
              <Field label="Field of study">
                <input value={edu.field} onChange={(e) => updateEducation(idx, 'field', e.target.value)} placeholder="Computer Science" />
              </Field>
              <Field label="GPA">
                <input value={edu.gpa} onChange={(e) => updateEducation(idx, 'gpa', e.target.value)} placeholder="3.8" />
              </Field>
              <Field label="Start date">
                <input value={edu.startDate} onChange={(e) => updateEducation(idx, 'startDate', e.target.value)} placeholder="Sep 2016" />
              </Field>
              <Field label="End date">
                <input value={edu.endDate} onChange={(e) => updateEducation(idx, 'endDate', e.target.value)} placeholder="Jun 2020" />
              </Field>
            </div>
            <Field label="Description (optional)">
              <textarea
                onChange={(e) => updateEducation(idx, 'description', e.target.value)}
                placeholder="Relevant coursework, honors, activities..."
                rows={2}
                value={edu.description}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="resume-form-section">
        <div className="resume-form-section-head">
          <h3 className="resume-form-section-title">Skills</h3>
          <button className="resume-add-button" onClick={addSkillGroup} type="button">
            <Plus size={13} /> Add group
          </button>
        </div>
        {data.skills.length === 0 ? <p className="resume-form-empty">No skill groups added yet.</p> : null}
        {data.skills.map((skill, idx) => (
          <div className="resume-entry-card" key={skill.id}>
            <button aria-label="Remove skill group" className="resume-entry-remove" onClick={() => removeSkillGroup(idx)} type="button">
              <X size={13} />
            </button>
            <div className="resume-field-grid">
              <Field label="Category">
                <input value={skill.category} onChange={(e) => updateSkillCategory(idx, e.target.value)} placeholder="Languages" />
              </Field>
              <Field label="Skills (comma-separated)">
                <input
                  onChange={(e) => updateSkillItems(idx, e.target.value)}
                  placeholder="TypeScript, Python, Go, SQL"
                  value={skill.items.join(', ')}
                />
              </Field>
            </div>
          </div>
        ))}
      </section>

      <section className="resume-form-section">
        <div className="resume-form-section-head">
          <h3 className="resume-form-section-title">Projects</h3>
          <button className="resume-add-button" onClick={addProject} type="button">
            <Plus size={13} /> Add
          </button>
        </div>
        {data.projects.length === 0 ? <p className="resume-form-empty">No projects added yet.</p> : null}
        {data.projects.map((proj, idx) => (
          <div className="resume-entry-card" key={proj.id}>
            <button aria-label="Remove project" className="resume-entry-remove" onClick={() => removeProject(idx)} type="button">
              <X size={13} />
            </button>
            <div className="resume-field-grid">
              <Field label="Name">
                <input value={proj.name} onChange={(e) => updateProjectField(idx, 'name', e.target.value)} placeholder="CareerOS" />
              </Field>
              <Field label="Link (optional)">
                <input value={proj.link} onChange={(e) => updateProjectField(idx, 'link', e.target.value)} placeholder="https://example.com" />
              </Field>
              <Field label="Technologies (comma-separated)">
                <input
                  onChange={(e) => updateProjectTech(idx, e.target.value)}
                  placeholder="Next.js, TypeScript, Firebase"
                  value={proj.technologies.join(', ')}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                onChange={(e) => updateProjectField(idx, 'description', e.target.value)}
                placeholder="What it does and the impact it had."
                rows={2}
                value={proj.description}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="resume-form-section">
        <div className="resume-form-section-head">
          <h3 className="resume-form-section-title">Certifications</h3>
          <button className="resume-add-button" onClick={addCertification} type="button">
            <Plus size={13} /> Add
          </button>
        </div>
        {data.certifications.length === 0 ? <p className="resume-form-empty">No certifications added yet.</p> : null}
        {data.certifications.map((cert, idx) => (
          <div className="resume-entry-card" key={cert.id}>
            <button aria-label="Remove certification" className="resume-entry-remove" onClick={() => removeCertification(idx)} type="button">
              <X size={13} />
            </button>
            <div className="resume-field-grid">
              <Field label="Name">
                <input value={cert.name} onChange={(e) => updateCertification(idx, 'name', e.target.value)} placeholder="AWS Certified Solutions Architect" />
              </Field>
              <Field label="Issuer">
                <input value={cert.issuer} onChange={(e) => updateCertification(idx, 'issuer', e.target.value)} placeholder="Amazon Web Services" />
              </Field>
              <Field label="Date">
                <input value={cert.date} onChange={(e) => updateCertification(idx, 'date', e.target.value)} placeholder="2024" />
              </Field>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
