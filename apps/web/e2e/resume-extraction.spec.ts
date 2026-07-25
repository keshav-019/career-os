import { test, expect } from "@playwright/test";
import path from "node:path";
import { signIn } from "./helpers/auth";

/**
 * Covers AI Match's "Upload Resume" flow (apps/web/src/app/ai-match/page.tsx -> /api/resume/extract), across
 * every format the route claims to support (PDF, TXT) plus its two documented failure paths: an unsupported
 * legacy .doc file, and a PDF with no extractable text (e.g. a scanned/image-only page).
 *
 * Fixtures are entirely synthetic (fake names/contact info) - see e2e/fixtures/resumes/README.md.
 *
 * Regression coverage: this flow returned a generic "Unable to extract text from this resume" error in
 * production for every resume (real PDF text extraction was never actually broken - the underlying cause was
 * firebase-admin's auth verification crashing before the extraction code ever ran, see the fix commit for
 * apps/web/package.json's firebase-admin pin). These tests exercise the exact same authenticated request path,
 * so a regression there fails these tests too, not just a manual PDF-parsing check.
 */

const FIXTURES_DIR = path.join(__dirname, "fixtures", "resumes");

async function uploadResume(page: import("@playwright/test").Page, fileName: string) {
  await page.goto("/ai-match");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(FIXTURES_DIR, fileName));
}

test.describe("AI Match resume upload", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("extracts text from a synthetic PDF resume (software engineer format)", async ({ page }) => {
    await uploadResume(page, "sample-resume-software-engineer.pdf");

    await expect(page.locator("p.settings-feedback.success")).toContainText(/Extracted [\d,]+ characters/, {
      timeout: 15_000
    });
    await expect(page.locator("textarea.career-ai-upload-textarea")).toContainText("JORDAN LEE");
    await expect(page.locator("textarea.career-ai-upload-textarea")).toContainText("Spring Boot");
  });

  test("extracts text from a synthetic PDF resume (embedded systems format)", async ({ page }) => {
    await uploadResume(page, "sample-resume-embedded-systems.pdf");

    await expect(page.locator("p.settings-feedback.success")).toContainText(/Extracted [\d,]+ characters/, {
      timeout: 15_000
    });
    await expect(page.locator("textarea.career-ai-upload-textarea")).toContainText("ALEX MORGAN");
    await expect(page.locator("textarea.career-ai-upload-textarea")).toContainText("FreeRTOS");
  });

  test("extracts text from a synthetic PDF cover letter", async ({ page }) => {
    await uploadResume(page, "sample-cover-letter.pdf");

    await expect(page.locator("p.settings-feedback.success")).toContainText(/Extracted [\d,]+ characters/, {
      timeout: 15_000
    });
    await expect(page.locator("textarea.career-ai-upload-textarea")).toContainText("Dear Hiring Manager");
  });

  test("extracts text from a plain-text resume", async ({ page }) => {
    await uploadResume(page, "sample-resume.txt");

    await expect(page.locator("p.settings-feedback.success")).toContainText(/Extracted [\d,]+ characters/, {
      timeout: 15_000
    });
    await expect(page.locator("textarea.career-ai-upload-textarea")).toContainText("JORDAN LEE");
  });

  test("shows a clear error for a PDF with no extractable text", async ({ page }) => {
    await uploadResume(page, "empty-scanned-page.pdf");

    await expect(page.locator("p.settings-feedback.error")).toContainText(
      /No readable text was found in this resume/,
      { timeout: 15_000 }
    );
    await expect(page.locator("textarea.career-ai-upload-textarea")).toHaveValue("");
  });

  test("shows a clear error for an unsupported legacy .doc file", async ({ page }) => {
    await uploadResume(page, "unsupported-legacy-format.doc");

    await expect(page.locator("p.settings-feedback.error")).toContainText(
      /Legacy \.doc files cannot be read reliably/,
      { timeout: 15_000 }
    );
  });

  test("added resume becomes available to select for job matching", async ({ page }) => {
    await uploadResume(page, "sample-resume-software-engineer.pdf");
    await expect(page.locator("p.settings-feedback.success")).toContainText(/Extracted [\d,]+ characters/, {
      timeout: 15_000
    });

    await page.locator('button:has-text("Add Resume")').click();

    // No label was typed, so it falls back to the file's base name (see createLocalUploadedResume /
    // fileBaseName in ai-match/page.tsx, which also normalizes hyphens/underscores to spaces).
    await expect(page.locator("p.settings-feedback.success")).toContainText(
      "Added sample resume software engineer for this AI session.",
      { timeout: 5_000 }
    );
    await expect(page.locator(".career-ai-resume-row")).toContainText("sample resume software engineer");
  });
});
