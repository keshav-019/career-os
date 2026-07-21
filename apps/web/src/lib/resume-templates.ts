import type { ResumeSection, ResumeTemplateId } from '@careeros/shared';
import { ResumeData, ResumeTemplate } from './resume-types';

type ResumeTemplateCatalogItem = {
    defaultSections: ResumeSection[];
    description: string;
    family: string;
    id: ResumeTemplateId;
    name: string;
};

function section(id: string, title: string, contentHtml: string, order: number): ResumeSection {
    return {
        contentHtml,
        id,
        order,
        page: 1,
        plainText: contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        title
    };
}

export const defaultResumeTemplateId: ResumeTemplateId = 'ats-modern';

export const resumeTemplateCatalog: Record<ResumeTemplateId, ResumeTemplateCatalogItem> = {
    'ats-modern': {
        defaultSections: [
            section('summary', 'Summary', '<p>Outcome-focused software engineer with experience across product, data, and cloud systems.</p>', 0),
            section('skills', 'Skills', '<p>TypeScript, React, Node.js, Python, SQL, cloud platforms, testing, observability.</p>', 1),
            section('experience', 'Experience', '<p>Built reliable user-facing systems, improved delivery quality, and partnered with cross-functional teams.</p>', 2),
            section('projects', 'Projects', '<p>CareerOS: application tracking, interview prep, learning workflows, and resume tooling.</p>', 3)
        ],
        description: 'ATS-friendly layout with clear section hierarchy.',
        family: 'ATS',
        id: 'ats-modern',
        name: 'ATS Modern'
    },
    'classic-professional': {
        defaultSections: [
            section('summary', 'Professional Summary', '<p>Concise profile tailored for business and technical recruiters.</p>', 0),
            section('experience', 'Experience', '<p>Role, company, dates, ownership, measurable impact, and tools used.</p>', 1),
            section('education', 'Education', '<p>Degree, institution, dates, coursework, GPA, and academic achievements.</p>', 2),
            section('skills', 'Skills', '<p>Languages, frameworks, databases, cloud, and developer tools.</p>', 3)
        ],
        description: 'Traditional recruiter-readable structure.',
        family: 'Classic',
        id: 'classic-professional',
        name: 'Classic Professional'
    },
    'executive-impact': {
        defaultSections: [
            section('impact', 'Impact Snapshot', '<p>Leadership scope, strategic wins, revenue, savings, growth, or scale metrics.</p>', 0),
            section('experience', 'Leadership Experience', '<p>Company context, team scope, initiatives, and business outcomes.</p>', 1),
            section('strengths', 'Core Strengths', '<p>Strategy, execution, hiring, stakeholder management, and operational excellence.</p>', 2),
            section('education', 'Education', '<p>Degrees, certifications, and leadership programs.</p>', 3)
        ],
        description: 'Impact-first layout for senior roles.',
        family: 'Executive',
        id: 'executive-impact',
        name: 'Executive Impact'
    },
    'minimal-clean': {
        defaultSections: [
            section('summary', 'Summary', '<p>Clean one-paragraph overview tailored to the target role.</p>', 0),
            section('experience', 'Experience', '<p>Lean bullets with action, scope, and result.</p>', 1),
            section('projects', 'Selected Work', '<p>Two or three strongest projects with technologies and outcomes.</p>', 2),
            section('skills', 'Skills', '<p>Compact list of relevant technical and domain skills.</p>', 3)
        ],
        description: 'Minimal layout with generous whitespace.',
        family: 'Minimal',
        id: 'minimal-clean',
        name: 'Minimal Clean'
    },
    'technical-depth': {
        defaultSections: [
            section('summary', 'Technical Summary', '<p>Systems, architecture, performance, reliability, and product ownership.</p>', 0),
            section('skills', 'Technical Skills', '<p>Languages, frameworks, infrastructure, databases, testing, and tooling.</p>', 1),
            section('experience', 'Engineering Experience', '<p>Technical decisions, implementation details, scale, and measurable outcomes.</p>', 2),
            section('projects', 'Technical Projects', '<p>Architecture, implementation, tradeoffs, and shipped results.</p>', 3)
        ],
        description: 'Detailed structure for engineering-heavy resumes.',
        family: 'Technical',
        id: 'technical-depth',
        name: 'Technical Depth'
    },
    'academic-cv': {
        defaultSections: [
            section('education', 'Education', '<p>Degrees, institution, research focus, GPA, coursework, and honors.</p>', 0),
            section('research', 'Research', '<p>Research projects, advisor, methods, findings, and publications.</p>', 1),
            section('teaching', 'Teaching and Service', '<p>Teaching assistant roles, mentoring, service, and academic leadership.</p>', 2),
            section('skills', 'Technical Skills', '<p>Programming, statistics, lab methods, writing, and analysis tools.</p>', 3)
        ],
        description: 'Academic structure for research and graduate applications.',
        family: 'Academic',
        id: 'academic-cv',
        name: 'Academic CV'
    },
    'custom-blank': {
        defaultSections: [],
        description: 'Start with an empty document.',
        family: 'Custom',
        id: 'custom-blank',
        name: 'Custom Blank'
    }
};

export function getResumeTemplateById(templateId: ResumeTemplateId = defaultResumeTemplateId): ResumeTemplateCatalogItem {
    return resumeTemplateCatalog[templateId] ?? resumeTemplateCatalog[defaultResumeTemplateId];
}

