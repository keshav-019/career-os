'use client';

import { useEffect, useRef, useState } from 'react';
import { ResumeData } from '@/lib/resume-types';
import { SAMPLE_RESUME_DATA } from './templates/sampleData';
import type { ResumeVisualTemplateMeta } from './templates';

/** Natural pixel width the templates are authored against (roughly a US Letter page at ~96dpi minus margins-friendly padding). */
const NATURAL_PAGE_WIDTH = 780;

interface TemplateThumbnailProps {
  template: ResumeVisualTemplateMeta;
  data?: ResumeData;
}

/**
 * Renders a scaled-down, non-interactive live preview of an actual template component - so the
 * gallery thumbnail is always exactly what the user will get, never a hand-drawn stand-in that
 * can drift out of sync with the real layout.
 */
export default function TemplateThumbnail({ template, data }: TemplateThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);
  const Template = template.component;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(width / NATURAL_PAGE_WIDTH);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="resume-template-thumb" ref={containerRef}>
      <div
        className="resume-template-thumb-inner"
        style={{ width: NATURAL_PAGE_WIDTH, transform: `scale(${scale})` }}
      >
        <Template data={data ?? SAMPLE_RESUME_DATA} />
      </div>
    </div>
  );
}
