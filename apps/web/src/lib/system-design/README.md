# System Design Track

## Purpose
An interactive, drag-and-drop System Design track inside Interview War Room: 26 real interview
architectures in one merged catalog - 16 classic distributed-systems problems (12 drawn from Alex
Xu's *System Design Interview* case studies, already loaded as CS reading material in
`learning-material/system_design_interview_textbook_clean.min.json`, plus 4 original problems -
ride-sharing dispatch, ticket booking, a distributed message queue, and a payment/wallet system)
and 10 ML System Design / MLOps problems (recommendation systems, feature stores, model serving,
distributed training, A/B testing, fraud detection, vector search, LLM inference serving, model
monitoring/drift detection, and data labeling pipelines) - filterable by tag right in the catalog
browser rather than split into a separate track. Unlike Coding, this track needs no local compiler
and runs on Vercel just like the Aptitude/CS/AI tracks - it's pure client-side interaction backed
by lightweight Next.js API routes.

Beyond the drag-and-drop tree itself, each problem also carries three extra learning layers built
on top of the same puzzle model (see "Beyond drag-and-drop" below): back-of-envelope capacity
estimation questions, an inline technology-tradeoff checkpoint tied to a specific node, and a
post-completion bottleneck/failure quiz - plus a client-side stopwatch for timed practice.

## The puzzle model
Every problem is authored as a simplified **top-down tree**: one root ("Client / User"), and every
other component has exactly one canonical parent. Real systems are graphs (a cache is both written
and read by different things), but a tree is what makes "drag the right piece onto the right parent"
gradable. The user can only ever attach a new component beneath something already placed - there is
no way to drop a component in a structural vacuum, which is what enforces the "top-down only, no
random placement" rule from the requirements. Where a real design genuinely has a second dependency
(e.g. an ML feature gets populated by a stream processor but also read synchronously by the serving
layer), the second relationship is captured in prose inside `whyItFits` rather than as a second tree
edge - documented inline in `catalog.server.ts` wherever it comes up.

## What this folder owns
- `component-library.ts` - the shared vocabulary of ~54 draggable component types (Load Balancer,
  Cache, Message Queue, Feature Store, Model Registry, Vector Database, Canary Router, etc.), each
  with a label, category, and one-line blurb. Safe to import from both server and client code - it's
  just generic vocabulary, not any problem's answer.
- `types.ts` - client-safe request/response shapes, including the public (answer-free) shapes for
  estimation questions, tradeoff prompts, and failure-quiz questions. No canonical tree structure or
  correct-answer data lives here.
- `catalog.server.ts` - defines the schema (`CatalogProblem` and friends, plus the Firestore-record
  extension `SystemDesignProblemRecord`) and every stateless grading function
  (`validatePlacement()`, `checkEstimation()`, `checkTradeoff()`, `checkFailureQuiz()`,
  `getCatalogSolution()`, `toProblemSummary()`, `toProblemDetail()`) - each takes an already-resolved
  problem record and never looks anything up itself. The `PROBLEMS` array here is legacy/seed data
  only now (see "Adding a new problem" below) - the live answer key for every problem lives in
  Firestore's `systemDesignProblems` collection (see `firestore.ts`), authored through the admin
  editor at `/admin/system-design-problems`. This file's runtime exports (the grading functions,
  `PROBLEMS`, `getCatalogProblem`) must never be imported from a `"use client"` component - only from
  route handlers under `app/api/system-design/**` and `firestore.ts`/`problem-builder.ts`. (Type-only
  imports of `CatalogProblem`/`SystemDesignProblemRecord` are fine anywhere - they're erased at build
  time. This repo has no network access to install the `server-only` npm guard package, so the
  runtime-export boundary is enforced by convention/code review instead of a build-time check - keep
  it that way if you ever get network access back.)
- `firestore.ts` - Admin SDK reads/writes against the `systemDesignProblems` Firestore collection,
  falling back to a plain Firestore REST call (see `@/lib/firebase/firestore-rest`) authenticated as
  the calling user's own ID token when the Admin SDK isn't configured - mirrors
  `lib/coding-catalog/firestore.ts` exactly.
- `problem-builder.ts` - `buildSystemDesignProblemRecord(input, context)` validates an admin-submitted
  `CatalogProblem` (tree integrity: every node id known/unique, every `parentId` resolves, the
  tradeoff's `nodeId` exists, exactly one correct tradeoff option, failure-quiz `correctOptionId`
  matches one of its own options) and stamps the Firestore bookkeeping fields (`order`, `createdAt`,
  `createdBy`, `updatedAt`, `sourceJson`). Much lighter than the coding-catalog equivalent since there's
  no harness/starter-code generation or reference-solution execution here.

