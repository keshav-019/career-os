"use client";

type CompanyAvatarProps = {
  company: string;
  logoUrl?: string;
  toneClassName: string;
};

export function CompanyAvatar({ company, logoUrl, toneClassName }: CompanyAvatarProps) {
  const initial = company.trim().charAt(0).toUpperCase() || "C";
  const safeAlt = `${company} logo`;
  const cleanLogoUrl = (() => {
    const raw = typeof logoUrl === "string" ? logoUrl.trim() : "";
    if (!raw) {
      return "";
    }

    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }

      return parsed.toString();
    } catch {
      return "";
    }
  })();

  return (
    <div className={`company-mark ${toneClassName}`}>
      <span className="company-mark-fallback">{initial}</span>
      {cleanLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={safeAlt}
          className="company-logo"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          referrerPolicy="no-referrer"
          src={cleanLogoUrl}
        />
      ) : null}
    </div>
  );
}
