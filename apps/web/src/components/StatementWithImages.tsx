"use client";

/**
 * Renders a coding-problem statement string, turning any `[[image:<url>]]` markers (see
 * @/lib/coding-catalog/statement-images) into inline images instead of showing the raw marker text. Plain text is
 * rendered with `white-space: pre-wrap` so paragraph breaks the admin typed are preserved without needing markdown.
 */

import { sanitizeExternalUrl } from "@/lib/url-safety";
import { splitStatementIntoSegments } from "@/lib/coding-catalog/statement-images";

export default function StatementWithImages({ statement }: { statement: string }) {
  const segments = splitStatementIntoSegments(statement ?? "");

  return (
    <div className="statement-with-images">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.value) return null;
          return (
            <span className="statement-with-images-text" key={index}>
              {segment.value}
            </span>
          );
        }

        const safeUrl = sanitizeExternalUrl(segment.url);
        if (!safeUrl) {
          return (
            <span className="statement-with-images-broken" key={index}>
              [Image unavailable]
            </span>
          );
        }

        // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary URLs, not worth a
        // next.config.js remotePatterns entry for admin-uploaded content of unknown/varying hosts.
        return <img alt="Problem figure" className="statement-with-images-img" key={index} src={safeUrl} />;
      })}
    </div>
  );
}
