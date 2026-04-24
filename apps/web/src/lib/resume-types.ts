export interface ResumeData {
    personal: {
        firstName: string;
        lastName: string;
        /** Professional headline/tagline shown under the name, e.g. "Senior Software Engineer". */
        title?: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        github: string;
        portfolio: string;
        summary: string;
    };
    education: {
        id: string;
        institution: string;
        degree: string;
        field: string;
        startDate: string;
        endDate: string;
        gpa: string;
        description: string;
    }[];
    experience: {
        id: string;
        company: string;
        position: string;
        location: string;
        startDate: string;
        endDate: string;
        current: boolean;
        description: string[];
    }[];
    skills: {
        id: string;
        category: string;
        items: string[];
    }[];
    projects: {
        id: string;
        name: string;
        description: string;
        technologies: string[];
        link: string;
    }[];
    certifications: {
        id: string;
        name: string;
        issuer: string;
        date: string;
    }[];
    /** 1-3 columns for rendering the skills section. A single skill group with an empty `category` renders as a
     *  flat bullet list with no heading ("just a bunch of skills") - multiple groups with categories render each
     *  as its own labeled column/section. Optional and defaults to 2 for resumes saved before this field existed. */
    skillsColumns?: 1 | 2 | 3;
}

export interface ResumeTemplate {
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    fields?: unknown[];
    latexTemplate: (data: ResumeData) => string;
}

/** Firestore document shape for a saved Visual Mode resume (users/{uid}/mobileResumes/{id}) - shared by web and
 *  mobile (see lib/firebase/collections.ts). jobId/jobLabel are set when this resume was produced by "Generate
 *  resume" for a specific saved job, so the Resume Gallery can show which version was tailored for which role. */
export interface VisualResumeRecord {
    id: string;
    label: string;
    templateId: string;
    data: ResumeData;
    createdAt: string;
    updatedAt: string;
    jobId?: string;
    jobLabel?: string;
}
