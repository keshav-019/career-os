import type { ComponentType } from 'react';
import { ResumeData } from '@/lib/resume-types';
import CoralTemplate from './CoralTemplate';
import ModernWriterTemplate from './ModernWriterTemplate';
import SidebarTemplate from './SidebarTemplate';
import SpearmintTemplate from './SpearmintTemplate';
import SwissTemplate from './SwissTemplate';

export type ResumeVisualTemplateId = 'swiss' | 'sidebar' | 'coral' | 'spearmint' | 'modern-writer';

export type ResumeVisualTemplateMeta = {
  id: ResumeVisualTemplateId;
  name: string;
  tagline: string;
  description: string;
  bestFor: string;
  accent: string;
  component: ComponentType<{ data: ResumeData }>;
};

/**
 * Five templates modeled on the well-known archetypes in Google Docs' built-in resume gallery
 * (Swiss, Serif, Coral, Spearmint, Modern Writer) - same structural DNA, original implementation.
 */
export const RESUME_VISUAL_TEMPLATES: ResumeVisualTemplateMeta[] = [
  {
    id: 'swiss',
    name: 'Swiss',
    tagline: 'Clean single column',
    description: 'Subtle accent rules, paragraph-first bullets, and a strict top-to-bottom flow built for ATS parsers.',
    bestFor: 'Best for most roles, especially when a system reads your resume before a human does.',
    accent: '#c1652f',
    component: SwissTemplate
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    tagline: 'Two-column with a contact rail',
    description: 'A tinted left sidebar carries contact info, skills, and education while the wide column tells your story.',
    bestFor: 'Best when you want skills and credentials to stay visible at a glance.',
    accent: '#2f4d6e',
    component: SidebarTemplate
  },
  {
    id: 'coral',
    name: 'Coral',
    tagline: 'Bold section headers',
    description: 'Warm colored pills mark each section, with a two-column footer for education, skills, and projects.',
    bestFor: 'Best for customer-facing, sales, or people-first roles.',
    accent: '#c0392b',
    component: CoralTemplate
  },
  {
    id: 'spearmint',
    name: 'Spearmint',
    tagline: 'Strong section dividers',
    description: 'Bold rules separate every section and Education is promoted above Experience.',
    bestFor: 'Best for students and early-career applicants.',
    accent: '#1f9d73',
    component: SpearmintTemplate
  },
  {
    id: 'modern-writer',
    name: 'Modern Writer',
    tagline: 'Minimalist & typewriter-style',
    description: 'Monospace type, no color, no rules - just whitespace and rhythm doing the organizing.',
    bestFor: 'Best for design, writing, and other creative fields.',
    accent: '#1c1c1c',
    component: ModernWriterTemplate
  }
];

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeVisualTemplateId = 'swiss';

export function getResumeVisualTemplate(id: ResumeVisualTemplateId | string | null | undefined): ResumeVisualTemplateMeta {
  return (
    RESUME_VISUAL_TEMPLATES.find((template) => template.id === id) ??
    RESUME_VISUAL_TEMPLATES.find((template) => template.id === DEFAULT_RESUME_TEMPLATE_ID)!
  );
}
