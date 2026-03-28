import { ResumeData } from '@/lib/resume-types';

/**
 * Realistic placeholder data used only to render live template previews in the gallery picker.
 * Never shown to the user as "their" data - swapped out immediately once they start editing.
 */
export const SAMPLE_RESUME_DATA: ResumeData = {
  personal: {
    firstName: 'Avery',
    lastName: 'Chen',
    title: 'Senior Software Engineer',
    email: 'avery.chen@email.com',
    phone: '(415) 555-0182',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/averychen',
    github: 'github.com/averychen',
    portfolio: 'averychen.dev',
    summary:
      'Product-minded engineer with 6+ years building reliable, high-traffic web platforms. Focused on developer experience, performance, and cross-functional delivery.'
  },
  education: [
    {
      id: 'edu-1',
      institution: 'University of Washington',
      degree: 'B.S.',
      field: 'Computer Science',
      startDate: 'Sep 2016',
      endDate: 'Jun 2020',
      gpa: '3.8',
      description: 'Relevant coursework: Distributed Systems, Algorithms, Databases.'
    }
  ],
  experience: [
    {
      id: 'exp-1',
      company: 'Northwind Labs',
      position: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      startDate: 'Jul 2022',
      endDate: 'Present',
      current: true,
      description: [
        'Led migration of a monolithic billing service to event-driven microservices, cutting P95 latency by 40%.',
        'Mentored 4 engineers and established a code-review rubric adopted org-wide.',
        'Shipped a self-serve analytics dashboard used by 200+ internal teams.'
      ]
    },
    {
      id: 'exp-2',
      company: 'Bright Path Software',
      position: 'Software Engineer',
      location: 'Seattle, WA',
      startDate: 'Jul 2020',
      endDate: 'Jun 2022',
      current: false,
      description: [
        'Built and shipped a React/Node.js customer portal used by 50,000+ monthly active users.',
        'Reduced CI pipeline runtime by 55% by parallelizing test suites.'
      ]
    }
  ],
  skills: [
    { id: 'skill-1', category: 'Languages', items: ['TypeScript', 'Python', 'Go', 'SQL'] },
    { id: 'skill-2', category: 'Frameworks', items: ['React', 'Node.js', 'Next.js', 'Django'] },
    { id: 'skill-3', category: 'Infrastructure', items: ['AWS', 'Docker', 'Kubernetes', 'Terraform'] }
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'CareerOS',
      description: 'Career management platform with application tracking, interview prep, and resume tooling.',
      technologies: ['Next.js', 'TypeScript', 'Firebase'],
      link: 'https://example.com'
    }
  ],
  certifications: [
    { id: 'cert-1', name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2024' }
  ]
};
