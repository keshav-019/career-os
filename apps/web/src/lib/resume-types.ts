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
}

export interface ResumeTemplate {
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    fields?: unknown[];
    latexTemplate: (data: ResumeData) => string;
}
