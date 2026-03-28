import { notFound } from "next/navigation";
import ResumeStudio from "@/components/resume/ResumeStudio";
import { isDesktopAppEnabled } from "@/lib/desktop-mode";

export default function NewResumePage() {
  if (isDesktopAppEnabled()) {
    return <ResumeStudio />;
  }

  notFound();
}