## API routes (`app/api/system-design/**`)
- `GET /api/system-design/problems` - public summaries (id, title, difficulty, tags, companies).
- `GET /api/system-design/problems/[id]` - public detail: statement, requirements, the *set* of
  correct component ids and distractor ids (for the palette), a total node count for the progress
  bar, and the answer-free versions of the estimation/tradeoff/failure-quiz questions. Never includes
  the tree structure, hints, expected values, or which options are correct.
- `POST /api/system-design/problems/[id]/validate` - body `{ parentComponentId, attemptedComponentId,
  placedComponentIds }`. Stateless: the caller resends the full set of already-placed ids on every
  call instead of the server tracking a session, so there's nothing to expire or clean up. Returns
  `{ correct, message, whyItFits?, progress }`.
- `POST /api/system-design/problems/[id]/estimate` - body `{ answers: { questionId, value }[] }`.
  Returns per-question `{ withinRange, expectedRangeLabel, explanation }` - graded by percent
  tolerance around the expected value, not an exact match.
- `POST /api/system-design/problems/[id]/tradeoff` - body `{ nodeId, optionId }`. Returns
  `{ correct, chosenRationale, correctOptionId, correctLabel, correctRationale }`.
- `POST /api/system-design/problems/[id]/failure-quiz` - body `{ answers: { questionId, optionId }[] }`.
  Returns per-question `{ correct, correctOptionId, explanation }`.
- `GET /api/system-design/problems/[id]/solution` - full annotated tree + key takeaways, used for
  the post-completion debrief and the "view annotated solution" toggle.

## Beyond drag-and-drop
Four additions layered on top of the tree-building puzzle (all requested and confirmed by the
user rather than default scope):
1. **Capacity estimation** - a collapsible "Back-of-envelope estimates" panel on the statement pane,
   shown before the user starts placing components. Numeric inputs, graded against an expected value
   +/- a tolerance percentage (not an exact match), each with an explanation of the underlying math.
2. **Technology tradeoffs** - one node per problem (`problem.tradeoff.nodeId`) has a tied multiple-
   choice question that pops up immediately after that node is placed correctly, asking *which*
   technology/approach to use there and why - e.g. sliding-window vs. fixed-window rate limiting, or
   gradual canary rollout vs. an all-at-once model deploy.
3. **Bottleneck / failure quiz** - shown inside the completion banner once the whole tree is built:
   "what happens if X goes down" / "what's the bottleneck at 10x traffic" multiple-choice questions
   with explanations, reinforcing the non-functional requirements after the structural design is done.
4. **Timed practice** - a client-side-only stopwatch in the canvas toolbar, starting when the problem
   loads and freezing the instant the tree is complete. No backend involvement; resets with the
   "Reset" button.

The API/schema groundwork also leaves room for a future AI integration that could explain *why* a
component doesn't belong in a given spot in more depth than the static `misplacedHint` - not wired
up yet, but `ValidatePlacementResponse` and the hint-banner UI were kept simple on purpose so that
slot is easy to extend later.

## Frontend
- `components/SystemDesignBrowser.tsx` - problem list, mirrors `CodingArenaBrowser.tsx`. Includes a
  track-filter chip row ("All" / "Classic Systems" / "ML" / "MLOps") so the merged catalog stays easy
  to navigate as it grows.
- `app/system-design/[problemId]/page.tsx` - the solve page: a pure-CSS org-chart tree (`.sd-tree`
  in `globals.css`, the classic `li::before/::after` connector-line trick) on the canvas side, a
  shuffled palette of correct + distractor component chips below it, and the statement/requirements/
  estimation panel on the other side. Supports both native HTML5 drag-and-drop and a
  tap-to-arm/tap-to-place fallback for touch and accessibility - there is no extra graph/DnD library
  dependency (npm registry access isn't available in this environment, so everything here is vanilla
  React + CSS on purpose).
- Wired into `app/interview-prep/page.tsx` as its own flip-card and section, entirely independent of
  the `InterviewTestType`/MCQ template engine used by Aptitude/CS/AI - it has its own `systemDesignActive`
  boolean and an early-return render branch, so it can't interact with or break that quiz engine.

