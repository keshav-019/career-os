import ResumeStudio from "@/components/resume/ResumeStudio";

// Visual Mode (and the Resume Gallery) work anywhere - only LaTeX compilation needs CareerOS Desktop's local
// compiler, which ResumeStudio itself gates per-mode (see its "LaTeX (Desktop)" messaging). No reason to hide
// the whole page from regular web users anymore.
export default function ResumesPage() {
  return <ResumeStudio />;
}