// Template 1: Modern Professional
export const modernProfessionalTemplate: ResumeTemplate = {
    id: 'modern-professional',
    name: 'Modern Professional',
    description: 'Clean, modern design with a sidebar for skills and contact info',
    thumbnail: '/templates/modern-professional-thumb.png',
    fields: [], // Fields are defined in the form builder
    latexTemplate: (data: ResumeData) => {
        return `\\documentclass[10pt, letterpaper]{article}
\\usepackage[ignoreheadfoot, top=1.5cm, bottom=1.5cm, left=1.8cm, right=1.8cm]{geometry}
\\usepackage{titlesec}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{fontawesome5}
\\usepackage{hyperref}
\\usepackage{charter}

\\definecolor{primary}{RGB}{41, 128, 185}
\\definecolor{textcolor}{RGB}{44, 62, 80}

\\pagestyle{empty}
\\setcounter{secnumdepth}{0}
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\raggedright\\large\\bfseries\\color{primary}}
  {}{0em}{}[\\titlerule]

\\begin{document}

% Header
\\begin{center}
  {\\Huge\\bfseries ${data.personal.firstName} ${data.personal.lastName}} \\\\
  \\vspace{0.2cm}
  \\faEnvelope\\ \\href{mailto:${data.personal.email}}{${data.personal.email}} \\quad
  \\faPhone\\ ${data.personal.phone} \\quad
  \\faMapMarker\\ ${data.personal.location} \\\\
  \\faLinkedin\\ \\href{https://linkedin.com/in/${data.personal.linkedin}}{${data.personal.linkedin}} \\quad
  \\faGithub\\ \\href{https://github.com/${data.personal.github}}{${data.personal.github}}
\\end{center}

\\vspace{0.3cm}
\\section{Professional Summary}
${data.personal.summary}

\\section{Education}
${data.education.map(edu => `
\\textbf{${edu.institution}} \\hfill ${edu.startDate} -- ${edu.endDate} \\\\
${edu.degree} in ${edu.field} \\hfill \\textit{GPA: ${edu.gpa}} \\\\
${edu.description}
`).join('\\vspace{0.2cm}\n')}

\\section{Experience}
${data.experience.map(exp => `
\\textbf{${exp.company}} \\hfill ${exp.startDate} -- ${exp.endDate} \\\\
\\textit{${exp.position}} \\hfill ${exp.location} \\\\
\\begin{itemize}[leftmargin=*, nosep]
${exp.description.map(d => `\\item ${d}`).join('\n')}
\\end{itemize}
`).join('\\vspace{0.2cm}\n')}

\\section{Skills}
${data.skills.map(skill => `
\\textbf{${skill.category}}: ${skill.items.join(', ')}
`).join('\n')}

\\section{Projects}
${data.projects.map(proj => `
\\textbf{${proj.name}} \\hfill ${proj.link ? `\\href{${proj.link}}{Link}` : ''} \\\\
${proj.description} \\\\
\\textit{Technologies: ${proj.technologies.join(', ')}}
`).join('\\vspace{0.2cm}\n')}

\\end{document}`;
    }
};

// Template 2: Classic Two-Column
export const classicTwoColumnTemplate: ResumeTemplate = {
    id: 'classic-two-column',
    name: 'Classic Two-Column',
    description: 'Traditional two-column layout with a sidebar',
    thumbnail: '/templates/classic-two-column-thumb.png',
    fields: [],
    latexTemplate: (data: ResumeData) => {
        return `\\documentclass[10pt, letterpaper]{article}
\\usepackage[ignoreheadfoot, top=1.5cm, bottom=1.5cm, left=1.5cm, right=1.5cm]{geometry}
\\usepackage{paracol}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{fontawesome5}
\\usepackage{hyperref}
\\usepackage{charter}

\\definecolor{primary}{RGB}{44, 62, 80}
\\columnratio{0.3}

\\pagestyle{empty}
\\setcounter{secnumdepth}{0}
\\setlength{\\parindent}{0pt}

\\begin{document}

\\begin{center}
  {\\Huge\\bfseries ${data.personal.firstName} ${data.personal.lastName}} \\\\
  \\vspace{0.2cm}
  ${data.personal.email} \\quad ${data.personal.phone} \\\\
  ${data.personal.location}
\\end{center}

\\begin{paracol}{2}
\\switchcolumn[0]*
\\section*{Skills}
${data.skills.map(skill => `
\\textbf{${skill.category}}\\newline
${skill.items.join(', ')}
`).join('\\vspace{0.2cm}\n')}

\\section*{Education}
${data.education.map(edu => `
\\textbf{${edu.institution}}\\newline
${edu.degree} in ${edu.field}\\newline
${edu.startDate} -- ${edu.endDate}
`).join('\\vspace{0.2cm}\n')}

\\switchcolumn[1]
\\section*{Professional Summary}
${data.personal.summary}

\\section*{Experience}
${data.experience.map(exp => `
\\textbf{${exp.company}} \\hfill ${exp.startDate} -- ${exp.endDate} \\\\
\\textit{${exp.position}} \\\\
${exp.description.map(d => `\\begin{itemize}[nosep]\\item ${d}\\end{itemize}`).join('')}
`).join('\\vspace{0.2cm}\n')}

\\section*{Projects}
${data.projects.map(proj => `
\\textbf{${proj.name}}\\newline
${proj.description}
`).join('\\vspace{0.2cm}\n')}

\\end{paracol}
\\end{document}`;
    }
};

export const AVAILABLE_TEMPLATES: ResumeTemplate[] = [
    modernProfessionalTemplate,
    classicTwoColumnTemplate,
];
