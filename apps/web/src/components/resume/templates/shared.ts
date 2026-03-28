import { BriefcaseBusiness, Code2, Globe, Mail, MapPin, Phone } from 'lucide-react';
import type { ComponentType } from 'react';
import { ResumeData } from '@/lib/resume-types';

export type ContactItem = {
  key: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  text: string;
  href?: string;
};

/**
 * Builds the populated-only list of contact line items (email/phone/location/links) for a
 * resume's personal info, in a consistent order, so every template renders the same set without
 * duplicating the "only show it if it's filled in" logic five times over.
 */
export function getContactItems(personal: ResumeData['personal']): ContactItem[] {
  const items: ContactItem[] = [];

  if (personal.email) {
    items.push({ key: 'email', icon: Mail, text: personal.email, href: `mailto:${personal.email}` });
  }
  if (personal.phone) {
    items.push({ key: 'phone', icon: Phone, text: personal.phone });
  }
  if (personal.location) {
    items.push({ key: 'location', icon: MapPin, text: personal.location });
  }
  if (personal.linkedin) {
    const clean = personal.linkedin.replace(/^https?:\/\//, '');
    items.push({ key: 'linkedin', icon: BriefcaseBusiness, text: clean, href: personal.linkedin.startsWith('http') ? personal.linkedin : `https://${clean}` });
  }
  if (personal.github) {
    const clean = personal.github.replace(/^https?:\/\//, '');
    items.push({ key: 'github', icon: Code2, text: clean, href: personal.github.startsWith('http') ? personal.github : `https://${clean}` });
  }
  if (personal.portfolio) {
    const clean = personal.portfolio.replace(/^https?:\/\//, '');
    items.push({ key: 'portfolio', icon: Globe, text: clean, href: personal.portfolio.startsWith('http') ? personal.portfolio : `https://${clean}` });
  }

  return items;
}

export function formatDateRange(startDate: string, endDate: string, current?: boolean): string {
  const end = current ? 'Present' : endDate;
  if (!startDate && !end) return '';
  if (!startDate) return end;
  if (!end) return startDate;
  return `${startDate} – ${end}`;
}

export function fullName(personal: ResumeData['personal']): string {
  return [personal.firstName, personal.lastName].filter(Boolean).join(' ');
}