## Adding a new problem - step by step
Problems now live in Firestore, authored through the admin editor at
`/admin/system-design-problems` (paste-JSON only - see `apps/web/src/app/admin/system-design-problems/README.md`).
This mirrors Coding's Firestore-backed admin flow (`apps/web/src/lib/coding-catalog/README.md`), except
the schema here (tree edges, distractor ids, tolerance-graded estimation, node-tied tradeoffs, quiz
answer keys) is too interconnected for field-by-field form inputs, so the editor only offers a "paste
the whole `CatalogProblem` object" mode plus a bulk-import box for loading many problems at once. The
root `system-design-problems.seed.json` (a one-time export of the 26 problems that used to be
hardcoded in `catalog.server.ts`) is exactly what that bulk-import box expects - paste the whole file
in to restore all 26, or copy a single array entry's *shape* as a starting point for a new problem.

1. **Pick a root-relative structure first, on paper.** Draw the tree: "Client" at the top, then every
   component with exactly one parent. If a real design has a component with two logical parents (a
   cache written by a stream job but read by the API layer, say), pick the more important parent for
   the tree edge and explain the second relationship in that node's `whyItFits` prose instead - don't
   try to model a second edge, the validator doesn't support it.
2. **Reuse component ids from `component-library.ts` wherever the vocabulary already covers your
   component.** Only add a new `ComponentDefinition` there (`id`, `label`, `category`, `blurb`) if
   nothing existing fits. Keep every component id **unique within your new problem's `nodes` array** -
   the validator grades a placement by component id, not a client-generated node id, so a duplicate id
   inside one problem would make two tree positions indistinguishable to the grader.
3. **Write the `nodes` array**, one entry per non-root component: `{ id, parentId, whyItFits,
   misplacedHint }`. `parentId: null` means "direct child of the client root." `whyItFits` is shown the
   instant the user places it correctly - explain the *reason*, not just restate what it is.
   `misplacedHint` is shown when the user drops it on the wrong parent - point at what's wrong with
   *that* parent for *this* component, not a generic hint.
4. **Pick `distractorIds`**: component ids from `component-library.ts` that do NOT belong in this
   problem's tree at all, shown in the palette alongside the correct pieces so the puzzle isn't just
   "place everything you're given." 4-8 distractors is typical - too few makes the puzzle trivial, too
   many makes the palette unwieldy.
5. **Write `functionalRequirements` / `nonFunctionalRequirements` / `statement` / `summary`** the same
   way you'd write an actual interview prompt - these are shown to the user before they start, verbatim.
6. **Add the three bonus blocks** (all optional per-problem, but every existing problem has all three -
   keep new ones consistent):
   - `estimationQuestions`: each `{ id, prompt, unit, placeholder?, expectedValue, tolerancePercent,
     explanation }`. Graded by percent tolerance around `expectedValue`, not exact match - pick a
     tolerance wide enough that a reasonable back-of-envelope calculation passes (20-30% is typical).
   - `tradeoff`: `{ nodeId, prompt, options: [{ id, label, correct, rationale }] }` with **exactly one**
     `correct: true` option. `nodeId` must be an id that appears in this problem's own `nodes` array -
     the tradeoff question pops up right after that specific node is placed correctly.
   - `failureQuestions`: each `{ id, prompt, options: [{ id, label }], correctOptionId, explanation }` -
     "what happens if X goes down" / "what's the bottleneck at 10x scale" style questions.
7. **Set `id`, `title`, `difficulty`, `companies`, `tags`.** Include `"ML"` or `"MLOps"` in `tags` if it
   belongs on that filter tab, otherwise it shows under "Classic Systems". `id` must be unique across
   the *entire* `PROBLEMS` array (not just your new problem) and should be a short kebab-case slug - it
   becomes the URL at `/system-design/<id>`.
8. **Add `keyTakeaways`** - a short list of the 3-5 big lessons the post-completion debrief screen
   shows alongside the annotated solution tree.
9. **Verify locally**: run the web app (`npm run dev` in `apps/web`), sign in, open
   `/system-design/<your-new-id>` directly, and manually walk the puzzle: place every component
   (correct placements should show `whyItFits`, wrong ones `misplacedHint`), answer the estimation
   questions, trigger the tradeoff prompt on the node you tied it to, complete the tree and check the
   failure quiz and the annotated solution view. There is no automated test for this track's content
   (only the puzzle mechanics themselves are covered by manual QA) - a full walkthrough is the only way
   to catch a wrong `parentId` or a `tradeoff.nodeId` typo before a real user hits it.
