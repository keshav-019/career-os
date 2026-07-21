import { COMPONENT_CATEGORY_META, getComponent } from "./component-library";
import type {
  EstimateRequest,
  EstimateResponse,
  FailureQuizRequest,
  FailureQuizResponse,
  SolutionNode,
  SystemDesignDifficulty,
  SystemDesignProblemDetail,
  SystemDesignProblemSummary,
  SystemDesignSolution,
  TradeoffRequest,
  TradeoffResponse,
  ValidatePlacementRequest,
  ValidatePlacementResponse
} from "./types";

/**
 * SERVER-ONLY catalog for the System Design track.
 *
 * The `PROBLEMS` array below is now legacy/seed data only - the live answer key for every problem
 * lives in Firestore's `systemDesignProblems` collection (see `./firestore.ts`), authored through
 * the admin editor at `/admin/system-design-problems`. `PROBLEMS` is kept here purely as the source
 * for the one-time export to the root `system-design-problems.seed.json` file, so the 26 problems
 * that used to be hardcoded can be pasted into the admin editor one at a time (exactly how the
 * coding-arena catalog was migrated - see `apps/web/src/lib/coding-catalog/README.md`). Nothing at
 * runtime reads from `PROBLEMS`/`getCatalogProblem` anymore; every route under
 * `app/api/system-design/**` fetches a `SystemDesignProblemRecord` from Firestore instead and
 * passes it directly into the grading functions below.
 *
 * The grading functions (`validatePlacement`, `checkEstimation`, `checkTradeoff`,
 * `checkFailureQuiz`, `getCatalogSolution`, `toProblemDetail`, `toProblemSummary`) are pure: they
 * take an already-resolved `CatalogProblem`/`SystemDesignProblemRecord` and never look anything up
 * themselves, so they work identically whether that record came from Firestore or (for local
 * testing) the static array. This file must never be imported from a "use client" component for
 * its runtime exports - see the note on `SystemDesignProblemRecord` above for why type-only imports
 * are still fine.
 *
 * NOTE: this repo doesn't have network access to install the `server-only` npm guard package, so
 * this boundary is enforced purely by convention/code review - do not import this module's runtime
 * exports outside of `app/api/system-design/**` route handlers and `./firestore.ts`/migration
 * tooling.
 *
 * Each problem is authored as a simplified TOP-DOWN TREE: one root ("Client / User"), and every
 * other component has exactly one canonical parent. Real systems are graphs (a cache is both
 * written and read by different things), but a tree is what makes a "drag the right piece onto
 * the right parent" puzzle tractable and gradable - the `whyItFits` text calls out the
 * simplification wherever it matters (e.g. "app servers also read straight from this cache").
 *
 * A component type is used at most once per problem, so a placement can be identified purely by
 * (attemptedComponentId, parentComponentId) without needing a full graph diff.
 */

export type CatalogNode = {
  /** Component vocabulary id (see component-library.ts). Unique within a single problem. */
  id: string;
  /** Canonical parent's component id, or null only for the implicit root ("client"). */
  parentId: string | null;
  /** Shown when the user places this component correctly - reinforces *why* it belongs there. */
  whyItFits: string;
  /** Shown whenever this component gets dropped onto the wrong parent. */
  misplacedHint: string;
};

export type CatalogEstimationQuestion = {
  id: string;
  prompt: string;
  unit: string;
  placeholder?: string;
  /** The reference back-of-envelope value. */
  expectedValue: number;
  /** A guess within this % of expectedValue (either direction) counts as "within range". */
  tolerancePercent: number;
  explanation: string;
};

export type CatalogTradeoffOption = {
  id: string;
  label: string;
  correct: boolean;
  rationale: string;
};

export type CatalogTradeoff = {
  /** Fires as a follow-up the moment this catalog node is placed correctly. */
  nodeId: string;
  prompt: string;
  options: CatalogTradeoffOption[];
};

export type CatalogFailureOption = {
  id: string;
  label: string;
};

export type CatalogFailureQuestion = {
  id: string;
  prompt: string;
  options: CatalogFailureOption[];
  correctOptionId: string;
  explanation: string;
};

export type CatalogProblem = {
  id: string;
  title: string;
  difficulty: SystemDesignDifficulty;
  companies: string[];
  tags: string[];
  summary: string;
  statement: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  scaleNote?: string;
  /** Root is always the literal "client" component; kept explicit for readability. */
  rootComponentId: "client";
  nodes: CatalogNode[];
  /** Hand-picked wrong-but-plausible components to seed the palette alongside the real ones. */
  distractorIds: string[];
  keyTakeaways: string[];
  /** Back-of-envelope estimation questions, shown before the candidate starts building. */
  estimationQuestions?: CatalogEstimationQuestion[];
  /** A single technology-choice reasoning checkpoint, tied to one node in the tree. */
  tradeoff?: CatalogTradeoff;
  /** Post-completion "what breaks" / bottleneck multiple-choice questions. */
  failureQuestions?: CatalogFailureQuestion[];
};

/**
 * The fully-baked record stored in Firestore's `systemDesignProblems/{id}` documents - a
 * `CatalogProblem` (the answer key) plus the same bookkeeping fields `CodingProblemRecord` carries
 * (see lib/coding-catalog/types.ts): admin-list ordering, audit timestamps, and a verbatim copy of
 * the admin's last-submitted JSON so the admin editor can reload a problem for editing without
 * reconstructing it from derived fields.
 *
 * NOTE for anyone editing this file: `CatalogProblem`/`SystemDesignProblemRecord` (type-only
 * declarations) are safe to `import type` from a "use client" file - TypeScript erases type-only
 * imports at build time, so no runtime code crosses the boundary. It's only the `PROBLEMS` array,
 * `getCatalogProblem`, and the grading functions below (real code, real answer data) that must
 * never be imported from a "use client" component.
 */
/** What an admin submits via the admin editor - a full `CatalogProblem`, paste-JSON only (see
 *  app/admin/system-design-problems/page.tsx for why field-by-field editing isn't offered here). */
export type SystemDesignProblemSourceInput = CatalogProblem;

export type SystemDesignProblemRecord = CatalogProblem & {
  createdAt: string;
  createdBy: string;
  order: number;
  /** The exact admin-submitted CatalogProblem JSON, stringified verbatim. See CodingProblemRecord.sourceJson
   *  for why this is stored instead of reconstructed - admin-only, never included in any public shape. */
  sourceJson: string;
  updatedAt: string;
};

export const PROBLEMS: CatalogProblem[] = [
  // ---------------------------------------------------------------------------------------
  // FOUNDATIONS
  // ---------------------------------------------------------------------------------------
  {
    id: "scale-to-millions",
    title: "Scale a Single Server to Millions of Users",
    difficulty: "easy",
    companies: ["Generic", "Amazon", "Google"],
    tags: ["Fundamentals", "Load Balancing", "Caching", "CDN"],
    summary: "The classic warm-up: grow one box running everything into a horizontally-scaled web tier.",
    statement:
      "You inherited a product that runs entirely on a single server (web app, database, and cache all on one box). " +
      "Traffic is growing fast. Redesign the request path so it can serve millions of concurrent users without a " +
      "single point of failure, separating static-asset delivery from dynamic request handling.",
    functionalRequirements: [
      "Users can resolve the domain name and reach the application from anywhere in the world.",
      "Static assets (images, JS, CSS) load quickly regardless of the user's location.",
      "Dynamic requests are handled by a pool of interchangeable application servers.",
      "Repeated reads of the same hot data should not always hit the database."
    ],
    nonFunctionalRequirements: [
      "No single server should be a hard single point of failure.",
      "The web tier should scale horizontally by adding more identical servers.",
      "Read-heavy hot paths should be fast (sub-100ms) even under load."
    ],
    scaleNote: "Assume traffic grows from thousands to tens of millions of daily active users over a year.",
    rootComponentId: "client",
    nodes: [
      {
        id: "dns",
        parentId: null,
        whyItFits:
          "Every request starts by resolving the domain name to an IP address - DNS is the very first hop, directly " +
          "under the client.",
        misplacedHint: "DNS resolution has to happen before any request can be routed anywhere - it belongs directly under the client, first."
      },
      {
        id: "cdn",
        parentId: "dns",
        whyItFits:
          "DNS can route static-asset requests straight to a CDN edge node, which caches images/JS/CSS close to the " +
          "user and never touches your origin servers for a cache hit.",
        misplacedHint:
          "A CDN needs to intercept the request before it reaches your origin infrastructure - it hangs off DNS, in parallel with the load balancer, not behind your app servers."
      },
      {
        id: "load_balancer",
        parentId: "dns",
        whyItFits:
          "For dynamic requests, DNS points at a load balancer, which is the single stable entry point that then " +
          "spreads traffic across many interchangeable app servers.",
        misplacedHint: "The load balancer has to sit in front of the app server pool, reachable directly from DNS - not behind the servers it's supposed to distribute traffic to."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits:
          "The load balancer forwards each request to one of many identical, stateless web/app servers, which is what " +
          "lets you scale horizontally by just adding more boxes.",
        misplacedHint: "App servers only receive traffic after it's been distributed - they sit behind the load balancer, never in front of it."
      },
      {
        id: "cache",
        parentId: "web_server",
        whyItFits:
          "The app server checks a shared in-memory cache before hitting the database, so repeated reads of hot data " +
          "stay fast and the database is protected from redundant load.",
        misplacedHint: "A cache only helps if it sits between the app logic and the database, on the read path of the app server - not upstream of the load balancer."
      },
      {
        id: "sql_db",
        parentId: "web_server",
        whyItFits:
          "The app server persists and reads durable data from a relational database - the source of truth once the " +
          "cache misses.",
        misplacedHint: "The database is the durable source of truth the app server falls back to - it belongs behind the app server, not in front of the cache or load balancer."
      }
    ],
    distractorIds: ["message_queue", "websocket_gateway", "search_index", "zookeeper", "transcoding_service"],
    keyTakeaways: [
      "Separate the static-asset path (DNS -> CDN) from the dynamic-request path (DNS -> load balancer -> app servers).",
      "Stateless app servers behind a load balancer are what let you scale horizontally instead of buying a bigger box.",
      "A cache in front of the database absorbs read traffic; the database stays as the durable source of truth."
    ],
    estimationQuestions: [
      {
        id: "qps",
        prompt:
          "10 million daily active users each make about 5 requests/day. What's the average requests-per-second (QPS) your web tier must sustain?",
        unit: "requests/sec",
        placeholder: "e.g. 500",
        expectedValue: 578.7,
        tolerancePercent: 40,
        explanation:
          "10M x 5 = 50M requests/day. 50,000,000 / 86,400 seconds ~= 579 QPS on average (real traffic peaks much higher, which is exactly why you need a load balancer and multiple servers, not just one fast one)."
      },
      {
        id: "storage",
        prompt: "If each of those 50M daily requests touches a database row of about 200 bytes, roughly how much data does the database tier touch in a single day?",
        unit: "GB/day",
        placeholder: "e.g. 10",
        expectedValue: 10,
        tolerancePercent: 30,
        explanation:
          "50M rows x 200 bytes ~= 10 GB/day. Daily volume alone isn't scary - it's the read/write RATE (QPS) and hot-key contention that usually break a single-server design first."
      }
    ],
    tradeoff: {
      nodeId: "sql_db",
      prompt: "For this database tier, which storage approach fits best at this stage?",
      options: [
        {
          id: "sql",
          label: "A single relational database (Postgres/MySQL) with read replicas",
          correct: true,
          rationale:
            "At this scale a relational database with a couple of read replicas comfortably handles the load, and you get transactions and joins for free - no need to pay the operational cost of a distributed NoSQL cluster yet."
        },
        {
          id: "nosql",
          label: "A sharded NoSQL cluster from day one",
          correct: false,
          rationale:
            "Sharding is real operational overhead (rebalancing, cross-shard queries) that this traffic level doesn't justify yet - premature horizontal partitioning is a classic over-engineering trap."
        },
        {
          id: "flatfiles",
          label: "Flat files on each web server's local disk",
          correct: false,
          rationale: "Local files aren't shared across server instances and vanish if a box is replaced - nothing durable survives a restart."
        }
      ]
    },
    failureQuestions: [
      {
        id: "spike",
        prompt: "Traffic suddenly spikes to 10x normal. Which component fails first in this design?",
        options: [
          { id: "web", label: "The web servers - horizontal scaling can't keep up" },
          { id: "db", label: "The database - it's the one part of this design that doesn't scale out" },
          { id: "cdn", label: "The CDN - it can't handle sudden traffic increases" }
        ],
        correctOptionId: "db",
        explanation:
          "Web servers scale out easily behind the load balancer, and the CDN is built for spiky traffic. The single relational database has to scale up or add replicas/sharding rather than just scaling out."
      },
      {
        id: "cache-down",
        prompt: "If the cache layer goes down entirely, what's the immediate consequence?",
        options: [
          { id: "site-down", label: "The site goes down completely" },
          { id: "fallthrough", label: "Every previously-cached read now hits the database directly, which may become overloaded" },
          { id: "cdn-takes-over", label: "Nothing changes since the CDN takes over" }
        ],
        correctOptionId: "fallthrough",
        explanation:
          "A cache outage isn't fatal by itself, but every previously-cached read now falls straight through to the database - if the database wasn't sized for 100% of read traffic, this can cascade into a full outage (a 'cache stampede')."
      }
    ]
  },

  {
    id: "url-shortener",
    title: "Design a URL Shortener",
    difficulty: "medium",
    companies: ["Google", "Amazon", "Meta"],
    tags: ["API Design", "Key-Value Store", "Hashing"],
    summary: "TinyURL/bit.ly: turn long URLs into short codes and redirect billions of times a day.",
    statement:
      "Design a service like TinyURL. Given a long URL, it returns a much shorter one. Visiting the short URL " +
      "redirects the browser to the original long URL. Reads (redirects) vastly outnumber writes (new short links).",
    functionalRequirements: [
      "POST a long URL and receive a short, unique code.",
      "GET a short URL and be redirected (HTTP 301/302) to the original long URL.",
      "Short codes must not collide with an existing mapping."
    ],
    nonFunctionalRequirements: [
      "Read (redirect) traffic is orders of magnitude higher than write traffic.",
      "Redirects should be low-latency - most should be servable from memory.",
      "The system should tolerate a single database node failing without losing existing mappings."
    ],
    scaleNote: "~100M new URLs/month written, but on the order of 10:1 or higher read:write ratio for redirects.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "All API traffic - both shortening requests and redirect lookups - enters through a load balancer first.",
        misplacedHint: "Every request, read or write, needs to be distributed across app servers first - the load balancer is the first hop from the client."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits:
          "A pool of stateless API servers handles both 'shorten this URL' writes and 'redirect me' reads behind the " +
          "load balancer.",
        misplacedHint: "The application logic for both shortening and redirecting lives on the app server, which only receives traffic after the load balancer distributes it."
      },
      {
        id: "id_generator",
        parentId: "web_server",
        whyItFits:
          "On a write, the app server asks a unique ID generator (or a base62-encoded counter) for a fresh identifier " +
          "so two concurrent writes never produce the same short code.",
        misplacedHint: "Short codes are only minted during the write path, right when the app server handles a new shorten request - not on every redirect."
      },
      {
        id: "cache",
        parentId: "web_server",
        whyItFits:
          "Since redirects vastly outnumber writes, the app server checks an in-memory cache of the hottest short-code " +
          "-> long-URL mappings before ever touching the database.",
        misplacedHint: "The cache only pays off sitting right on the app server's read path, checked before the database - not before the load balancer or as a substitute for the ID generator."
      },
      {
        id: "url_mapping_db",
        parentId: "web_server",
        whyItFits:
          "The durable key-value mapping table (short code -> long URL) is the source of truth the app server writes " +
          "to and falls back to on a cache miss.",
        misplacedHint: "The mapping store is the durable source of truth behind the app server - it's what the cache is a fast-path shortcut for, not the other way around."
      }
    ],
    distractorIds: ["message_queue", "transcoding_service", "geo_service", "search_index", "websocket_gateway"],
    keyTakeaways: [
      "A read-heavy, write-light workload is the textbook case for putting a cache directly in front of the database.",
      "Uniqueness for short codes is a dedicated concern (counter/ID generator), not something the database enforces after the fact.",
      "The mapping store is a simple key-value lookup, not a relationally-joined dataset - so it scales like one."
    ],
    estimationQuestions: [
      {
        id: "write-qps",
        prompt: "At 100M new short URLs created per month, what's the average write QPS for URL creation?",
        unit: "writes/sec",
        placeholder: "e.g. 40",
        expectedValue: 38.6,
        tolerancePercent: 40,
        explanation: "100M / (30 days x 86,400 sec/day) ~= 39 writes/sec on average - tiny compared to redirect traffic, which is why this system optimizes overwhelmingly for reads."
      },
      {
        id: "read-qps",
        prompt: "If reads (redirects) outnumber writes 100:1, what's the approximate read QPS?",
        unit: "reads/sec",
        placeholder: "e.g. 3900",
        expectedValue: 3860,
        tolerancePercent: 40,
        explanation: "~39 writes/sec x 100 ~= 3,900 reads/sec. That read volume is exactly what justifies putting a cache directly in front of the database."
      }
    ],
    tradeoff: {
      nodeId: "id_generator",
      prompt: "How should short codes be generated so two concurrent writes never collide?",
      options: [
        {
          id: "counter",
          label: "A centrally-coordinated auto-increment counter, base62-encoded",
          correct: true,
          rationale:
            "A single monotonic counter (or a Snowflake-style distributed ID) guarantees uniqueness by construction - no collision checks needed, and base62-encoding a 64-bit number comfortably fits a short code."
        },
        {
          id: "random",
          label: "A purely random string with no uniqueness check",
          correct: false,
          rationale:
            "Random strings can collide as the mapping table grows - you'd need a database lookup-and-retry loop on every write, adding latency for no benefit over a counter."
        },
        {
          id: "hash",
          label: "MD5 hash of the long URL, truncated",
          correct: false,
          rationale:
            "The same long URL always maps to the same hash, breaking the case where two different users want their own private short link to the same URL."
        }
      ]
    },
    failureQuestions: [
      {
        id: "cache-down",
        prompt: "The cache layer fails completely. What happens?",
        options: [
          { id: "site-down", label: "The site goes down" },
          { id: "fallthrough", label: "Every redirect falls through to the mapping store, which may not be sized for 100% of read traffic" },
          { id: "writes-stop", label: "Writes stop working" }
        ],
        correctOptionId: "fallthrough",
        explanation: "Every previously-cached redirect now hits the durable mapping store directly - if it wasn't sized for the full read load, this can cascade into slow or failed redirects platform-wide."
      },
      {
        id: "hot-key",
        prompt: "A single link goes viral and gets 1000x its normal traffic. What's the biggest risk?",
        options: [
          { id: "id-gen", label: "The ID generator can't keep up" },
          { id: "hot-shard", label: "That one hot key overwhelms whichever single cache node/shard owns it, even though total system capacity is fine" },
          { id: "lb-crash", label: "The load balancer crashes" }
        ],
        correctOptionId: "hot-shard",
        explanation:
          "This is the classic 'hot key' problem - average system capacity might be fine, but a single ultra-hot key can bottleneck the whole redirect path unless the cache handles hot keys specially (e.g. local replication)."
      }
    ]
  },

  // ---------------------------------------------------------------------------------------
  // CORE SYSTEMS
  // ---------------------------------------------------------------------------------------
  {
    id: "rate-limiter",
    title: "Design a Rate Limiter",
    difficulty: "hard",
    companies: ["Google", "Stripe", "Amazon"],
    tags: ["Middleware", "Distributed Systems", "Reliability"],
    summary: "Throttle clients that exceed an allowed request rate, without a shared counter becoming the bottleneck.",
    statement:
      "Design a rate limiter for an API platform: each client (by API key or IP) is allowed at most N requests per " +
      "time window. Requests over the limit are rejected with a 429. The limiter itself must run across many nodes " +
      "without letting any single node be tricked by only seeing part of a client's traffic.",
    functionalRequirements: [
      "Reject requests that exceed a configurable per-client rate.",
      "Let legitimate requests under the limit pass through untouched.",
      "Rate-limit rules (which endpoints, what limits) can be updated without redeploying."
    ],
    nonFunctionalRequirements: [
      "The limiter must work correctly even when requests for the same client land on different servers.",
      "Checking the limit must add minimal latency to every single request.",
      "The limiting layer should fail open or gracefully degrade rather than take down the whole API."
    ],
    scaleNote: "Millions of requests per second across the platform, spread across many rate-limiter instances.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "Every inbound API request is distributed across rate-limiter instances by a load balancer first.",
        misplacedHint: "Requests need to be spread across many rate-limiter instances before anything else happens - the load balancer is the first hop."
      },
      {
        id: "rate_limiter_service",
        parentId: "load_balancer",
        whyItFits:
          "The rate-limiter middleware sits right after the load balancer and decides, per request, whether the " +
          "client is still within its allowance before anything reaches the real API.",
        misplacedHint: "The limiter has to inspect every request before it reaches application logic - it sits directly behind the load balancer, in front of the app servers."
      },
      {
        id: "counter_store",
        parentId: "rate_limiter_service",
        whyItFits:
          "A shared, fast counter store (e.g. Redis with atomic INCR + TTL, implementing a sliding-window or " +
          "token-bucket counter) is what lets every rate-limiter instance agree on one client's true request count.",
        misplacedHint: "The counter has to be shared across every rate-limiter instance to work correctly - it hangs directly off the rate-limiter service, not off the app servers it protects."
      },
      {
        id: "zookeeper",
        parentId: "rate_limiter_service",
        whyItFits:
          "Rate-limiting rules (which endpoints, what thresholds) are kept in a small coordination/config store that " +
          "every rate-limiter instance watches, so a rule change propagates everywhere without a redeploy.",
        misplacedHint: "Rule/config distribution is a concern of the rate-limiter layer itself, not of the app servers or the counter store that only tracks request counts."
      },
      {
        id: "web_server",
        parentId: "rate_limiter_service",
        whyItFits:
          "Once a request is confirmed to be within limits, the rate limiter forwards it on to the actual application " +
          "servers to be handled normally.",
        misplacedHint: "App servers should only ever see traffic that already passed the limiter - they sit behind it, never in front."
      }
    ],
    distractorIds: ["cdn", "object_storage", "search_index", "transcoding_service", "graph_store"],
    keyTakeaways: [
      "A rate limiter is middleware: it sits in the request path before the real application logic runs.",
      "Distributed rate limiting needs a shared counter (not per-instance memory), or clients can bypass the limit by hitting different servers.",
      "Separate 'how many requests has this client made' (counter store) from 'what are the rules' (config/coordination) - they change at very different rates."
    ],
    estimationQuestions: [
      {
        id: "latency-budget",
        prompt:
          "A request normally takes 20ms. If the rate-limiter check must add no more than 5% latency overhead, what's the max acceptable latency for a single limiter check?",
        unit: "ms",
        placeholder: "e.g. 1",
        expectedValue: 1,
        tolerancePercent: 40,
        explanation: "5% of 20ms = 1ms - which is why the counter store has to be an in-memory store like Redis, not a query to the main relational database."
      },
      {
        id: "counter-nodes",
        prompt:
          "The platform handles 500,000 requests/sec, and a single counter-store node can sustain 100,000 atomic increments/sec. How many counter-store nodes are needed at minimum for throughput?",
        unit: "nodes",
        placeholder: "e.g. 5",
        expectedValue: 5,
        tolerancePercent: 30,
        explanation: "500,000 / 100,000 = 5 nodes minimum just for raw throughput - in practice you'd run more for redundancy and to avoid hotspots."
      }
    ],
    tradeoff: {
      nodeId: "counter_store",
      prompt: "Which rate-limiting algorithm should the counter store implement?",
      options: [
        {
          id: "sliding",
          label: "Sliding window counter (Redis sorted set or two blended fixed windows)",
          correct: true,
          rationale:
            "A sliding window smooths out the 'burst at window boundary' problem of fixed windows while staying cheap to compute - the standard real-world choice for API rate limiting."
        },
        {
          id: "fixed",
          label: "A simple fixed window counter that resets every minute",
          correct: false,
          rationale: "Fixed windows allow a client to send up to 2x the limit right at the window boundary - a well-known correctness gap."
        },
        {
          id: "none",
          label: "No counting at all - just block IPs that look automated",
          correct: false,
          rationale: "Heuristic IP blocking doesn't enforce a precise per-client rate and is trivially bypassed by rotating IPs - it solves abuse detection, not rate limiting."
        }
      ]
    },
    failureQuestions: [
      {
        id: "store-down",
        prompt: "The counter store (Redis) becomes unavailable. What should the rate limiter do?",
        options: [
          { id: "reject-all", label: "Reject all requests until it's back" },
          { id: "fail-open", label: "Fail open - let requests through so a limiter outage doesn't take down the whole API" },
          { id: "crash", label: "Crash the whole platform" }
        ],
        correctOptionId: "fail-open",
        explanation:
          "A rate limiter is a protective layer, not the product itself - failing open avoids turning a minor limiter outage into a total platform outage, accepting brief abuse risk in exchange for availability."
      },
      {
        id: "bottleneck",
        prompt: "At 10x normal traffic, which part of this design is most likely to become the bottleneck?",
        options: [
          { id: "counter", label: "The counter store, since every request needs an atomic increment against it" },
          { id: "lb", label: "The load balancer" },
          { id: "zk", label: "The coordination service, since it's rarely written to" }
        ],
        correctOptionId: "counter",
        explanation:
          "Every request needs a counter check, so the counter store's throughput sets a hard ceiling on the whole platform - exactly why it needs to be in-memory and horizontally shardable."
      }
    ]
  },

  {
    id: "unique-id-generator",
    title: "Design a Unique ID Generator in Distributed Systems",
    difficulty: "hard",
    companies: ["Twitter", "Instagram", "Google"],
    tags: ["Distributed Systems", "Coordination"],
    summary: "Hand out IDs that are unique, roughly sortable by time, across many machines with no shared clock.",
    statement:
      "Many services (like Twitter's tweet IDs) need to generate unique, roughly time-ordered 64-bit IDs across a " +
      "fleet of machines, with no central database round-trip on the hot path. Design the ID-generation service " +
      "(a Snowflake-style approach: timestamp + machine ID + sequence number, bit-packed into one integer).",
    functionalRequirements: [
      "Every generated ID is globally unique.",
      "IDs are roughly sortable by creation time.",
      "The system can generate many thousands of IDs per second per machine with no network round-trip."
    ],
    nonFunctionalRequirements: [
      "No single point of failure - any generator node can mint IDs independently.",
      "IDs fit in 64 bits so they're cheap to index and compare.",
      "Adding more generator machines shouldn't risk ID collisions."
    ],
    scaleNote: "10,000+ IDs/sec per node, fully in-process - a database sequence would be far too slow at this rate.",
    rootComponentId: "client",
    nodes: [
      {
        id: "web_server",
        parentId: null,
        whyItFits:
          "The application server that needs a new ID (e.g. to tag a new post) is the first thing the client's " +
          "request reaches.",
        misplacedHint: "Something has to receive the client's request before it can ask for an ID - the app server is that first hop."
      },
      {
        id: "id_generator",
        parentId: "web_server",
        whyItFits:
          "The app server asks an embedded/local ID-generation component (timestamp bits + machine-ID bits + a local " +
          "sequence counter, Snowflake-style) for a fresh ID - entirely in-process, no network call needed per ID.",
        misplacedHint: "ID generation happens on demand, right when the app server needs one - it's a direct child of the app server, not something requests reach before the app server."
      },
      {
        id: "zookeeper",
        parentId: "id_generator",
        whyItFits:
          "Each generator node needs a unique machine ID so two nodes never stamp the same bits into an ID; a small " +
          "coordination service assigns and tracks those machine IDs on startup.",
        misplacedHint: "Machine-ID assignment is a one-time coordination step for the ID generator itself, not something the app server or client talks to directly."
      },
      {
        id: "cache",
        parentId: "id_generator",
        whyItFits:
          "To avoid renegotiating a sequence range constantly, generators can pre-fetch and cache a block of reserved " +
          "sequence numbers, only re-coordinating once the block is exhausted.",
        misplacedHint: "Sequence-block caching is an internal optimization of the ID generator, sitting under it - not a general-purpose app cache in front of a database."
      }
    ],
    distractorIds: ["message_queue", "cdn", "object_storage", "search_index", "graph_store"],
    keyTakeaways: [
      "Snowflake-style IDs pack timestamp + machine ID + sequence into one integer so no network call is needed per ID.",
      "Coordination (assigning machine IDs) is a rare, one-time cost - not something on the hot path of every request.",
      "This is a deliberately small, focused service - not every design needs a wide, deep tree."
    ],
    estimationQuestions: [
      {
        id: "seq-bits",
        prompt:
          "A Snowflake-style ID packs a 41-bit timestamp (ms), a 10-bit machine ID, and a 12-bit sequence number into 64 bits. What's the max number of unique IDs a single machine can generate in one millisecond?",
        unit: "IDs/ms",
        placeholder: "e.g. 4096",
        expectedValue: 4096,
        tolerancePercent: 5,
        explanation: "12 sequence bits = 2^12 = 4,096 possible values per millisecond per machine - once exhausted, the generator waits for the next millisecond tick."
      },
      {
        id: "machine-bits",
        prompt: "With a 10-bit machine ID field, what's the maximum number of ID-generator machines that can run concurrently without collision?",
        unit: "machines",
        placeholder: "e.g. 1024",
        expectedValue: 1024,
        tolerancePercent: 5,
        explanation: "10 bits = 2^10 = 1,024 distinct machine IDs - the coordination service's only real job is making sure no two live machines share one of those 1,024 slots."
      }
    ],
    tradeoff: {
      nodeId: "id_generator",
      prompt: "How should IDs actually be constructed?",
      options: [
        {
          id: "snowflake",
          label: "Bit-packed timestamp + machine ID + sequence number (Snowflake-style)",
          correct: true,
          rationale: "Zero network calls per ID (fully in-process) and roughly sortable by time - exactly what a high-throughput, low-latency ID service needs."
        },
        {
          id: "db",
          label: "A single database auto-increment column",
          correct: false,
          rationale: "Every ID request becomes a network round-trip and a write to one database row - unworkable at tens of thousands of IDs/sec per node."
        },
        {
          id: "uuid",
          label: "Random UUIDv4 for every ID",
          correct: false,
          rationale: "Unique, but not sortable by creation time at all - breaks any use case (like this one) that needs IDs roughly ordered for indexing or pagination."
        }
      ]
    },
    failureQuestions: [
      {
        id: "coordination-down",
        prompt: "The coordination service (machine-ID assignment) goes down. What's the immediate impact?",
        options: [
          { id: "new-only", label: "Existing generator machines keep minting IDs fine; only NEW machines can't safely start up and grab a machine ID" },
          { id: "all-halt", label: "All ID generation halts immediately everywhere" },
          { id: "invalid", label: "Old IDs become invalid" }
        ],
        correctOptionId: "new-only",
        explanation: "Machine-ID assignment is a rare, one-time coordination step - once a machine has its ID it never asks again, so an outage only blocks new machines from joining."
      },
      {
        id: "partition",
        prompt: "Two datacenters briefly lose network connectivity to each other, but each is still internally healthy. What happens to ID generation?",
        options: [
          { id: "both-stop", label: "Both sides stop generating IDs entirely" },
          { id: "both-continue", label: "Each side keeps generating unique IDs independently, since machine IDs were already assigned before the partition" },
          { id: "collide", label: "IDs start colliding immediately" }
        ],
        correctOptionId: "both-continue",
        explanation:
          "Because machine IDs are assigned once and baked into every generated ID, a temporary network partition doesn't cause collisions - both sides keep working correctly with the IDs they already hold."
      }
    ]
  },

  {
    id: "key-value-store",
    title: "Design a Key-Value Store",
    difficulty: "hard",
    companies: ["Amazon", "Google"],
    tags: ["Distributed Systems", "Replication", "Partitioning"],
    summary: "A Dynamo-style, horizontally partitioned and replicated store that stays available during node failures.",
    statement:
      "Design a distributed key-value store (Dynamo/Cassandra-style) that partitions data across many nodes, " +
      "replicates each key for fault tolerance, and stays available for reads and writes even while some nodes are " +
      "down or unreachable.",
    functionalRequirements: [
      "put(key, value) and get(key) with predictable latency.",
      "Data survives the loss of any single node via replication.",
      "The cluster can grow by adding nodes without a full manual re-shard."
    ],
    nonFunctionalRequirements: [
      "Prefer availability over strict consistency during network partitions (AP over CP).",
      "Reads of hot keys should be servable from memory, not disk, most of the time.",
      "Cluster membership changes should be detected and propagated automatically."
    ],
    scaleNote: "Petabyte-scale datasets partitioned via consistent hashing across hundreds of nodes.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "Client requests first hit a load balancer that can route to any coordinator node in the cluster.",
        misplacedHint: "Any client should be able to reach any coordinator node - that routing job is the load balancer's, right at the front door."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits:
          "A coordinator node accepts the request and figures out (via consistent hashing) which storage nodes are " +
          "actually responsible for that key.",
        misplacedHint: "Something needs to translate 'get(key)' into 'which storage nodes own this key' - that's the coordinator's job, sitting right behind the load balancer."
      },
      {
        id: "zookeeper",
        parentId: "web_server",
        whyItFits:
          "The coordinator consults a cluster-membership/partition-map service so it knows which nodes are currently " +
          "up and which partitions they own, even as nodes join or leave.",
        misplacedHint: "Cluster membership and partition ownership is metadata the coordinator needs before it can route anything - it's a direct dependency of the coordinator, not of the storage nodes themselves."
      },
      {
        id: "cache",
        parentId: "web_server",
        whyItFits:
          "The coordinator checks an in-memory cache for hot keys first, since re-reading the same popular key from " +
          "disk on every request would be wasteful.",
        misplacedHint: "The cache is a fast-path shortcut sitting on the coordinator's read path, in front of the actual storage nodes - not a replacement for them."
      },
      {
        id: "nosql_db",
        parentId: "web_server",
        whyItFits:
          "The actual partitioned, replicated storage nodes are where data durably lives - the coordinator writes to " +
          "(and reads from, on a cache miss) several replicas of each key.",
        misplacedHint: "The storage nodes are the durable layer the coordinator talks to after checking the cache and consulting membership - they don't sit in front of the coordinator."
      },
      {
        id: "object_storage",
        parentId: "nosql_db",
        whyItFits:
          "Each storage node periodically flushes its in-memory write buffer to immutable, sorted files on durable " +
          "disk/blob storage (an SSTable-style approach), which is what survives a node restart.",
        misplacedHint: "This on-disk persistence layer is internal to each storage node - it's what the storage node flushes to, not something the coordinator or cache talks to directly."
      }
    ],
    distractorIds: ["cdn", "message_queue", "transcoding_service", "geo_service", "notification_dispatcher"],
    keyTakeaways: [
      "Consistent hashing plus replication is what lets the cluster tolerate node failure without losing data or a full re-shard.",
      "A coordinator layer decouples 'which node do I talk to' from the client, so cluster topology can change freely.",
      "In-memory structures (cache, write buffers) are only ever a fast path in front of an on-disk durable layer."
    ],
    estimationQuestions: [
      {
        id: "replication-storage",
        prompt: "With 3-way replication, how much total storage do you need to durably store 10 TB of unique data?",
        unit: "TB",
        placeholder: "e.g. 30",
        expectedValue: 30,
        tolerancePercent: 10,
        explanation: "3-way replication means each byte of unique data lives on 3 different nodes: 10 TB x 3 = 30 TB of total storage."
      },
      {
        id: "node-count",
        prompt: "If a single storage node can reliably hold 2 TB before performance degrades, how many storage nodes do you need at minimum to hold that 30 TB of replicated data?",
        unit: "nodes",
        placeholder: "e.g. 15",
        expectedValue: 15,
        tolerancePercent: 20,
        explanation: "30 TB total / 2 TB per node = 15 nodes minimum, before accounting for growth headroom or uneven data distribution."
      }
    ],
    tradeoff: {
      nodeId: "nosql_db",
      prompt: "What consistency model should reads/writes use across replicas?",
      options: [
        {
          id: "eventual",
          label: "Eventual consistency with quorum reads/writes (W + R > N)",
          correct: true,
          rationale:
            "The standard Dynamo-style tradeoff: choosing availability and partition tolerance over strict consistency, while quorum reads/writes still give a tunable consistency guarantee."
        },
        {
          id: "strict",
          label: "Strict consistency - every write must be confirmed by all replicas before acknowledging",
          correct: false,
          rationale: "Waiting on every replica means the whole write fails the moment just one is slow or unreachable - directly contradicting 'stay available during node failures'."
        },
        {
          id: "none",
          label: "No replication guarantees at all - just best-effort async copies",
          correct: false,
          rationale: "Without a quorum or acknowledgment guarantee, a client has no way to know whether a write actually persisted anywhere durable before the node it hit crashes."
        }
      ]
    },
    failureQuestions: [
      {
        id: "node-crash",
        prompt: "One storage node crashes and stays down for an hour. What happens to the data it held?",
        options: [
          { id: "lost", label: "That data is permanently lost" },
          { id: "still-available", label: "The data is still available and durable because it was replicated onto other nodes" },
          { id: "all-writes-stop", label: "All writes stop platform-wide" }
        ],
        correctOptionId: "still-available",
        explanation: "As long as enough replicas of a key survive, the data and availability for that key are unaffected by any single node's failure - that's what replication buys you."
      },
      {
        id: "hot-key",
        prompt: "A single key becomes extremely hot (way more reads than any other key). What's the risk?",
        options: [
          { id: "none", label: "None, since data is partitioned across many nodes" },
          { id: "hot-nodes", label: "The small number of nodes holding that key's replicas become overloaded even though the cluster overall has spare capacity" },
          { id: "inconsistent", label: "The whole cluster becomes inconsistent" }
        ],
        correctOptionId: "hot-nodes",
        explanation:
          "Partitioning spreads out different KEYS, not one key's traffic - a very hot key still funnels all its reads to the same handful of replica nodes, a separate concern from normal partitioning."
      }
    ]
  },

  {
    id: "web-crawler",
    title: "Design a Web Crawler",
    difficulty: "hard",
    companies: ["Google", "Amazon"],
    tags: ["Distributed Systems", "Queues"],
    summary: "Crawl billions of pages, avoid re-crawling the same URL forever, and store what you find.",
    statement:
      "Design a web crawler that starts from a set of seed URLs, follows links it discovers, and stores page content " +
      "and metadata - at the scale of billions of pages - without getting stuck re-crawling the same URLs endlessly.",
    functionalRequirements: [
      "Start from seed URLs and continuously discover + fetch new links.",
      "Never crawl the same URL twice within a given time window.",
      "Store fetched page content and extracted metadata (links, title, timestamp)."
    ],
    nonFunctionalRequirements: [
      "Scalable and extensible - new content types (PDF, images) should be addable later.",
      "Politeness: don't hammer any single host with too many concurrent requests.",
      "Robust to crawler traps (infinite link loops, dynamically generated URLs)."
    ],
    scaleNote: "1 billion pages/month, distributed across a large pool of crawler workers.",
    rootComponentId: "client",
    nodes: [
      {
        id: "web_server",
        parentId: null,
        whyItFits: "An operator/API kicks the crawl off (seed URLs in) and later queries results - handled by the crawler's coordinator service.",
        misplacedHint: "Seed URLs and crawl status queries need a coordinating service to land on first - that's the direct child of the client here."
      },
      {
        id: "frontier_queue",
        parentId: "web_server",
        whyItFits:
          "The coordinator pushes seed and newly-discovered URLs into a prioritized URL frontier - the queue of " +
          "'what to crawl next', which naturally throttles how fast any one host gets hit.",
        misplacedHint: "URLs need somewhere to wait their turn before a worker fetches them - the frontier is a queue fed by the coordinator, not something workers push into after the fact."
      },
      {
        id: "crawler_workers",
        parentId: "frontier_queue",
        whyItFits:
          "A large pool of workers pulls URLs off the frontier, fetches the page, and parses out new links to feed " +
          "back into the frontier.",
        misplacedHint: "Workers only ever pull their next URL from the frontier queue - they don't sit upstream of it or take work directly from the coordinator."
      },
      {
        id: "bloom_filter",
        parentId: "crawler_workers",
        whyItFits:
          "Before fetching, a worker checks a bloom filter of already-seen URLs - a compact probabilistic check that " +
          "avoids re-crawling the same page and avoids most crawler-trap loops.",
        misplacedHint: "Dedup has to happen right at fetch time, per worker, before the request goes out - it's a direct dependency of the workers, not of the frontier queue itself."
      },
      {
        id: "object_storage",
        parentId: "crawler_workers",
        whyItFits: "Once fetched, the raw page content (HTML, and later other content types) is written to durable blob storage.",
        misplacedHint: "Raw page bytes are written by the worker that just fetched them - storage is a direct child of the workers, not of the coordinator."
      },
      {
        id: "nosql_db",
        parentId: "crawler_workers",
        whyItFits:
          "Extracted metadata (outgoing links, title, crawl timestamp) is written to a horizontally-scalable store " +
          "that the frontier and future crawls can query.",
        misplacedHint: "Parsed metadata comes out of the worker's parsing step - it's a direct child of the workers, alongside raw content storage, not upstream of them."
      }
    ],
    distractorIds: ["cdn", "websocket_gateway", "payment_processor", "id_generator", "rate_limiter_service"],
    keyTakeaways: [
      "The URL frontier is what turns 'crawl the whole web' into a manageable, prioritized, polite queue.",
      "A bloom filter is the cheap first line of defense against re-crawling and infinite link loops, before touching real storage.",
      "Raw content and parsed metadata are stored separately because they're accessed very differently (bytes vs. queryable fields)."
    ],
    estimationQuestions: [
      {
        id: "crawl-rate",
        prompt: "To crawl 1 billion pages per month, what's the average crawl rate needed?",
        unit: "pages/sec",
        placeholder: "e.g. 385",
        expectedValue: 385.8,
        tolerancePercent: 40,
        explanation: "1,000,000,000 / (30 x 86,400) ~= 386 pages/sec sustained, averaged across the whole worker pool."
      },
      {
        id: "raw-storage",
        prompt: "If each fetched page averages 100 KB of raw HTML, how much raw storage does a full month of crawling consume?",
        unit: "TB/month",
        placeholder: "e.g. 100",
        expectedValue: 100,
        tolerancePercent: 20,
        explanation: "1 billion pages x 100 KB ~= 100 TB of raw HTML per month - why raw content goes straight to cheap object storage rather than a relational database."
      }
    ],
    tradeoff: {
      nodeId: "bloom_filter",
      prompt: "How should the crawler avoid re-fetching URLs it has already seen?",
      options: [
        {
          id: "bloom",
          label: "A bloom filter - compact, probabilistic, fast to check",
          correct: true,
          rationale:
            "At billions of URLs, an exact set would need enormous memory; a bloom filter trades a small false-positive rate for a huge memory savings - an acceptable tradeoff for a crawler."
        },
        {
          id: "exact-db",
          label: "An exact lookup against the full URL database on every fetch",
          correct: false,
          rationale: "A database round-trip per candidate URL, at crawler scale, would make the dedup check itself the bottleneck long before the network fetch does."
        },
        {
          id: "none",
          label: "Don't bother deduping - just re-crawl and overwrite",
          correct: false,
          rationale: "Without dedup, the crawler wastes most of its fetch budget re-crawling pages it already has, and can spiral into infinite loops on crawler traps."
        }
      ]
    },
    failureQuestions: [
      {
        id: "false-positive",
        prompt: "The bloom filter's false-positive rate is higher than expected. What's the actual consequence?",
        options: [
          { id: "crash", label: "The crawler crashes" },
          { id: "missed-pages", label: "Some genuinely-new URLs get incorrectly skipped as 'already seen', so the crawler misses some pages" },
          { id: "infinite-dup", label: "Duplicate pages get crawled infinitely" }
        ],
        correctOptionId: "missed-pages",
        explanation:
          "A bloom filter's false positives only ever say 'seen it' about something new (a missed page) - it never wrongly says 'never seen it' about something it has, so the failure mode is under-crawling."
      },
      {
        id: "crawler-trap",
        prompt: "One misbehaving website generates an effectively infinite number of unique-looking URLs (a crawler trap). What protects the rest of the crawl?",
        options: [
          { id: "nothing", label: "Nothing - the whole crawl gets stuck forever" },
          { id: "politeness", label: "Per-host politeness/fairness limits in the frontier queue keep any one host from consuming the whole worker pool's attention" },
          { id: "storage-full", label: "Object storage runs out of space and stops everything" }
        ],
        correctOptionId: "politeness",
        explanation: "The frontier queue's per-host scheduling is what contains a single bad host's blowup - it keeps getting its fair, capped share of worker attention instead of starving every other site."
      }
    ]
  },

  {
    id: "notification-system",
    title: "Design a Notification System",
    difficulty: "hard",
    companies: ["Meta", "Uber", "Amazon"],
    tags: ["Messaging", "Fan-out"],
    summary: "Send push, SMS, and email notifications reliably at scale without blocking the request that triggered them.",
    statement:
      "Design a notification system that can send push notifications, SMS, and email, triggered by internal events " +
      "(e.g. 'order shipped'). The service that triggers a notification shouldn't have to wait on slow third-party " +
      "providers, and a burst of events shouldn't overwhelm any single provider.",
    functionalRequirements: [
      "Accept a notification request (user, channel, template/content) from internal services.",
      "Deliver via the right channel: push, SMS, or email.",
      "Record delivery status and respect user notification preferences."
    ],
    nonFunctionalRequirements: [
      "The triggering service must not block waiting on third-party delivery.",
      "Retries and backoff when a provider is briefly unavailable.",
      "High throughput bursts (e.g. millions of notifications for a single event) shouldn't overwhelm providers."
    ],
    scaleNote: "Bursts of 10M+ notifications within minutes for large broadcast events.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits:
          "Internal services call a single notification API gateway to request a notification be sent - this is the " +
          "entry point for the whole system.",
        misplacedHint: "The request to send a notification needs one stable entry point first - that's the API gateway, directly reached by the caller."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits:
          "The notification service validates the request, checks user preferences, and decides how to route it - " +
          "then hands off delivery instead of doing it inline.",
        misplacedHint: "Validation and routing logic lives in the notification service itself, right behind the gateway - not after the queue."
      },
      {
        id: "sql_db",
        parentId: "web_server",
        whyItFits:
          "User notification preferences and delivery-status records are read and written by the notification " +
          "service.",
        misplacedHint: "Preferences and delivery history are queried by the notification service directly - this store is a direct dependency of that service, not of the queue or dispatcher."
      },
      {
        id: "message_queue",
        parentId: "web_server",
        whyItFits:
          "Instead of calling providers synchronously, the notification service just enqueues the job - this is what " +
          "decouples the triggering request from slow, unreliable third-party APIs and absorbs bursts.",
        misplacedHint: "Queueing has to happen right after the service decides to send something, before any provider is contacted - it's a direct child of the notification service."
      },
      {
        id: "notification_dispatcher",
        parentId: "message_queue",
        whyItFits:
          "Worker processes consume the queue and fan each job out to the correct channel (push/SMS/email), handling " +
          "retries and backoff independently per provider.",
        misplacedHint: "Dispatch workers only ever pull jobs off the queue - they don't sit upstream of it or take requests directly from the API."
      },
      {
        id: "third_party_gateway",
        parentId: "notification_dispatcher",
        whyItFits:
          "The dispatcher finally calls out to the actual external provider (APNs/FCM for push, Twilio for SMS, an " +
          "email API) to deliver the message.",
        misplacedHint: "External providers are only ever called by the dispatcher, as the very last step - nothing else in the system talks to them directly."
      }
    ],
    distractorIds: ["cdn", "search_index", "geo_service", "transcoding_service", "graph_store"],
    keyTakeaways: [
      "A queue between 'decide to notify' and 'actually deliver' is what keeps the triggering request fast and absorbs bursts.",
      "Per-channel dispatch workers isolate a slow/broken SMS provider from push and email still working fine.",
      "Preferences and delivery status live in a normal database - only the fan-out/delivery step needs async infrastructure."
    ],
    estimationQuestions: [
      {
        id: "burst-rate",
        prompt: "A single marketing broadcast needs to notify 10 million users within 5 minutes. What's the required dispatch throughput?",
        unit: "notifications/sec",
        placeholder: "e.g. 33000",
        expectedValue: 33333,
        tolerancePercent: 30,
        explanation:
          "10,000,000 / 300 seconds ~= 33,333 notifications/sec - a burst rate the dispatcher workers need to absorb, which is why the queue sits between 'decide to notify' and 'actually deliver'."
      },
      {
        id: "drain-time",
        prompt: "If the SMS provider can only accept 2,000 requests/sec, how many seconds will it take to drain a queued backlog of 10 million SMS notifications?",
        unit: "seconds",
        placeholder: "e.g. 5000",
        expectedValue: 5000,
        tolerancePercent: 20,
        explanation: "10,000,000 / 2,000 per sec = 5,000 seconds (~83 minutes) - the queue absorbs the burst while delivery drains at whatever rate the slowest provider allows."
      }
    ],
    tradeoff: {
      nodeId: "message_queue",
      prompt: "What should happen to a notification job if the target provider (e.g. SMS) is temporarily down?",
      options: [
        {
          id: "retry",
          label: "Leave it on the queue and retry with exponential backoff",
          correct: true,
          rationale: "Providers have brief outages; retrying with backoff (rather than dropping the job) is what makes 'eventually delivered' possible without hammering a struggling provider."
        },
        {
          id: "drop",
          label: "Drop the notification immediately so the queue doesn't back up",
          correct: false,
          rationale: "Silently dropping notifications means users never find out about things they were supposed to be told - unacceptable for a security alert or order confirmation."
        },
        {
          id: "block",
          label: "Block the entire queue until that one provider recovers",
          correct: false,
          rationale: "Blocking the whole queue lets one slow provider stall delivery for every other channel too - channels should fail independently."
        }
      ]
    },
    failureQuestions: [
      {
        id: "email-outage",
        prompt: "The email provider has an extended outage. What's the impact on push and SMS notifications, in a well-designed system?",
        options: [
          { id: "all-down", label: "All channels stop working" },
          { id: "independent", label: "Push and SMS continue delivering normally since each channel's dispatch is independent" },
          { id: "crash", label: "The whole notification system crashes" }
        ],
        correctOptionId: "independent",
        explanation: "Per-channel dispatch workers, each pulling from their own path off the queue, isolate one broken provider from the others."
      },
      {
        id: "no-queue",
        prompt: "At 10x normal traffic (a viral event triggers millions of notifications at once), what breaks first if there were no queue at all?",
        options: [
          { id: "nothing", label: "Nothing, direct calls would scale fine" },
          { id: "triggering-blocks", label: "The app servers handling the original request would block/timeout waiting on slow third-party APIs, so the triggering feature itself hangs" },
          { id: "db-full", label: "The database would run out of storage" }
        ],
        correctOptionId: "triggering-blocks",
        explanation: "Without a queue, the service that triggers a notification makes synchronous calls to slow, rate-limited external providers - a burst makes the ORIGINAL request slow or fail, not just the notification."
      }
    ]
  },

  {
    id: "news-feed",
    title: "Design a News Feed System",
    difficulty: "hard",
    companies: ["Meta", "Twitter"],
    tags: ["Fan-out", "Social Graph"],
    summary: "Publish a post once, then make it show up instantly in every follower's feed.",
    statement:
      "Design a news feed system (Facebook/Twitter-style): a user publishes a post, and it should appear near-instantly " +
      "in the feed of everyone who follows them, even for users who follow millions of people or are followed by " +
      "millions of people.",
    functionalRequirements: [
      "Publish a new post from a user.",
      "Retrieve a ranked, paginated feed for any user, mixing posts from everyone they follow.",
      "New posts propagate to followers' feeds quickly."
    ],
    nonFunctionalRequirements: [
      "Feed reads must be fast (most users read far more than they post - read-heavy).",
      "Celebrity accounts with huge follower counts shouldn't blow up publish latency.",
      "High availability - a slow feed is almost as bad as a broken one."
    ],
    scaleNote: "Fan-out-on-write for typical users; fan-out-on-read for celebrity accounts with huge follower graphs.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "Both publish and feed-read requests enter through a load balancer distributing across app servers.",
        misplacedHint: "Every request, whether it's publishing a post or reading a feed, needs to be distributed first - that's the load balancer's job, first in line."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits:
          "The app server handles both the publish API (new post) and the feed-read API, and decides how to fan a " +
          "new post out.",
        misplacedHint: "Both publishing and reading logic live on the app server, right behind the load balancer - not behind the graph store or queue."
      },
      {
        id: "nosql_db",
        parentId: "web_server",
        whyItFits:
          "The post itself (content, media references, timestamp) is written once to a horizontally-scalable store - " +
          "the source of truth for post content.",
        misplacedHint: "Post content is written directly by the app server handling the publish request - this store is a direct dependency of that server, not of the queue or fan-out worker."
      },
      {
        id: "graph_store",
        parentId: "web_server",
        whyItFits:
          "To know who to fan a new post out to (or who to pull posts from, for a feed read), the app server queries " +
          "the follower/following social graph.",
        misplacedHint: "Follower/following lookups are a direct dependency of the app server deciding fan-out or feed composition - not something the queue or cache consults."
      },
      {
        id: "message_queue",
        parentId: "web_server",
        whyItFits:
          "Rather than writing to every follower's feed synchronously, the app server enqueues a fan-out job - " +
          "keeping the publish request itself fast even for popular accounts.",
        misplacedHint: "Fan-out is queued right after the app server accepts a new post, before any follower's feed is touched - it's a direct child of the app server."
      },
      {
        id: "worker",
        parentId: "message_queue",
        whyItFits:
          "A pool of fan-out workers consumes the queue and pushes the new post into each follower's precomputed " +
          "feed - this is the 'fan-out-on-write' step.",
        misplacedHint: "Fan-out workers only ever pull jobs from the queue - they don't sit upstream of it or write to feeds before a job is enqueued."
      },
      {
        id: "cache",
        parentId: "worker",
        whyItFits:
          "Each user's precomputed feed (a ranked list of post IDs) is written here by fan-out workers and read " +
          "directly by app servers when a user opens their feed - avoiding an expensive real-time join at read time.",
        misplacedHint: "The precomputed feed cache is populated by fan-out workers as posts arrive - it isn't something written directly by the app server or read straight from the post store."
      }
    ],
    distractorIds: ["cdn", "transcoding_service", "id_generator", "payment_processor", "rate_limiter_service"],
    keyTakeaways: [
      "Fan-out-on-write trades extra work at publish time for near-instant, cheap reads - the right call for a read-heavy feed.",
      "The social graph and the post content are different data shapes with different access patterns, so they live in different stores.",
      "A precomputed per-user feed cache is what lets a feed read skip an expensive real-time fan-in join."
    ],
    estimationQuestions: [
      {
        id: "fanout-writes",
        prompt: "A user with 1 million followers posts once. Using fan-out-on-write, how many individual feed-cache writes does that one post trigger?",
        unit: "writes",
        placeholder: "e.g. 1000000",
        expectedValue: 1000000,
        tolerancePercent: 5,
        explanation: "Fan-out-on-write means one post write becomes one feed-cache update PER follower - 1 million followers = 1 million writes for a single post."
      },
      {
        id: "read-qps",
        prompt: "50 million daily active users each check their feed 10 times a day. What's the average feed-read QPS?",
        unit: "reads/sec",
        placeholder: "e.g. 5800",
        expectedValue: 5787,
        tolerancePercent: 40,
        explanation: "50,000,000 x 10 / 86,400 ~= 5,787 reads/sec on average - this read volume is why a precomputed feed cache matters so much here."
      }
    ],
    tradeoff: {
      nodeId: "message_queue",
      prompt: "How should a new post reach every follower's feed?",
      options: [
        {
          id: "async",
          label: "Enqueue an async fan-out job; workers update each follower's feed cache",
          correct: true,
          rationale: "Keeps the publish request fast regardless of whether the poster has 10 followers or 10 million - the potentially-slow fan-out happens off the request path."
        },
        {
          id: "sync",
          label: "Update every follower's feed cache synchronously before responding to the post request",
          correct: false,
          rationale: "A popular account's post would make the publish request take as long as updating a million cache entries - unacceptable latency."
        },
        {
          id: "none",
          label: "Don't precompute feeds at all - build each feed live from scratch on every read",
          correct: false,
          rationale: "With reads far outnumbering posts, recomputing a fan-in join from the whole social graph on every read would be far more expensive overall than fanning out once per post."
        }
      ]
    },
    failureQuestions: [
      {
        id: "celebrity",
        prompt: "A celebrity with 50 million followers posts. Using pure fan-out-on-write, what's the risk?",
        options: [
          { id: "no-risk", label: "No risk, fan-out-on-write always scales fine" },
          { id: "huge-job", label: "Fan-out for that one post alone becomes an enormous, slow job that can lag behind real-time and overload the workers" },
          { id: "post-fails", label: "The post itself fails to save" }
        ],
        correctOptionId: "huge-job",
        explanation:
          "This is exactly why real systems use a hybrid: fan-out-on-write for typical users, but fan-out-on-read for accounts with huge follower counts, capping the worst-case fan-out size."
      },
      {
        id: "cache-wipe",
        prompt: "The feed cache is wiped (e.g. a cluster restart). What's the immediate user-facing impact?",
        options: [
          { id: "permanent-loss", label: "Permanent data loss - posts are gone forever" },
          { id: "rebuild", label: "No data loss (posts still live in the durable post store), but feeds have to be rebuilt, so there may be a temporary lag" },
          { id: "graph-corrupt", label: "The whole social graph is corrupted" }
        ],
        correctOptionId: "rebuild",
        explanation: "The feed cache is a derived, rebuildable view - posts and the social graph are the durable sources of truth, so a cache wipe is a performance blip, not a data-loss event."
      }
    ]
  },

  {
    id: "chat-system",
    title: "Design a Chat System",
    difficulty: "hard",
    companies: ["Meta", "Google"],
    tags: ["Real-time", "WebSockets"],
    summary: "WhatsApp/Messenger-style 1:1 and group chat with instant delivery and offline message queuing.",
    statement:
      "Design a chat system supporting 1:1 and small group conversations, with near-instant delivery to online " +
      "recipients and reliable delivery once an offline recipient comes back online.",
    functionalRequirements: [
      "Deliver a message instantly to an online recipient.",
      "Queue and deliver messages to a recipient who was offline when they were sent.",
      "Show accurate online/offline presence for contacts.",
      "Persist full message history."
    ],
    nonFunctionalRequirements: [
      "Low latency delivery for online users (real-time feel).",
      "High availability - messages should never silently disappear.",
      "Support millions of concurrent long-lived connections."
    ],
    scaleNote: "Tens of millions of concurrent WebSocket connections held open at once.",
    rootComponentId: "client",
    nodes: [
      {
        id: "websocket_gateway",
        parentId: null,
        whyItFits:
          "Clients open a long-lived WebSocket connection to a gateway tier - this is what makes instant, " +
          "server-initiated delivery possible instead of the client having to poll.",
        misplacedHint: "A persistent connection has to be established directly between the client and a gateway tier before anything else - it's the first hop, not something behind a queue."
      },
      {
        id: "cache",
        parentId: "websocket_gateway",
        whyItFits:
          "The gateway tier tracks which users are currently online and which gateway node holds their connection, " +
          "in a fast shared store used to route the next message to them.",
        misplacedHint: "Presence/routing info is looked up by the gateway on every incoming message - it's a direct dependency of the gateway, not of the queue or the message-history store."
      },
      {
        id: "nosql_db",
        parentId: "websocket_gateway",
        whyItFits:
          "Every message is durably persisted to a write-optimized store (partitioned by conversation) so full " +
          "history survives even if delivery to a recipient fails.",
        misplacedHint: "Message history is written by the gateway as messages flow through it - it's a direct dependency of the gateway, not something the queue writes to independently."
      },
      {
        id: "message_queue",
        parentId: "websocket_gateway",
        whyItFits:
          "If the recipient's gateway lookup shows them offline, the message is placed on a per-user queue so it can " +
          "be delivered the moment they reconnect.",
        misplacedHint: "Only messages meant for an offline recipient get queued - that decision is made by the gateway handling the incoming message, so the queue is a direct child of the gateway."
      },
      {
        id: "notification_dispatcher",
        parentId: "message_queue",
        whyItFits:
          "For a message sitting in an offline user's queue, a dispatcher also fires a push notification so they " +
          "find out even with the app closed.",
        misplacedHint: "A push notification only makes sense once a message is confirmed queued for an offline user - it's downstream of the queue, not triggered directly by the gateway."
      }
    ],
    distractorIds: ["cdn", "search_index", "id_generator", "payment_processor", "transcoding_service"],
    keyTakeaways: [
      "WebSockets (not polling) are what make server-initiated, instant delivery possible for online users.",
      "Presence has to be a fast, frequently-updated lookup - separate from the durable message history store.",
      "Offline delivery is just a queue plus a push notification as a nudge - not a fundamentally different pipeline."
    ],
    estimationQuestions: [
      {
        id: "gateway-count",
        prompt: "10 million users are online concurrently, each holding one WebSocket connection. If a single gateway server can hold 50,000 concurrent connections, how many gateway servers are needed at minimum?",
        unit: "servers",
        placeholder: "e.g. 200",
        expectedValue: 200,
        tolerancePercent: 20,
        explanation: "10,000,000 / 50,000 = 200 gateway servers just to hold the connections, before adding redundancy headroom."
      },
      {
        id: "message-qps",
        prompt: "500 million total users each send an average of 20 messages/day. What's the average message-write QPS?",
        unit: "messages/sec",
        placeholder: "e.g. 115000",
        expectedValue: 115740,
        tolerancePercent: 40,
        explanation: "500,000,000 x 20 / 86,400 ~= 115,700 messages/sec average - a write rate that rules out a single relational database."
      }
    ],
    tradeoff: {
      nodeId: "nosql_db",
      prompt: "How should message history be stored?",
      options: [
        {
          id: "nosql",
          label: "A horizontally-partitioned store, partitioned by conversation ID",
          correct: true,
          rationale: "Keeps all of one chat's messages together for fast retrieval, while spreading different conversations across many nodes to handle the aggregate write volume."
        },
        {
          id: "sql-single",
          label: "A single relational database for all messages",
          correct: false,
          rationale: "At well over 100,000 writes/sec sustained, one relational database node becomes the hard ceiling on the entire platform's message throughput."
        },
        {
          id: "memory-only",
          label: "Keep messages only in each gateway server's memory",
          correct: false,
          rationale: "Loses all message history the moment a gateway server restarts, and history would only be visible from whichever server happened to handle it."
        }
      ]
    },
    failureQuestions: [
      {
        id: "brief-drop",
        prompt: "A user's WebSocket connection drops for 30 seconds (e.g. a tunnel). What happens to messages sent to them during that time?",
        options: [
          { id: "lost", label: "They're lost forever" },
          { id: "queued", label: "They're queued (since the gateway sees them as offline) and delivered once they reconnect" },
          { id: "sender-fails", label: "The sender's message fails to send" }
        ],
        correctOptionId: "queued",
        explanation: "The same offline-queuing path used for a genuinely offline user also covers brief connectivity blips - 'temporarily disconnected' and 'offline' are the same case here."
      },
      {
        id: "bottleneck",
        prompt: "At 10x normal concurrent connections, what's most likely to become the bottleneck first?",
        options: [
          { id: "history-db", label: "The message history database, since writes are naturally partitioned" },
          { id: "gateways", label: "The number of WebSocket gateway servers and the presence-lookup store, since every connection scales directly with concurrent users" },
          { id: "dispatcher", label: "The notification dispatcher" }
        ],
        correctOptionId: "gateways",
        explanation: "Message writes are spread by conversation partitioning, but concurrent connection count (and presence lookups) scales linearly and directly with how many users are online at once."
      }
    ]
  },

  {
    id: "search-autocomplete",
    title: "Design a Search Autocomplete System",
    difficulty: "hard",
    companies: ["Google", "Amazon"],
    tags: ["Search", "Tries"],
    summary: "Suggest the top completions for whatever a user has typed so far, in well under 100ms.",
    statement:
      "Design a search-as-you-type autocomplete system: as a user types each character, show the top-k most likely " +
      "completions, ranked by historical popularity, within milliseconds.",
    functionalRequirements: [
      "Given a prefix, return the top-k ranked completions.",
      "Rankings should reflect real query popularity, refreshed periodically.",
      "New trending queries should eventually surface without a full redeploy."
    ],
    nonFunctionalRequirements: [
      "Suggestions must return in well under 100ms - this runs on every keystroke.",
      "The system can tolerate slightly stale rankings in exchange for that speed.",
      "Should survive a server restart without losing ranking data."
    ],
    scaleNote: "Rankings rebuilt from query logs on a periodic cycle (e.g. hourly), served from memory the rest of the time.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "Every keystroke's autocomplete request is distributed across app servers by a load balancer.",
        misplacedHint: "Autocomplete requests still need to be spread across servers first, just like any other API traffic - the load balancer is the first hop."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits: "The app server receives the current prefix and is responsible for returning ranked completions fast.",
        misplacedHint: "The request-handling logic for a given prefix lives on the app server, right behind the load balancer."
      },
      {
        id: "cache",
        parentId: "web_server",
        whyItFits:
          "The very top, most common prefixes (a small, hot set) are cached directly in memory since they're looked " +
          "up constantly.",
        misplacedHint: "This is a thin, fast shortcut sitting on the app server's read path in front of the trie, not a replacement for it."
      },
      {
        id: "trie_store",
        parentId: "web_server",
        whyItFits:
          "For everything else, the app server walks an in-memory prefix trie that already has each node's top-k " +
          "completions precomputed, so a lookup is just a tree walk.",
        misplacedHint: "The trie is queried directly by the app server on a cache miss - it isn't something the cache or the rebuild pipeline sits in front of."
      },
      {
        id: "stream_processor",
        parentId: "trie_store",
        whyItFits:
          "An offline pipeline periodically aggregates raw query logs and rebuilds the trie's rankings, so trending " +
          "queries eventually surface without touching the live serving path.",
        misplacedHint: "Rebuilding rankings is a background job that feeds the trie, not something on the live request path from the app server."
      },
      {
        id: "object_storage",
        parentId: "stream_processor",
        whyItFits:
          "Each rebuilt trie snapshot (and the raw aggregated logs) is persisted to durable storage so a restarting " +
          "server can reload rankings instead of starting from empty.",
        misplacedHint: "Persisting snapshots is the last step of the offline rebuild pipeline - it's a direct child of the rebuild job, not of the live trie or app server."
      }
    ],
    distractorIds: ["message_queue", "sql_db", "geo_service", "payment_processor", "websocket_gateway"],
    keyTakeaways: [
      "Precomputing top-k completions per trie node turns an expensive ranking problem into a cheap tree walk at read time.",
      "Ranking freshness is decoupled from serving speed: an offline pipeline rebuilds periodically, live traffic just reads.",
      "A small hot-prefix cache in front of the trie is a nice-to-have optimization, not a replacement for it."
    ],
    estimationQuestions: [
      {
        id: "keystroke-qps",
        prompt: "The product serves 200 million searches/day and the average query is 15 characters (one suggestion request per keystroke). What's the average request QPS?",
        unit: "requests/sec",
        placeholder: "e.g. 34700",
        expectedValue: 34722,
        tolerancePercent: 40,
        explanation: "200,000,000 x 15 / 86,400 ~= 34,700 requests/sec - dramatically higher than 'one request per search', which is why sub-100ms in-memory lookups are non-negotiable."
      },
      {
        id: "rebuild-fraction",
        prompt: "The trie's rankings are rebuilt from a day's query logs, and a full rebuild takes 45 minutes. Roughly what fraction of a 24-hour day is spent rebuilding?",
        unit: "%",
        placeholder: "e.g. 3",
        expectedValue: 3.1,
        tolerancePercent: 30,
        explanation: "45 minutes / 1,440 minutes in a day ~= 3% of the day - small enough to run the rebuild on a separate replica and swap it in without pausing live traffic."
      }
    ],
    tradeoff: {
      nodeId: "trie_store",
      prompt: "How fresh do the ranked suggestions need to be?",
      options: [
        {
          id: "periodic",
          label: "Periodically rebuilt (e.g. hourly) from aggregated query logs, served from memory in between",
          correct: true,
          rationale: "Suggestion rankings change slowly in practice, so trading a little staleness for microsecond in-memory lookups is right for a feature firing on every keystroke."
        },
        {
          id: "live",
          label: "Recomputed from scratch on every single keystroke",
          correct: false,
          rationale: "Recomputing rankings live, on every keystroke across the whole userbase, needs far more compute than the feature could ever justify."
        },
        {
          id: "static",
          label: "Built once at launch and never updated again",
          correct: false,
          rationale: "Search trends genuinely shift over time - suggestions frozen at launch just get more wrong every day."
        }
      ]
    },
    failureQuestions: [
      {
        id: "rebuild-broken",
        prompt: "The offline rebuild pipeline breaks and hasn't run in a week. What's the user-facing impact?",
        options: [
          { id: "stops", label: "Autocomplete stops working entirely" },
          { id: "stale", label: "Autocomplete keeps working, just with rankings a week stale instead of reflecting recent trends" },
          { id: "search-down", label: "The whole search feature goes down" }
        ],
        correctOptionId: "stale",
        explanation: "Because the trie is served from memory independent of the rebuild pipeline, a broken rebuild degrades freshness, not availability."
      },
      {
        id: "bottleneck",
        prompt: "At 10x normal keystroke traffic, what's most likely to need scaling first?",
        options: [
          { id: "rebuild-pipeline", label: "The offline rebuild pipeline, since it now has to process 10x the logs" },
          { id: "serving-tier", label: "The live-serving app servers and their in-memory trie replicas, since every keystroke hits them directly" },
          { id: "object-storage", label: "Object storage, since it just stores periodic snapshots" }
        ],
        correctOptionId: "serving-tier",
        explanation: "The live serving path is hit on every keystroke with essentially no buffer before user-facing latency - that's the tier that needs to scale out immediately."
      }
    ]
  },

  {
    id: "video-streaming",
    title: "Design YouTube",
    difficulty: "hard",
    companies: ["YouTube", "Netflix"],
    tags: ["Media", "CDN"],
    summary: "Accept video uploads, transcode them into every resolution, and stream smoothly to any device.",
    statement:
      "Design a video-sharing platform like YouTube: creators upload raw video files, the platform prepares them for " +
      "playback at multiple resolutions/bitrates, and viewers stream smoothly regardless of device or network speed.",
    functionalRequirements: [
      "Accept a video upload and store the raw file durably.",
      "Transcode the raw upload into multiple resolutions/bitrates.",
      "Serve playback requests from wherever is closest to the viewer.",
      "Track video metadata (title, owner, view count, processing status)."
    ],
    nonFunctionalRequirements: [
      "Uploads and playback are both extremely high-volume and must scale independently.",
      "Transcoding is CPU-heavy and must not block the upload response.",
      "Playback should adapt to the viewer's bandwidth (adaptive bitrate)."
    ],
    scaleNote: "500 hours of video uploaded per minute at YouTube's real-world scale; playback traffic dwarfs upload traffic.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "Both upload and metadata/API requests enter through a load balancer distributing across app servers.",
        misplacedHint: "Upload and API requests both need to be distributed across servers first - that's the load balancer, first in line from the client."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits:
          "The app server accepts uploads, serves metadata queries, and kicks off the processing pipeline - it's the " +
          "control plane for the whole flow.",
        misplacedHint: "Upload handling and metadata queries are both app-server responsibilities, sitting right behind the load balancer."
      },
      {
        id: "metadata_db",
        parentId: "web_server",
        whyItFits:
          "Video metadata (title, owner, current processing status, view counts) is tracked in its own store, queried " +
          "far more often and far more cheaply than the video bytes themselves.",
        misplacedHint: "Metadata queries are handled directly by the app server - this store is a direct dependency of it, not of the transcoding pipeline."
      },
      {
        id: "object_storage",
        parentId: "web_server",
        whyItFits:
          "The raw uploaded file is written straight to durable blob storage - a landing zone that then triggers the " +
          "processing pipeline.",
        misplacedHint: "The raw upload lands wherever the app server puts it right after accepting the request - it's a direct child of the app server, before any transcoding happens."
      },
      {
        id: "transcoding_service",
        parentId: "object_storage",
        whyItFits:
          "Once the raw file lands in storage, a transcoding pipeline picks it up and produces multiple resolutions " +
          "and bitrates for adaptive playback.",
        misplacedHint: "Transcoding only starts once a raw file exists in storage to read from - it's triggered by and downstream of the raw upload landing there."
      },
      {
        id: "cdn",
        parentId: "transcoding_service",
        whyItFits:
          "Finished, transcoded renditions are pushed to (or pulled by) a CDN, so playback is served from an edge " +
          "location close to each viewer instead of the origin.",
        misplacedHint: "Only fully transcoded, playback-ready renditions belong on the CDN - it sits downstream of transcoding, not in front of the raw upload."
      }
    ],
    distractorIds: ["message_queue", "geo_service", "id_generator", "search_index", "rate_limiter_service"],
    keyTakeaways: [
      "Upload and playback are fundamentally different traffic shapes (write-once, read-many) and scale independently.",
      "Transcoding has to happen off the upload request path - the client shouldn't wait minutes for a response.",
      "The CDN only ever serves fully-processed output, never raw uploads."
    ],
    estimationQuestions: [
      {
        id: "raw-upload-storage",
        prompt: "500 hours of video are uploaded per minute, at roughly 1 GB per hour of raw source video. How much raw storage does one day of uploads consume?",
        unit: "TB/day",
        placeholder: "e.g. 720",
        expectedValue: 720,
        tolerancePercent: 25,
        explanation: "500 hours/min x 1,440 min/day = 720,000 hours/day x 1 GB/hour ~= 720 TB/day of raw uploads alone, before any transcoded renditions."
      },
      {
        id: "processed-storage",
        prompt: "If each uploaded video is transcoded into 5 renditions averaging 40% the original size, roughly how much extra processed storage does a day of uploads add?",
        unit: "TB/day",
        placeholder: "e.g. 1440",
        expectedValue: 1440,
        tolerancePercent: 30,
        explanation: "720 TB x 5 renditions x 40% average size ~= 1,440 TB/day of processed output - usually the larger long-term storage cost."
      }
    ],
    tradeoff: {
      nodeId: "cdn",
      prompt: "How should playback traffic actually be served to viewers?",
      options: [
        {
          id: "cdn",
          label: "Push/pull transcoded renditions to CDN edge nodes near each viewer",
          correct: true,
          rationale: "Playback traffic is enormous and read-heavy by nature - serving it from edge locations close to viewers is the only way to keep latency and origin bandwidth cost manageable."
        },
        {
          id: "origin",
          label: "Serve every playback request directly from the origin object storage",
          correct: false,
          rationale: "Every viewer worldwide hitting one origin region directly creates massive latency for distant viewers and a concentrated bandwidth bill."
        },
        {
          id: "p2p",
          label: "Have viewers stream directly from each other with no CDN at all",
          correct: false,
          rationale: "Peer-to-peer has real reliability problems (peers going offline mid-stream) and doesn't solve the cold-start problem for a brand new upload with no viewers yet to seed from."
        }
      ]
    },
    failureQuestions: [
      {
        id: "transcoding-backlog",
        prompt: "The transcoding pipeline gets backed up and falls hours behind. What's the immediate impact on already-published videos?",
        options: [
          { id: "stop-playing", label: "Already-published videos stop playing" },
          { id: "unaffected", label: "Already-published videos keep playing fine from the CDN; only brand-new uploads are delayed" },
          { id: "platform-down", label: "The whole platform goes offline" }
        ],
        correctOptionId: "unaffected",
        explanation: "Transcoding only affects the upload -> ready pipeline for new content - videos already on the CDN are unaffected by a backlog."
      },
      {
        id: "viral-new",
        prompt: "A brand new video goes unexpectedly viral within its first hour, before the CDN has broadly cached it. What's the biggest short-term risk?",
        options: [
          { id: "metadata-corrupt", label: "The video's metadata gets corrupted" },
          { id: "origin-hit", label: "Origin storage and the CDN's cache-fill path get hit hard by many simultaneous cache misses before content propagates to edge nodes" },
          { id: "retranscode", label: "The transcoding service has to re-run" }
        ],
        correctOptionId: "origin-hit",
        explanation: "A CDN only helps once content is cached at the edge - a sudden surge on brand-new content means many early viewers cause cache misses at once, briefly hammering the origin."
      }
    ]
  },

  {
    id: "cloud-file-storage",
    title: "Design Google Drive",
    difficulty: "hard",
    companies: ["Google", "Dropbox"],
    tags: ["Storage", "Sync"],
    summary: "Store files durably, sync changes across every device a user owns, and only transfer what changed.",
    statement:
      "Design a cloud file storage and sync service like Google Drive or Dropbox: users upload files, edit them from " +
      "multiple devices, and expect changes to propagate to every other signed-in device quickly - without re-uploading " +
      "an entire file just because a few bytes changed.",
    functionalRequirements: [
      "Upload, download, and organize files and folders.",
      "Detect changes to a local file and sync only the changed pieces.",
      "Notify a user's other signed-in devices when a file changes."
    ],
    nonFunctionalRequirements: [
      "Bandwidth-efficient sync - avoid re-transferring unchanged parts of large files.",
      "Strong durability for stored file content.",
      "Near-real-time propagation of changes across a user's devices."
    ],
    scaleNote: "Files are chunked (e.g. 4MB blocks); only changed blocks are re-uploaded and re-synced.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Every client (desktop sync agent, mobile app, browser) talks to a single API gateway for all file operations.",
        misplacedHint: "All file operations need one consistent entry point first, regardless of which client app is calling - that's the API gateway."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits: "The file service handles requests, coordinates metadata updates, and hands off the actual sync work.",
        misplacedHint: "Request handling and coordination logic live in the file service, right behind the gateway - not inside the sync engine itself."
      },
      {
        id: "metadata_db",
        parentId: "web_server",
        whyItFits:
          "File and folder metadata (names, folder structure, ownership, version numbers) is tracked separately from " +
          "the raw bytes, so listing a folder never requires touching blob storage.",
        misplacedHint: "Metadata is queried and updated directly by the file service - this store is a direct dependency of it, not of the sync engine's chunking step."
      },
      {
        id: "sync_engine",
        parentId: "web_server",
        whyItFits:
          "The sync engine is what actually chunks a file into fixed-size blocks and diffs them against what's " +
          "already stored, so only changed blocks need to move.",
        misplacedHint: "Chunking and diffing is a distinct step the file service delegates to - it's a direct child of the file service, not something the metadata store or gateway does."
      },
      {
        id: "object_storage",
        parentId: "sync_engine",
        whyItFits: "Each content-addressed chunk is written to durable blob storage, deduplicated automatically since identical chunks hash the same.",
        misplacedHint: "Chunks are written wherever the sync engine decides after diffing - storage is downstream of the sync engine, not something the file service writes to directly."
      },
      {
        id: "message_queue",
        parentId: "sync_engine",
        whyItFits:
          "Once a chunk is stored, the sync engine publishes a 'file changed' event so every other device can be told " +
          "to pull the update.",
        misplacedHint: "A change event is only emitted once the sync engine has actually processed and stored a change - it's a direct child of the sync engine."
      },
      {
        id: "websocket_gateway",
        parentId: "message_queue",
        whyItFits:
          "A realtime gateway consumes change events and pushes them to any of the user's other devices that are " +
          "currently connected, so they know to pull the update immediately.",
        misplacedHint: "Push delivery to other devices only happens after a change event exists on the queue - it's downstream of the queue, not triggered directly by the sync engine."
      }
    ],
    distractorIds: ["cdn", "geo_service", "payment_processor", "search_index", "id_generator"],
    keyTakeaways: [
      "Chunking + content hashing is what makes sync bandwidth-efficient - only changed blocks ever move.",
      "Metadata (structure, names, versions) and content (raw bytes) are stored and scaled completely separately.",
      "Propagating a change to other devices is an event, fanned out asynchronously - not a synchronous broadcast from the upload request."
    ],
    estimationQuestions: [
      {
        id: "chunk-count",
        prompt: "A user edits a 2 GB video file with a 4 MB chunk size. Roughly how many chunks make up the whole file?",
        unit: "chunks",
        placeholder: "e.g. 512",
        expectedValue: 512,
        tolerancePercent: 15,
        explanation: "2,048 MB / 4 MB per chunk ~= 512 chunks - if an edit only touches a couple of chunks, sync only needs to re-upload those, not all 512."
      },
      {
        id: "reupload-fraction",
        prompt: "If only 3 of those ~512 chunks actually changed, what percentage of the file's data needs to be re-uploaded thanks to chunking?",
        unit: "%",
        placeholder: "e.g. 0.6",
        expectedValue: 0.59,
        tolerancePercent: 40,
        explanation: "3 / 512 ~= 0.6% of the file needs to move over the network, versus 100% if the whole file were re-uploaded on every edit."
      }
    ],
    tradeoff: {
      nodeId: "sync_engine",
      prompt: "How should the sync engine decide what to re-upload after a file changes?",
      options: [
        {
          id: "chunk-diff",
          label: "Split the file into fixed-size chunks, hash each one, and only upload chunks whose hash changed",
          correct: true,
          rationale: "Content-addressed chunking makes sync bandwidth-efficient and gets deduplication for free, since identical chunks across files share the same hash."
        },
        {
          id: "whole-file",
          label: "Re-upload the entire file on any change, however small",
          correct: false,
          rationale: "Re-uploading a multi-gigabyte file for a one-byte edit wastes enormous bandwidth and makes sync painfully slow for large files."
        },
        {
          id: "timestamp",
          label: "Just compare file modification timestamps and re-upload if newer",
          correct: false,
          rationale: "A timestamp tells you THAT something changed, not WHICH bytes changed - you'd still have no way to avoid re-uploading the whole file."
        }
      ]
    },
    failureQuestions: [
      {
        id: "concurrent-edit",
        prompt: "Two devices edit the same file offline at the same time, then both come back online. What must the system do?",
        options: [
          { id: "silent-pick", label: "Silently keep whichever synced first and discard the other's changes" },
          { id: "conflict", label: "Detect the conflict and either merge or present both versions to the user" },
          { id: "crash", label: "Crash" }
        ],
        correctOptionId: "conflict",
        explanation: "Offline concurrent edits are a fundamental conflict, not a bug - silently picking a winner would quietly destroy the other device's changes."
      },
      {
        id: "queue-down",
        prompt: "The message queue that announces file changes goes down temporarily. What's the impact?",
        options: [
          { id: "corrupted", label: "Files are permanently corrupted" },
          { id: "delayed-notice", label: "New changes still get durably chunked and stored; other devices just won't get an instant push until the queue recovers" },
          { id: "sync-stops", label: "All sync stops working entirely" }
        ],
        correctOptionId: "delayed-notice",
        explanation: "The queue's job is fast notification, not durability - data is already safely in object storage before the change event is published, so an outage delays discovery, it doesn't lose data."
      }
    ]
  },

  // ---------------------------------------------------------------------------------------
  // ADVANCED / ORIGINAL
  // ---------------------------------------------------------------------------------------
  {
    id: "ride-sharing-dispatch",
    title: "Design a Ride-Sharing Dispatch Service",
    difficulty: "hard",
    companies: ["Uber", "Lyft"],
    tags: ["Geospatial", "Marketplace"],
    summary: "Match riders with the nearest available driver in real time, from a constantly-moving set of locations.",
    statement:
      "Design the core dispatch system for a ride-sharing app: riders request a trip, and the system must find and " +
      "assign the closest available driver within a couple of seconds, while every driver's phone is continuously " +
      "reporting a new GPS location several times a minute.",
    functionalRequirements: [
      "Continuously ingest live driver location updates.",
      "Given a rider's location, find nearby available drivers quickly.",
      "Match a rider to a specific driver and record the resulting trip.",
      "Notify the matched driver so they can accept or reject."
    ],
    nonFunctionalRequirements: [
      "Matching must complete in a couple of seconds, not minutes.",
      "Location writes are extremely frequent and don't need long-term durability individually.",
      "Trip and fare records need strong consistency - no double-booking a driver."
    ],
    scaleNote: "Millions of active drivers each pushing a location update every few seconds.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Both rider requests and driver location pings enter through a single API gateway.",
        misplacedHint: "Every request - a driver's location ping or a rider's trip request - needs one entry point first, which is the API gateway."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits: "The trip service handles incoming requests and coordinates between the geo layer and the matching layer.",
        misplacedHint: "Coordinating a trip request end-to-end is the trip service's job, right behind the gateway - not something the geo or matching services do on their own."
      },
      {
        id: "geo_service",
        parentId: "web_server",
        whyItFits:
          "The trip service asks a geospatial dispatch service (geohash/quad-tree index) for the nearest available " +
          "drivers to the rider's location.",
        misplacedHint: "Proximity lookups are delegated by the trip service to a dedicated geospatial service - it's a direct child of the trip service, not something the matching engine queries independently."
      },
      {
        id: "cache",
        parentId: "geo_service",
        whyItFits:
          "Live driver locations change every few seconds and don't need long-term durability - they're kept in a " +
          "fast in-memory geospatial index (e.g. Redis GEO), constantly overwritten.",
        misplacedHint: "High-frequency, ephemeral location writes belong in a fast in-memory store sitting under the geo service, not in the durable trip database."
      },
      {
        id: "matching_service",
        parentId: "web_server",
        whyItFits:
          "Given a shortlist of nearby drivers from the geo service, a separate matching engine decides which one to " +
          "actually offer the trip to and handles accept/reject/timeout logic.",
        misplacedHint: "Matching logic (who actually gets offered the trip) is a distinct step from proximity search - it's a direct child of the trip service, consuming the geo service's shortlist."
      },
      {
        id: "message_queue",
        parentId: "matching_service",
        whyItFits:
          "The matching engine enqueues a dispatch job to notify the chosen driver, with a retry/timeout policy that " +
          "moves to the next candidate if there's no response in time.",
        misplacedHint: "Notifying a driver, with retries if they don't respond, is queued work downstream of a match being proposed - not something the geo service or trip service do directly."
      },
      {
        id: "sql_db",
        parentId: "web_server",
        whyItFits:
          "Confirmed trip and fare records need real transactions (a driver can't be double-booked) so they live in a " +
          "relational database, separate from the ephemeral location data.",
        misplacedHint: "Trip/fare records need strong consistency and are written by the trip service directly - not by the geo service, which only ever handles ephemeral locations."
      }
    ],
    distractorIds: ["cdn", "search_index", "trie_store", "transcoding_service", "graph_store"],
    keyTakeaways: [
      "Ephemeral, high-frequency data (live location) and durable, transactional data (confirmed trips) belong in very different stores.",
      "Proximity search (who's nearby) and matching (who gets offered the trip) are separable concerns with different logic and different retry needs.",
      "A queue with retry/timeout is what lets dispatch move on to the next driver instead of hanging on one unresponsive one."
    ],
    estimationQuestions: [
      {
        id: "location-write-qps",
        prompt: "5 million active drivers each push a location update every 4 seconds. What's the average location-update write QPS the geo layer must sustain?",
        unit: "updates/sec",
        placeholder: "e.g. 1250000",
        expectedValue: 1250000,
        tolerancePercent: 25,
        explanation: "5,000,000 / 4 seconds ~= 1,250,000 updates/sec - a constant, enormous write load that has to live in a fast in-memory store, not a durable relational database."
      },
      {
        id: "scan-budget",
        prompt: "A matching request has a 500ms budget, and checking one candidate driver takes 2ms of lookup + scoring time. How many candidates could a single thread check in that budget?",
        unit: "candidates",
        placeholder: "e.g. 250",
        expectedValue: 250,
        tolerancePercent: 10,
        explanation: "500ms / 2ms per candidate ~= 250 candidates - nowhere near enough to scan 5 million drivers, which is why a geospatial index has to narrow the search first."
      }
    ],
    tradeoff: {
      nodeId: "cache",
      prompt: "Where should live, constantly-changing driver GPS coordinates be stored?",
      options: [
        {
          id: "in-memory-geo",
          label: "A fast in-memory geospatial index (e.g. Redis GEO), overwritten on every update",
          correct: true,
          rationale: "Live location is ephemeral and extremely high-write - it needs microsecond writes and proximity queries, and losing a few stale seconds on a restart is a non-issue."
        },
        {
          id: "relational",
          label: "A relational database row per driver, updated on every ping",
          correct: false,
          rationale: "At over a million writes per second, a relational database's transactional overhead would fall over immediately - this data doesn't need transactions or durability."
        },
        {
          id: "same-as-trips",
          label: "The same durable store used for confirmed trip and fare records",
          correct: false,
          rationale: "Mixing an extremely high-write, ephemeral workload into the durable trip store would make the trip database's performance and cost profile far worse for no benefit."
        }
      ]
    },
    failureQuestions: [
      {
        id: "cache-lost",
        prompt: "The live-location cache is lost (e.g. a cluster restart with no persistence). What's the actual impact?",
        options: [
          { id: "history-lost", label: "Permanent loss of all trip history" },
          { id: "self-heals", label: "A brief gap where recent driver positions are stale until each driver's phone sends its next periodic update a few seconds later" },
          { id: "trips-cancelled", label: "All in-progress trips are cancelled" }
        ],
        correctOptionId: "self-heals",
        explanation: "Because location pings arrive every few seconds anyway, losing the in-memory snapshot is self-healing almost immediately - it's designed to be ephemeral."
      },
      {
        id: "surge-bottleneck",
        prompt: "At 10x normal ride requests during a big event, what's most likely to need scaling first?",
        options: [
          { id: "geo-matching", label: "The geo-service and matching engine, since every request needs a fresh nearby-driver search and a dispatch decision" },
          { id: "trip-db", label: "The trip database, since transactional writes scale poorly" },
          { id: "gateway", label: "The API gateway, since it does no real work" }
        ],
        correctOptionId: "geo-matching",
        explanation: "Every ride request drives a proximity search plus a matching decision - those compute-heavy steps scale directly with request volume, unlike confirmed trip writes (one per completed ride)."
      }
    ]
  },

  {
    id: "ticket-booking",
    title: "Design a Ticket Booking System",
    difficulty: "hard",
    companies: ["Ticketmaster", "BookMyShow", "Amazon"],
    tags: ["Concurrency", "Transactions"],
    summary: "Sell a fixed number of seats to a crowd of simultaneous buyers without ever double-booking one.",
    statement:
      "Design a ticket booking system for live events: thousands of users may try to book the same handful of " +
      "remaining seats for a popular show at the exact same moment. No seat may ever be sold to two different people.",
    functionalRequirements: [
      "Show real-time seat availability for an event.",
      "Temporarily hold a seat while a user completes checkout.",
      "Charge payment only after a hold succeeds, then permanently confirm the seat.",
      "Release a hold automatically if checkout isn't completed in time."
    ],
    nonFunctionalRequirements: [
      "No seat can ever be sold twice, even under a burst of simultaneous requests (a 'thundering herd').",
      "Seat holds must expire automatically so abandoned checkouts don't lock inventory forever.",
      "Payment must not be charged unless the seat hold actually succeeded."
    ],
    scaleNote: "Tens of thousands of concurrent requests for the same on-sale event within the first seconds.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "The burst of simultaneous booking requests is spread across many app servers by a load balancer.",
        misplacedHint: "A thundering-herd burst of requests still needs to be spread across servers first - the load balancer is the first hop, same as any other API."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits: "The booking service handles the seat-hold, payment, and confirmation flow for each request.",
        misplacedHint: "The booking flow's logic lives in the booking service, right behind the load balancer - not inside the cache or database directly."
      },
      {
        id: "cache",
        parentId: "web_server",
        whyItFits:
          "A short-lived seat hold (e.g. 'seat 14C reserved for 5 minutes') is implemented as a fast, TTL-based lock - " +
          "perfect for something that must expire automatically if checkout stalls.",
        misplacedHint: "Temporary, auto-expiring holds belong in a fast TTL-based store sitting under the booking service - not in the durable, permanent seat-inventory database."
      },
      {
        id: "sql_db",
        parentId: "web_server",
        whyItFits:
          "The permanent seat-inventory and confirmed-booking records need real ACID transactions so a seat is never " +
          "sold twice once truly confirmed.",
        misplacedHint: "Permanent inventory needs transactional guarantees and is written by the booking service directly - it's separate from the temporary hold cache."
      },
      {
        id: "payment_processor",
        parentId: "web_server",
        whyItFits: "Only after a seat hold succeeds does the booking service charge the user via an external payment gateway.",
        misplacedHint: "Payment is only ever attempted after a hold succeeds, initiated by the booking service - it doesn't sit in front of the hold/inventory logic."
      },
      {
        id: "message_queue",
        parentId: "payment_processor",
        whyItFits: "Once payment succeeds, a 'booking confirmed' event is published for anything downstream that needs to react (e.g. sending the ticket).",
        misplacedHint: "A confirmation event only makes sense once payment has actually succeeded - it's downstream of the payment step, not something emitted before charging the user."
      },
      {
        id: "notification_dispatcher",
        parentId: "message_queue",
        whyItFits: "A dispatcher consumes the confirmation event and sends the user their e-ticket/confirmation.",
        misplacedHint: "Sending the confirmation is the very last step, triggered by the confirmation event on the queue - not something the payment gateway does directly."
      }
    ],
    distractorIds: ["cdn", "geo_service", "search_index", "graph_store", "trie_store"],
    keyTakeaways: [
      "A fast, auto-expiring hold (cache/TTL) protects a seat during checkout without permanently locking durable inventory.",
      "Payment is only ever attempted after a hold succeeds - never the other way around.",
      "Permanent inventory changes need real transactions; a distributed lock alone isn't enough to guarantee 'never sold twice'."
    ],
    estimationQuestions: [
      {
        id: "peak-qps",
        prompt: "50,000 people try to book the same 500 remaining seats within the first 10 seconds of an on-sale. What's the peak request QPS?",
        unit: "requests/sec",
        placeholder: "e.g. 5000",
        expectedValue: 5000,
        tolerancePercent: 30,
        explanation: "50,000 / 10 seconds = 5,000 requests/sec at peak, versus only 500 requests that can ever succeed - why a fast, short-TTL hold has to absorb this thundering herd."
      },
      {
        id: "abandoned-seats",
        prompt: "A seat hold lasts 5 minutes and 30% of holds are abandoned on average. How many of the original 500 seats become newly available about 5 minutes in?",
        unit: "seats",
        placeholder: "e.g. 150",
        expectedValue: 150,
        tolerancePercent: 20,
        explanation: "500 x 30% ~= 150 seats become available again after the first wave of 5-minute holds expires - why holds need an automatic TTL rather than locking forever."
      }
    ],
    tradeoff: {
      nodeId: "cache",
      prompt: "How should a temporary seat hold during checkout be implemented?",
      options: [
        {
          id: "ttl-lock",
          label: "A short-TTL lock in a fast in-memory store (e.g. Redis SETNX with expiry)",
          correct: true,
          rationale: "A hold needs to be fast to acquire under a burst of simultaneous requests, and automatically expire if the user abandons checkout - exactly what a TTL-based lock is built for."
        },
        {
          id: "db-lock",
          label: "A row-level lock held in the permanent relational database for the whole checkout duration",
          correct: false,
          rationale: "Holding a database transaction open for however long a user takes to enter card details ties up connections and locks for minutes at a time under heavy load."
        },
        {
          id: "none",
          label: "No hold at all - just try to charge payment immediately and see if the seat is still free",
          correct: false,
          rationale: "Two users could both pass a 'seat is free' check and both get charged, but only one can actually get the seat - a broken experience and a refund headache."
        }
      ]
    },
    failureQuestions: [
      {
        id: "queue-down-after-charge",
        prompt: "Payment succeeds and the seat is durably confirmed in the database, but the queue used to trigger the confirmation email is briefly down. What should NOT happen?",
        options: [
          { id: "no-rollback", label: "The confirmed booking itself should never be rolled back just because a non-critical notification couldn't be sent immediately" },
          { id: "cancel", label: "The system should cancel the whole booking and refund the user" },
          { id: "release-seat", label: "The seat should be released back into inventory" }
        ],
        correctOptionId: "no-rollback",
        explanation: "The booking (payment + seat confirmation) is the already-durable, critical transaction - a notification is a retry-able nice-to-have that should never undo a completed booking."
      },
      {
        id: "massive-surge",
        prompt: "At 100x the normal on-sale burst (a massively popular event), what's most likely to need the most protection?",
        options: [
          { id: "dispatcher", label: "The notification dispatcher" },
          { id: "hold-and-inventory", label: "The short-TTL hold layer and the permanent seat-inventory transaction, since correctness ('never sold twice') is enforced under maximum contention" },
          { id: "lb", label: "The load balancer" }
        ],
        correctOptionId: "hold-and-inventory",
        explanation: "The hold layer and the transactional inventory update are exactly where 'never double-sell a seat' has to hold up under the worst possible contention."
      }
    ]
  },

  {
    id: "distributed-message-queue",
    title: "Design a Distributed Message Queue",
    difficulty: "hard",
    companies: ["Confluent", "LinkedIn", "Amazon"],
    tags: ["Messaging", "Infrastructure"],
    summary: "Build the durable, ordered, partitioned log that other systems' queues run on top of (Kafka-style).",
    statement:
      "Design a Kafka-style distributed message queue itself: producers publish ordered events into partitioned " +
      "topics, many independent consumer groups read the same data at their own pace, and no acknowledged message is " +
      "ever lost even if a broker crashes.",
    functionalRequirements: [
      "Producers append events to a topic; order is preserved within a partition.",
      "Multiple independent consumer groups can each read the full stream at their own pace.",
      "A message, once acknowledged, must survive a broker crash."
    ],
    nonFunctionalRequirements: [
      "High sustained write throughput per partition.",
      "No message loss - durability beats raw speed when they trade off.",
      "The cluster keeps serving even if one broker goes down (leader failover)."
    ],
    scaleNote: "Millions of events per second across a partitioned topic, retained for days before deletion.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Producers and consumers both first need to discover which broker currently leads the partition they care about.",
        misplacedHint: "Both producers and consumers need to resolve 'who's the current leader for this partition' before talking to a broker directly - that's this entry point's job."
      },
      {
        id: "message_queue",
        parentId: "api_gateway",
        whyItFits:
          "The actual broker cluster is where partitioned, ordered logs live - producers append to a partition's " +
          "leader, and consumer groups read from it independently.",
        misplacedHint: "Once a client knows the current leader, it talks to the broker cluster directly - the broker is the core of the system, sitting behind the entry point, not in front of it."
      },
      {
        id: "zookeeper",
        parentId: "message_queue",
        whyItFits:
          "A coordination service tracks which broker is the current leader for each partition and handles failover " +
          "if a leader crashes.",
        misplacedHint: "Leader election and failover is metadata the broker cluster depends on directly - it isn't something producers or consumers consult on their own."
      },
      {
        id: "object_storage",
        parentId: "message_queue",
        whyItFits:
          "Each partition's log is appended to durable, sequential storage - this is what lets an acknowledged " +
          "message survive a broker restart.",
        misplacedHint: "Durable persistence of the log is the broker's own responsibility, written right after a message is appended - not something producers or the coordination service touch directly."
      },
      {
        id: "worker",
        parentId: "message_queue",
        whyItFits:
          "Each consumer group is really a pool of worker processes independently reading the partitioned log at " +
          "their own committed offset.",
        misplacedHint: "Consumers read from the broker cluster directly, tracking their own position - they're a direct child of the broker, not of storage or coordination."
      },
      {
        id: "cache",
        parentId: "worker",
        whyItFits:
          "Each consumer group's current read position (offset) is committed to a fast store so a restarted consumer " +
          "resumes from where it left off instead of re-reading everything.",
        misplacedHint: "Offset tracking is specific to each consumer group's own progress - it's a direct child of the consumer workers, not shared broker state."
      }
    ],
    distractorIds: ["cdn", "geo_service", "search_index", "payment_processor", "transcoding_service"],
    keyTakeaways: [
      "Partitioning is what gives both ordering-within-a-partition and horizontal scale across partitions.",
      "Durability (survive a crash) and throughput (fast appends) both come from sequential, append-only writes to disk.",
      "Consumer groups are independent - each just tracks its own offset, so adding a new consumer never affects existing ones."
    ],
    estimationQuestions: [
      {
        id: "partition-throughput",
        prompt: "A topic partition sustains 50,000 messages/sec, each message averaging 1 KB. What's the write throughput for that single partition?",
        unit: "MB/sec",
        placeholder: "e.g. 49",
        expectedValue: 48.8,
        tolerancePercent: 15,
        explanation: "50,000 messages/sec x 1 KB ~= 48.8 MB/sec for one partition - sequential disk appends handle this easily, but it also shows why a single partition has a throughput ceiling."
      },
      {
        id: "partition-count",
        prompt: "The platform needs to sustain 2,000,000 messages/sec overall, and each partition tops out at 50,000 messages/sec. How many partitions are needed at minimum?",
        unit: "partitions",
        placeholder: "e.g. 40",
        expectedValue: 40,
        tolerancePercent: 15,
        explanation: "2,000,000 / 50,000 = 40 partitions minimum - partitioning is the throughput scaling knob here, not partition size or a faster disk."
      }
    ],
    tradeoff: {
      nodeId: "object_storage",
      prompt: "How should the broker persist a partition's log to guarantee durability?",
      options: [
        {
          id: "append-seq",
          label: "Sequential, append-only writes to disk, per partition",
          correct: true,
          rationale: "Sequential appends are dramatically faster than random writes and pair naturally with an ordered, immutable log - the core trick behind Kafka-style throughput."
        },
        {
          id: "random-write-db",
          label: "Write each message as a row in a general-purpose relational database",
          correct: false,
          rationale: "A relational database optimizes for random access and rich queries, neither of which this 'append in order, read in order' workload needs."
        },
        {
          id: "memory-only",
          label: "Keep the log only in memory and never persist it to disk",
          correct: false,
          rationale: "A single broker crash would instantly lose every unacknowledged message - unacceptable when an acknowledged message must survive a crash."
        }
      ]
    },
    failureQuestions: [
      {
        id: "leader-crash",
        prompt: "The broker that's currently the leader for a partition crashes. What has to happen for producers and consumers to keep working?",
        options: [
          { id: "permanent-down", label: "That partition becomes permanently unavailable" },
          { id: "failover", label: "The coordination service detects the failure and promotes a replica to be the new leader, and clients reconnect to it" },
          { id: "all-brokers-down", label: "All other partitions on other brokers also go down" }
        ],
        correctOptionId: "failover",
        explanation: "Leader election is exactly what a coordination service is for - a single broker failing triggers a quick failover to an in-sync replica, not a permanent outage."
      },
      {
        id: "slow-consumer",
        prompt: "One consumer group falls hours behind while a second reads in near real-time from the same topic. Does the slow group affect the fast one?",
        options: [
          { id: "yes-interfere", label: "Yes, they interfere with each other since they share the same log" },
          { id: "independent", label: "No - each consumer group tracks its own independent offset, so one group being behind has no effect on another's read position or speed" },
          { id: "blocks-writes", label: "The slow consumer blocks new writes to the topic" }
        ],
        correctOptionId: "independent",
        explanation: "Decoupling storage (the immutable log) from consumption (per-group offsets) is what lets any number of independent consumer groups read the same data at wildly different paces."
      }
    ]
  },

  {
    id: "payment-wallet-system",
    title: "Design a Payment / Wallet System",
    difficulty: "hard",
    companies: ["Stripe", "PayPal", "Amazon"],
    tags: ["Payments", "Idempotency"],
    summary: "Move real money between accounts exactly once per request, even when clients retry after a timeout.",
    statement:
      "Design the core of a payment/wallet system: a request to charge or transfer money must never be applied twice, " +
      "even if the client's network times out and retries the exact same request, and every balance-changing event " +
      "must be auditable after the fact.",
    functionalRequirements: [
      "Charge a payment method or transfer between wallet balances.",
      "Guarantee a retried request is applied at most once (idempotency).",
      "Provide a complete, auditable history of every balance change.",
      "Notify the user once a payment settles."
    ],
    nonFunctionalRequirements: [
      "Strong consistency for balances - no lost or double-applied transactions.",
      "Every state change must be attributable and replayable for audits and disputes.",
      "The system must degrade safely - never guess about whether money moved."
    ],
    scaleNote: "Every write is precious here - correctness matters far more than raw throughput.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Every payment request enters through a single gateway that also enforces auth before any money logic runs.",
        misplacedHint: "Auth and request intake happen before any payment logic - the gateway is the first hop, not something behind the payment service."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits:
          "The payment service validates the request, checks idempotency, and coordinates the ledger update and the " +
          "external charge.",
        misplacedHint: "Coordinating a payment end-to-end is the payment service's job, right behind the gateway - not the ledger's or the processor's."
      },
      {
        id: "id_generator",
        parentId: "web_server",
        whyItFits:
          "Every incoming request carries (or is assigned) a unique idempotency key, checked before any money moves, " +
          "so a client retry after a timeout never gets applied twice.",
        misplacedHint: "Idempotency has to be checked at the very start of handling a request, right on the payment service - not after the charge has already happened."
      },
      {
        id: "ledger_db",
        parentId: "web_server",
        whyItFits:
          "Every balance-changing event is written to an append-only ledger first - the single auditable source of " +
          "truth for what happened and when.",
        misplacedHint: "The ledger is written directly by the payment service as the durable record of intent and outcome - it isn't something the external processor or notifier touches."
      },
      {
        id: "payment_processor",
        parentId: "web_server",
        whyItFits: "The payment service calls out to an external processor (card network/bank rails) to actually move real money.",
        misplacedHint: "Only the payment service talks to the external processor, after the ledger records the attempt - it's not something triggered by the ledger or gateway directly."
      },
      {
        id: "message_queue",
        parentId: "payment_processor",
        whyItFits: "Once the processor confirms settlement, a 'payment settled' event is published for downstream consumers.",
        misplacedHint: "A settlement event only fires after the processor actually confirms the charge - it's downstream of the processor call, not emitted speculatively earlier."
      },
      {
        id: "notification_dispatcher",
        parentId: "message_queue",
        whyItFits: "A dispatcher consumes the settlement event and sends the user a receipt.",
        misplacedHint: "The receipt is the final step, triggered by the settlement event on the queue - not sent directly by the payment processor or ledger."
      }
    ],
    distractorIds: ["cdn", "geo_service", "search_index", "trie_store", "transcoding_service"],
    keyTakeaways: [
      "Idempotency keys are checked before any money moves - that's what makes safe client retries possible.",
      "An append-only ledger, written before calling the external processor, is what makes the system auditable and recoverable.",
      "Notification is the very last, non-critical step - it never gates whether money actually moved."
    ],
    estimationQuestions: [
      {
        id: "retry-charges",
        prompt: "A client's network times out and it retries the exact same payment request 3 times before succeeding. With correct idempotency-key handling, how many times should the customer actually be charged?",
        unit: "charge(s)",
        placeholder: "e.g. 1",
        expectedValue: 1,
        tolerancePercent: 0,
        explanation: "Exactly once - all 3 identical requests should resolve to the same single, already-completed charge, not 3 separate ones."
      },
      {
        id: "idempotency-latency-budget",
        prompt: "The platform processes transactions at an average request latency of 50ms. If the idempotency-key check can be at most 10% of that budget, what's the max acceptable added latency for the check?",
        unit: "ms",
        placeholder: "e.g. 5",
        expectedValue: 5,
        tolerancePercent: 20,
        explanation: "10% of 50ms = 5ms - why the idempotency check needs to be a fast key-value lookup, not a scan over historical transaction records."
      }
    ],
    tradeoff: {
      nodeId: "ledger_db",
      prompt: "How should every balance-changing event be recorded?",
      options: [
        {
          id: "append-ledger",
          label: "An append-only ledger: every transaction is a new, immutable row - balances are derived, never overwritten",
          correct: true,
          rationale: "Gives a complete, tamper-evident audit trail and makes replays/reconciliation possible - exactly what's needed for something that will eventually be disputed or audited."
        },
        {
          id: "mutable-balance",
          label: "A single mutable 'current balance' column per user, updated in place on every transaction",
          correct: false,
          rationale: "Overwriting a balance in place destroys the history of how it got there - no way to reconstruct what happened if a dispute or bug shows up later."
        },
        {
          id: "no-record",
          label: "Only record the final balance after the payment processor confirms - skip logging the attempt itself",
          correct: false,
          rationale: "Logging only success loses the ability to detect and safely retry failed or ambiguous attempts, like a processor timeout where you don't know if the charge went through."
        }
      ]
    },
    failureQuestions: [
      {
        id: "ambiguous-timeout",
        prompt: "The external payment processor times out - it's genuinely unclear whether the charge succeeded. What should the system do?",
        options: [
          { id: "retry-blind", label: "Assume it failed and immediately retry with a new charge attempt" },
          { id: "reconcile", label: "Record the ambiguous outcome in the ledger and reconcile later against the processor's own status, rather than blindly retrying" },
          { id: "assume-success", label: "Assume it succeeded and mark the wallet as funded" }
        ],
        correctOptionId: "reconcile",
        explanation: "Blindly retrying risks a double charge; blindly assuming success risks crediting a wallet that was never funded - the safe move is recording the uncertainty and reconciling against the processor's record of truth."
      },
      {
        id: "correctness-scaling",
        prompt: "At 10x normal transaction volume, which part of this design needs the most careful scaling, precisely because correctness (not just speed) is on the line?",
        options: [
          { id: "dispatcher", label: "The notification dispatcher, since a slow receipt email is low stakes" },
          { id: "idempotency-ledger", label: "The idempotency check and the ledger write, since money-moving correctness can't be relaxed even under load" },
          { id: "gateway", label: "The API gateway, since it does simple routing" }
        ],
        correctOptionId: "idempotency-ledger",
        explanation: "Everything downstream of the ledger can tolerate being slow or eventually-consistent under load - the idempotency check and ledger write are where a shortcut under pressure could directly mean money moving incorrectly."
      }
    ]
  },
  // ---------------------------------------------------------------------------------------
  // ML SYSTEM DESIGN / MLOPS
  // ---------------------------------------------------------------------------------------
  {
    id: "recommendation-system",
    title: "Design a Recommendation System",
    difficulty: "hard",
    companies: ["Netflix", "Amazon", "YouTube"],
    tags: ["ML", "Recommendation Systems", "Ranking"],
    summary: "Serve personalized item recommendations to hundreds of millions of users in real time.",
    statement:
      "Design a recommendation system like Netflix's or Amazon's: given a user, return a ranked list of items " +
      "(movies, products) they're likely to engage with, computed from a model trained on historical interactions, " +
      "served within a strict low-latency budget on every page load.",
    functionalRequirements: [
      "Return a ranked list of personalized item recommendations for a given user.",
      "Incorporate the user's recent interaction history and item metadata.",
      "Support periodic retraining as new interaction data accumulates."
    ],
    nonFunctionalRequirements: [
      "Serving latency must stay in the tens of milliseconds - this runs on every page load.",
      "The model version actually serving traffic must be easy to roll back if a new one regresses.",
      "Training data volume grows continuously and must not require reserving live-serving capacity."
    ],
    scaleNote: "Hundreds of millions of users, each requesting a fresh ranked list on nearly every page view.",
    rootComponentId: "client",
    nodes: [
      {
        id: "load_balancer",
        parentId: null,
        whyItFits: "Every recommendation request is distributed across app servers by a load balancer first, same as any other high-traffic API.",
        misplacedHint: "Recommendation requests still need to be spread across servers before anything else - the load balancer is the first hop."
      },
      {
        id: "web_server",
        parentId: "load_balancer",
        whyItFits: "The recommendation API server receives the request, gathers what it needs, and calls the model to get a ranked list.",
        misplacedHint: "Request handling and orchestration logic live on the app server, right behind the load balancer."
      },
      {
        id: "feature_store_online",
        parentId: "web_server",
        whyItFits:
          "The app server pulls the user's and candidate items' precomputed features (recent activity, embeddings) from a low-latency online " +
          "feature store - recomputing these from scratch per request would blow the latency budget.",
        misplacedHint: "Feature lookups happen on the app server's direct request path - the online feature store is a child of the app server, not of the model itself."
      },
      {
        id: "model_serving",
        parentId: "web_server",
        whyItFits: "The app server sends the gathered features to a dedicated model-serving endpoint, which scores and ranks the candidate items.",
        misplacedHint: "Scoring only happens after the app server has assembled the necessary features - the serving endpoint is a sibling of the feature store, both hanging off the app server."
      },
      {
        id: "feature_store_offline",
        parentId: "feature_store_online",
        whyItFits:
          "The online store is kept fresh by a periodic sync from the offline feature store, which holds the full historical feature values " +
          "computed in batch and used to train the model in the first place.",
        misplacedHint: "Historical feature computation feeds the online store's periodic refresh - it sits behind the online store, not directly behind the app server."
      },
      {
        id: "model_registry",
        parentId: "model_serving",
        whyItFits: "The serving endpoint loads whichever model version is currently marked 'production' from a versioned model registry - never a hardcoded file.",
        misplacedHint: "Model version lookup is something the serving endpoint does for itself - the registry is a direct dependency of model serving, not of the app server."
      },
      {
        id: "nosql_db",
        parentId: "web_server",
        whyItFits: "Item catalog metadata (title, genre, price) used to enrich and display the ranked results is queried directly by the app server.",
        misplacedHint: "Catalog metadata is queried by the app server assembling the response - it's a sibling of the feature store and model serving, not a child of either."
      }
    ],
    distractorIds: ["message_queue", "geo_service", "payment_processor", "trie_store", "transcoding_service"],
    keyTakeaways: [
      "Feature computation (often slow, batch) is decoupled from feature serving (must be fast) via an offline-to-online sync.",
      "A model registry - not a hardcoded file path - is what makes safe rollbacks and controlled rollouts possible.",
      "Item metadata and ML features are different concerns queried from different stores, even though both enrich the same response."
    ],
    estimationQuestions: [
      {
        id: "serving-qps",
        prompt: "200 million daily active users each view 20 pages/day that need a fresh recommendation list. What's the average serving QPS?",
        unit: "requests/sec",
        placeholder: "e.g. 46300",
        expectedValue: 46296,
        tolerancePercent: 35,
        explanation: "200,000,000 x 20 / 86,400 ~= 46,300 requests/sec on average - why the online feature store and serving endpoint both need to be built for low, predictable latency."
      },
      {
        id: "latency-budget",
        prompt: "If the whole page must render in 200ms and recommendations are one of 4 roughly-equal backend calls made in parallel, what's a reasonable latency budget for the recommendation call?",
        unit: "ms",
        placeholder: "e.g. 200",
        expectedValue: 200,
        tolerancePercent: 25,
        explanation: "Calls made in parallel share the same wall-clock budget rather than stacking - so the recommendation call still gets close to the full 200ms, not 200/4ms, as long as it isn't on a serial critical path."
      }
    ],
    tradeoff: {
      nodeId: "feature_store_online",
      prompt: "Where should the features used at prediction time actually be read from?",
      options: [
        {
          id: "online-store",
          label: "A dedicated low-latency online feature store, kept in sync with the offline store",
          correct: true,
          rationale: "Separates 'compute features' (can be slow, batch) from 'serve features' (must be fast), which is exactly what a real-time recommendation request needs."
        },
        {
          id: "recompute",
          label: "Recompute every feature from raw data on every single request",
          correct: false,
          rationale: "Recomputing aggregates like 'user's last 30 days of activity' from raw logs on every request would blow far past any reasonable serving latency budget."
        },
        {
          id: "same-as-offline",
          label: "Query the offline feature store (data warehouse) directly for every live request",
          correct: false,
          rationale: "Offline feature stores are optimized for large batch scans, not single-row point lookups under a tight latency budget - using it for live serving would be far too slow."
        }
      ]
    },
    failureQuestions: [
      {
        id: "new-model-regression",
        prompt: "A newly deployed model version quietly starts producing worse recommendations. What should limit the blast radius?",
        options: [
          { id: "no-protection", label: "Nothing - once deployed, a new model version serves 100% of traffic immediately" },
          { id: "canary", label: "A canary/shadow rollout that only serves the new version to a small slice of traffic before a full rollout" },
          { id: "manual-review", label: "Someone manually reviewing recommendations before every deploy" }
        ],
        correctOptionId: "canary",
        explanation: "A gradual, monitored rollout to a small slice of traffic is what catches a regression before it affects every user - manual review doesn't scale to how often models are updated."
      },
      {
        id: "feature-store-lag",
        prompt: "The offline-to-online feature sync falls badly behind schedule. What's the immediate impact?",
        options: [
          { id: "outage", label: "The recommendation system goes down entirely" },
          { id: "stale-features", label: "Recommendations keep serving, just based on staler features than intended, until the sync catches up" },
          { id: "wrong-users", label: "Recommendations get served to the wrong users" }
        ],
        correctOptionId: "stale-features",
        explanation: "The online store degrades gracefully to staleness, not unavailability - serving continues on whatever features it currently holds."
      }
    ]
  },

  {
    id: "feature-store",
    title: "Design a Real-Time Feature Store",
    difficulty: "hard",
    companies: ["Uber", "Airbnb", "DoorDash"],
    tags: ["MLOps", "Feature Engineering", "Data Infrastructure"],
    summary: "The shared pipeline that computes, stores, and serves ML features consistently for both training and live inference.",
    statement:
      "Design a feature store (Uber Michelangelo / Airbnb Zipline style): a central system that computes features from raw " +
      "event data, stores historical values for training, and serves the freshest values to live models at inference " +
      "time - guaranteeing training and serving see the exact same feature definitions.",
    functionalRequirements: [
      "Compute features from raw event data on a scheduled batch cadence.",
      "Serve the latest feature values to live models with low latency.",
      "Provide the full historical feature values needed to build training datasets."
    ],
    nonFunctionalRequirements: [
      "Training/serving skew (the two paths computing a feature differently) must be avoided by construction.",
      "Online reads need single-digit-millisecond latency; offline reads can tolerate much higher latency.",
      "New features should be addable without touching the online serving path's code."
    ],
    scaleNote: "Thousands of features, computed for millions of entities (users, drivers, restaurants), refreshed on a minutes-to-hours cadence.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Both live model requests and pipeline-management calls go through a single gateway into the feature store.",
        misplacedHint: "Every caller - a live model or a training pipeline - needs one stable entry point first, which is the API gateway."
      },
      {
        id: "feature_store_online",
        parentId: "api_gateway",
        whyItFits: "Live models read the current value of each feature from a low-latency online store - this direct, fast read path is the feature store's headline capability.",
        misplacedHint: "Real-time feature lookups are the gateway's most direct responsibility - the online store hangs right off it."
      },
      {
        id: "model_serving",
        parentId: "feature_store_online",
        whyItFits: "The primary consumer of the online store's fast reads is a model-serving layer, which needs features assembled in single-digit milliseconds to make a prediction.",
        misplacedHint: "Model serving is downstream of the online feature store's read path, not upstream of the gateway."
      },
      {
        id: "orchestrator",
        parentId: "api_gateway",
        whyItFits: "A pipeline orchestrator schedules the batch jobs that compute each feature from raw data on a recurring cadence.",
        misplacedHint: "Scheduling batch feature computation is a distinct concern from serving live reads - it's a sibling of the online store under the gateway."
      },
      {
        id: "data_lake",
        parentId: "orchestrator",
        whyItFits: "The orchestrator's batch jobs read raw historical events (clicks, trips, orders) from a data lake to compute each feature.",
        misplacedHint: "Raw event data is pulled in by the scheduled batch jobs the orchestrator runs - the data lake is a direct dependency of the orchestrator."
      },
      {
        id: "feature_store_offline",
        parentId: "orchestrator",
        whyItFits:
          "Computed historical feature values are written to an offline store, which is what training pipelines query to build point-in-time-correct training datasets.",
        misplacedHint: "Writing computed historical values is the last step of the orchestrator's batch job, not something the online store or gateway does directly."
      }
    ],
    distractorIds: ["cdn", "payment_processor", "geo_service", "trie_store", "notification_dispatcher"],
    keyTakeaways: [
      "The single biggest reason feature stores exist is to prevent training/serving skew - one feature definition, two read paths.",
      "Online (fast, fresh) and offline (historical, batch) storage have fundamentally different latency needs and are built as separate tiers.",
      "An orchestrator decouples 'when a feature gets recomputed' from 'how it's read' - new features are added without touching the serving path."
    ],
    estimationQuestions: [
      {
        id: "online-read-qps",
        prompt: "A ride-sharing platform makes 50,000 matching decisions/sec, and each decision reads 30 features. What's the online feature-read QPS?",
        unit: "reads/sec",
        placeholder: "e.g. 1500000",
        expectedValue: 1500000,
        tolerancePercent: 20,
        explanation: "50,000 x 30 = 1,500,000 feature reads/sec - a volume that rules out anything but an in-memory, horizontally-scaled online store."
      },
      {
        id: "offline-vs-online-latency",
        prompt: "If online reads must complete in 5ms but offline batch queries commonly take 10 minutes (600,000ms), roughly how many times slower is an acceptable offline read than an online one?",
        unit: "x slower",
        placeholder: "e.g. 120000",
        expectedValue: 120000,
        tolerancePercent: 30,
        explanation: "600,000ms / 5ms = 120,000x - illustrating just how differently the two storage tiers need to be engineered, despite serving the 'same' features."
      }
    ],
    tradeoff: {
      nodeId: "orchestrator",
      prompt: "How often should a typical behavioral feature (e.g. 'user's click count in the last hour') be recomputed?",
      options: [
        {
          id: "scheduled-batch",
          label: "On a fixed, scheduled cadence (e.g. every few minutes) via the orchestrator",
          correct: true,
          rationale: "A predictable, scheduled cadence keeps the compute cost bounded and the online store's freshness guarantee well-defined and testable."
        },
        {
          id: "on-every-request",
          label: "Recomputed live from raw events on every single inference request",
          correct: false,
          rationale: "Recomputing an aggregate like 'clicks in the last hour' from raw logs on every request would be far too slow and expensive to run at live-serving QPS."
        },
        {
          id: "never-again",
          label: "Computed once and never refreshed",
          correct: false,
          rationale: "Behavioral features are only useful because they reflect recent activity - a value that's never refreshed stops being predictive almost immediately."
        }
      ]
    },
    failureQuestions: [
      {
        id: "orchestrator-down",
        prompt: "The orchestrator's scheduled jobs stop running for several hours. What's the impact on live model predictions?",
        options: [
          { id: "predictions-stop", label: "Live predictions stop entirely" },
          { id: "staler-features", label: "Live predictions continue, but on features that are now several hours staler than intended" },
          { id: "training-corrupted", label: "All historical training data becomes corrupted" }
        ],
        correctOptionId: "staler-features",
        explanation: "The online store simply stops receiving fresh updates - serving continues on whatever it last had, just progressively staler until the orchestrator recovers."
      },
      {
        id: "skew",
        prompt: "A feature is computed with slightly different logic in the training pipeline than in the online serving path. What's the resulting risk?",
        options: [
          { id: "no-risk", label: "No risk, minor logic differences don't matter" },
          { id: "training-serving-skew", label: "Training/serving skew - the model learns on one definition of a feature but predicts on a subtly different one, silently hurting accuracy" },
          { id: "crash", label: "The serving system crashes immediately" }
        ],
        correctOptionId: "training-serving-skew",
        explanation: "This is exactly the failure mode a feature store is built to prevent - a single shared feature definition, computed once, is what keeps training and serving consistent."
      }
    ]
  },

  {
    id: "model-serving-platform",
    title: "Design a Model Serving Platform",
    difficulty: "hard",
    companies: ["Google", "Uber", "NVIDIA"],
    tags: ["MLOps", "Model Serving", "Deployment"],
    summary: "Host many trained models behind low-latency APIs, with safe, gradual rollouts of new versions.",
    statement:
      "Design a general-purpose model serving platform: teams deploy trained models to it, client applications call it " +
      "for real-time predictions, and a new model version can be rolled out gradually and rolled back instantly if it " +
      "regresses - without touching client application code.",
    functionalRequirements: [
      "Serve real-time predictions from a deployed model given input features.",
      "Support multiple concurrent model versions, with a safe path to shift traffic between them.",
      "Load whichever model artifact is marked as the current production version, without a redeploy."
    ],
    nonFunctionalRequirements: [
      "Prediction latency must stay low and predictable, even under load spikes.",
      "A bad model version must be rollback-able in seconds, not a full redeploy cycle.",
      "Every prediction should be loggable for later monitoring and debugging."
    ],
    scaleNote: "Hundreds of models in production simultaneously, serving a combined load in the tens of thousands of predictions/sec.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Every prediction request from any client application enters through one gateway, regardless of which model it's targeting.",
        misplacedHint: "Prediction requests need one common entry point first - the gateway routes to the right model from there."
      },
      {
        id: "canary_router",
        parentId: "api_gateway",
        whyItFits: "Right after the gateway, a canary/shadow router decides what fraction of traffic for a given model goes to the new version versus the stable one.",
        misplacedHint: "Traffic-splitting between model versions has to happen before a request reaches any specific serving instance - it sits directly behind the gateway."
      },
      {
        id: "model_serving",
        parentId: "canary_router",
        whyItFits: "The router forwards each request to an actual serving instance, which runs the loaded model and returns a prediction.",
        misplacedHint: "Serving instances only receive traffic after the canary router has decided which version to send it to."
      },
      {
        id: "model_registry",
        parentId: "model_serving",
        whyItFits: "Each serving instance loads its model artifact from a versioned registry rather than a hardcoded file - this is what makes 'current production version' a live, changeable pointer.",
        misplacedHint: "Model artifact lookup is the serving instance's own responsibility - the registry is a direct dependency of model serving, not of the router or gateway."
      },
      {
        id: "feature_store_online",
        parentId: "model_serving",
        whyItFits: "If the incoming request doesn't already carry all needed features, the serving instance fetches the rest from a low-latency online feature store.",
        misplacedHint: "Feature lookups happen inside the serving instance's own prediction flow, not before the canary router or gateway."
      },
      {
        id: "drift_monitor",
        parentId: "model_serving",
        whyItFits: "Every prediction (and the features behind it) is logged to a monitor that watches for distribution drift or accuracy degradation over time.",
        misplacedHint: "Prediction logging happens as a side effect of serving each request - the monitor is a direct child of model serving, not something upstream intercepts."
      }
    ],
    distractorIds: ["cdn", "payment_processor", "graph_store", "trie_store", "geo_service"],
    keyTakeaways: [
      "A model registry turns 'which model is live' into a controllable pointer instead of a deployment event.",
      "Canary/shadow routing is what makes gradual, reversible rollouts possible instead of an all-or-nothing switch.",
      "Serving logs prediction inputs and outputs by default - monitoring for drift only works if that data was captured in the first place."
    ],
    estimationQuestions: [
      {
        id: "serving-instances",
        prompt: "A model needs to serve 20,000 predictions/sec, and one serving instance handles 500 predictions/sec. How many instances are needed at minimum?",
        unit: "instances",
        placeholder: "e.g. 40",
        expectedValue: 40,
        tolerancePercent: 20,
        explanation: "20,000 / 500 = 40 instances minimum for that one model, before adding redundancy or canary-slice capacity."
      },
      {
        id: "canary-blast-radius",
        prompt: "A canary rollout sends 5% of traffic to a new model version. Out of 20,000 predictions/sec, how many predictions/sec hit the new version?",
        unit: "predictions/sec",
        placeholder: "e.g. 1000",
        expectedValue: 1000,
        tolerancePercent: 10,
        explanation: "20,000 x 5% = 1,000 predictions/sec - a small enough blast radius to catch a regression from monitoring before it affects most users."
      }
    ],
    tradeoff: {
      nodeId: "canary_router",
      prompt: "How should a brand new model version be rolled out to production traffic?",
      options: [
        {
          id: "gradual",
          label: "Gradually, starting with a small traffic percentage and increasing it as monitoring stays healthy",
          correct: true,
          rationale: "This bounds the damage a bad model can do and gives monitoring time to catch a regression before it's serving all traffic."
        },
        {
          id: "all-at-once",
          label: "Immediately switch 100% of traffic to the new version",
          correct: false,
          rationale: "Any regression in the new model - a bug, a bad training run - immediately affects every single user with no safety net."
        },
        {
          id: "manual-flag-flip",
          label: "Keep both versions running and let each client application manually choose which to call",
          correct: false,
          rationale: "This pushes rollout logic and risk onto every client team individually instead of centralizing it once in the serving platform, and doesn't give a single, controllable rollback switch."
        }
      ]
    },
    failureQuestions: [
      {
        id: "registry-down",
        prompt: "The model registry becomes temporarily unreachable. What's the impact on already-running serving instances?",
        options: [
          { id: "stop-serving", label: "They immediately stop serving predictions" },
          { id: "keep-serving", label: "They keep serving fine with whatever model they already loaded into memory; only new instance startups or version switches are blocked" },
          { id: "wrong-predictions", label: "They start returning predictions from the wrong model" }
        ],
        correctOptionId: "keep-serving",
        explanation: "A model, once loaded into a serving instance's memory, doesn't need the registry to keep serving - the registry is only consulted on startup or when switching versions."
      },
      {
        id: "regression-detected",
        prompt: "Monitoring flags a real accuracy regression in a canary version at 5% traffic. What's the correct immediate response?",
        options: [
          { id: "increase-traffic", label: "Increase its traffic share to gather more data before deciding" },
          { id: "roll-back", label: "Route 100% of traffic back to the stable version - the canary mechanism exists precisely so this is a fast, low-risk switch" },
          { id: "ignore", label: "Ignore it since only 5% of traffic was affected" }
        ],
        correctOptionId: "roll-back",
        explanation: "The entire point of canarying is to catch this cheaply and revert fast - a confirmed regression should trigger an immediate rollback, not more exposure."
      }
    ]
  },

  {
    id: "distributed-training-pipeline",
    title: "Design a Distributed Model Training Pipeline",
    difficulty: "hard",
    companies: ["OpenAI", "Google", "Meta"],
    tags: ["MLOps", "Distributed Training", "Infrastructure"],
    summary: "Turn raw data into a versioned, reproducible model artifact using a cluster of GPU/TPU workers.",
    statement:
      "Design the pipeline that takes raw training data and produces a trained, versioned model artifact: scheduling a " +
      "distributed training job across many GPU/TPU workers, tracking every run's metrics and hyperparameters, and " +
      "registering the final artifact for downstream serving.",
    functionalRequirements: [
      "Kick off a distributed training job across many worker machines from a single request.",
      "Record metrics, hyperparameters, and code/data versions for every training run.",
      "Register a completed training run's output artifact so it can be deployed."
    ],
    nonFunctionalRequirements: [
      "A training run must be reproducible - the same inputs should be able to produce a comparable result later.",
      "GPU/TPU worker time is expensive - the pipeline shouldn't leave a cluster idle or a job unschedulable due to contention.",
      "A crashed worker mid-training shouldn't force the entire job to restart from scratch."
    ],
    scaleNote: "Training jobs can run for hours to weeks across hundreds of GPU/TPU workers.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "An ML engineer submits a training job request through a single entry point, regardless of which team or project it belongs to.",
        misplacedHint: "Job submission needs one stable entry point before anything gets scheduled - that's the API gateway."
      },
      {
        id: "orchestrator",
        parentId: "api_gateway",
        whyItFits: "The orchestrator is responsible for scheduling the job: allocating workers, sequencing pipeline steps (data prep, training, evaluation), and retrying failed steps.",
        misplacedHint: "Scheduling and sequencing the multi-step pipeline is the orchestrator's job, sitting right behind the gateway."
      },
      {
        id: "data_lake",
        parentId: "orchestrator",
        whyItFits: "The orchestrator's first pipeline step reads the raw (and already feature-engineered) training data from a data lake.",
        misplacedHint: "Pulling in training data is a scheduled pipeline step the orchestrator kicks off - it's a direct dependency of the orchestrator."
      },
      {
        id: "training_cluster",
        parentId: "orchestrator",
        whyItFits: "The orchestrator hands the actual distributed training work to a cluster of GPU/TPU workers, which run the training job in parallel and checkpoint progress periodically.",
        misplacedHint: "The compute-heavy training step is scheduled by the orchestrator - the cluster is a direct dependency of it, not something the data lake or gateway touches."
      },
      {
        id: "experiment_tracker",
        parentId: "training_cluster",
        whyItFits: "As training runs, the cluster logs metrics, hyperparameters, and dataset/code versions to an experiment tracker, so this run can be compared against others and reproduced later.",
        misplacedHint: "Metrics and hyperparameters are logged directly by the training job as it runs - the tracker is a child of the training cluster."
      },
      {
        id: "model_registry",
        parentId: "training_cluster",
        whyItFits: "Once training finishes, the resulting model artifact is registered in a versioned model registry, ready for a serving platform to pick up.",
        misplacedHint: "Registering the finished artifact is the last step of the training job itself, not something the orchestrator or data lake does independently."
      }
    ],
    distractorIds: ["cdn", "message_queue", "payment_processor", "trie_store", "geo_service"],
    keyTakeaways: [
      "An orchestrator separates 'what steps does this pipeline have' from 'how much compute does each step need' - each step scales independently.",
      "Experiment tracking exists precisely because training runs are expensive - losing the ability to compare or reproduce a run wastes that cost.",
      "Training produces an artifact; the model registry is the handoff point to whatever serves it - training and serving are deliberately decoupled systems."
    ],
    estimationQuestions: [
      {
        id: "training-time",
        prompt: "A model requires 800 GPU-hours of compute total. Using a cluster of 100 GPUs running in parallel (ignoring communication overhead), how many wall-clock hours would training take?",
        unit: "hours",
        placeholder: "e.g. 8",
        expectedValue: 8,
        tolerancePercent: 15,
        explanation: "800 GPU-hours / 100 GPUs = 8 hours - the basic math behind why distributing training across more workers shortens wall-clock time (real overhead from synchronization makes it somewhat more than this)."
      },
      {
        id: "checkpoint-loss",
        prompt: "Training checkpoints every 30 minutes. If a worker crashes and the job restarts from the last checkpoint instead of from scratch after 6 hours of progress, how many minutes of work are lost at most?",
        unit: "minutes",
        placeholder: "e.g. 30",
        expectedValue: 30,
        tolerancePercent: 10,
        explanation: "At most 30 minutes of progress is lost (the gap since the last checkpoint) - versus losing all 6 hours if there were no checkpointing at all."
      }
    ],
    tradeoff: {
      nodeId: "training_cluster",
      prompt: "How should a long-running distributed training job handle a single worker crashing partway through?",
      options: [
        {
          id: "checkpoint-resume",
          label: "Periodically checkpoint progress and resume from the last checkpoint after a crash",
          correct: true,
          rationale: "This bounds the lost work to the interval since the last checkpoint instead of losing the entire job - essential when a single run can take days."
        },
        {
          id: "restart-from-scratch",
          label: "Restart the entire training job from the very beginning",
          correct: false,
          rationale: "Losing potentially days of expensive GPU compute to one worker's hardware failure is an unacceptable cost at this scale."
        },
        {
          id: "ignore-crash",
          label: "Just drop that worker's results and continue without it",
          correct: false,
          rationale: "Silently continuing with a missing worker's gradient updates can silently corrupt the training run's correctness rather than just its speed."
        }
      ]
    },
    failureQuestions: [
      {
        id: "tracker-down",
        prompt: "The experiment tracker is temporarily unreachable while a training job is running. What should happen?",
        options: [
          { id: "training-halts", label: "Training halts immediately since it can't log metrics" },
          { id: "training-continues", label: "Training continues (buffering or dropping some logs); losing some observability is far cheaper than losing the training run itself" },
          { id: "restart", label: "The job restarts from scratch" }
        ],
        correctOptionId: "training-continues",
        explanation: "Metric logging is a secondary concern to the actual training progress - a tracker outage should degrade observability, not availability of the (expensive) training job."
      },
      {
        id: "data-lake-slow",
        prompt: "The data lake read for a new training job is unusually slow due to a spike in unrelated traffic. What's most directly affected?",
        options: [
          { id: "gpu-idle", label: "The GPU cluster sits idle waiting for data, wasting expensive compute-hours" },
          { id: "wrong-model", label: "The wrong model gets trained" },
          { id: "registry-corrupted", label: "The model registry becomes corrupted" }
        ],
        correctOptionId: "gpu-idle",
        explanation: "GPU/TPU time is the most expensive resource in this pipeline - any slowness in getting data to the cluster translates directly into idle, wasted compute spend."
      }
    ]
  },

  {
    id: "ab-testing-platform",
    title: "Design an ML A/B Testing Platform",
    difficulty: "hard",
    companies: ["Netflix", "Microsoft", "Airbnb"],
    tags: ["ML", "Experimentation", "A/B Testing"],
    summary: "Reliably bucket users into experiment variants and measure which one actually performs better.",
    statement:
      "Design a platform that lets product and ML teams run controlled experiments: deterministically assign each " +
      "user to a variant (control or treatment), log what they experienced and what they did, and produce a " +
      "trustworthy comparison of outcomes between variants.",
    functionalRequirements: [
      "Given a user and an experiment, deterministically return the same variant assignment every time.",
      "Log which variant a user was exposed to and what outcome events followed.",
      "Support many concurrent, independent experiments without them interfering with each other."
    ],
    nonFunctionalRequirements: [
      "The same user must always get the same variant for a given experiment (consistent assignment).",
      "Assignment must add negligible latency to the request path it's embedded in.",
      "Experiment results must be reproducible and auditable - no silently reshuffling who's in which group."
    ],
    scaleNote: "Thousands of concurrent experiments, each needing a stable assignment for tens of millions of users.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Any service that needs an experiment assignment or wants to log an outcome event calls in through a single gateway.",
        misplacedHint: "Both assignment lookups and outcome-event logging need one common entry point first."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits: "The experimentation service handles assignment requests and outcome logging, and owns the definitions of what experiments currently exist.",
        misplacedHint: "Core experiment logic lives on the service behind the gateway, not inside the assignment or logging components themselves."
      },
      {
        id: "ab_assignment_service",
        parentId: "web_server",
        whyItFits: "A dedicated assignment service deterministically hashes (user ID + experiment ID) into a variant bucket, guaranteeing the same user always lands in the same group.",
        misplacedHint: "Variant assignment is a distinct, hash-based computation the service delegates to - it's a direct child of the experimentation service."
      },
      {
        id: "sql_db",
        parentId: "web_server",
        whyItFits: "Experiment definitions (which variants exist, what traffic percentage each gets, start/end dates) need transactional consistency and are stored relationally.",
        misplacedHint: "Experiment configuration is managed directly by the experimentation service - it's a sibling of the assignment service, not a child of it."
      },
      {
        id: "cache",
        parentId: "ab_assignment_service",
        whyItFits: "Since assignment must add negligible latency, the assignment service caches the deterministic hash result so repeat lookups for the same user/experiment are instant.",
        misplacedHint: "Caching the assignment result is an optimization of the assignment service's own read path, not something the experiment-config database provides."
      },
      {
        id: "message_queue",
        parentId: "web_server",
        whyItFits: "Every exposure and outcome event is enqueued rather than written synchronously, since experiment logging shouldn't add latency to the user-facing request that triggered it.",
        misplacedHint: "Event logging is decoupled from the request path via a queue, fed directly by the experimentation service handling that request."
      },
      {
        id: "nosql_db",
        parentId: "message_queue",
        whyItFits: "A worker consumes the queue and writes exposure/outcome events into a horizontally-scalable store built for the write volume of every experiment interaction, ready for later analysis.",
        misplacedHint: "Raw event storage is where the queued events ultimately land - it's downstream of the queue, not something the assignment service writes to directly."
      }
    ],
    distractorIds: ["cdn", "geo_service", "transcoding_service", "payment_processor", "trie_store"],
    keyTakeaways: [
      "Deterministic hashing (not randomness or a database lookup) is what makes assignment both fast and consistent for a given user.",
      "Experiment configuration (rarely changes, needs consistency) and event logging (huge volume, can be async) are different workloads with different stores.",
      "Logging is queued off the request path so measuring an experiment never slows down the experience being measured."
    ],
    estimationQuestions: [
      {
        id: "event-volume",
        prompt: "50 million daily active users each generate 5 exposure/outcome events per day across all running experiments. What's the average event-write QPS?",
        unit: "events/sec",
        placeholder: "e.g. 2900",
        expectedValue: 2894,
        tolerancePercent: 30,
        explanation: "50,000,000 x 5 / 86,400 ~= 2,900 events/sec on average - manageable for a queue plus horizontally-scalable store, but not for a single relational database at sustained peak."
      },
      {
        id: "sample-size",
        prompt: "An experiment needs 200,000 users per variant to detect a meaningful difference, split 50/50 between 2 variants. How many total users need to be enrolled?",
        unit: "users",
        placeholder: "e.g. 400000",
        expectedValue: 400000,
        tolerancePercent: 5,
        explanation: "200,000 per variant x 2 variants = 400,000 total users needed before the experiment has enough data to draw a reliable conclusion."
      }
    ],
    tradeoff: {
      nodeId: "ab_assignment_service",
      prompt: "How should a user be assigned to a variant within an experiment?",
      options: [
        {
          id: "deterministic-hash",
          label: "A deterministic hash of (user ID, experiment ID) mapped into a bucket range",
          correct: true,
          rationale: "The same input always produces the same output with no storage required per assignment, and different experiments naturally get independent, uncorrelated bucketing."
        },
        {
          id: "random-per-request",
          label: "A fresh random choice on every request",
          correct: false,
          rationale: "A user would land in a different variant every time they're checked, making it impossible to measure a consistent experience's effect on their behavior."
        },
        {
          id: "db-lookup",
          label: "Store every user's assignment in a database row, written the first time they're seen",
          correct: false,
          rationale: "Works correctness-wise, but adds a write and a lookup per new user per experiment - unnecessary overhead when a deterministic hash gives the same guarantee for free."
        }
      ]
    },
    failureQuestions: [
      {
        id: "queue-down",
        prompt: "The event-logging queue goes down for 10 minutes during a live experiment. What's the impact?",
        options: [
          { id: "assignment-breaks", label: "User variant assignment breaks" },
          { id: "events-lost", label: "Some exposure/outcome events from that window may be delayed or lost, but user-facing assignment is completely unaffected since it doesn't depend on the queue" },
          { id: "experiment-invalid", label: "The entire experiment must be discarded" }
        ],
        correctOptionId: "events-lost",
        explanation: "Assignment is a synchronous, self-contained hash computation - only the asynchronous analytics logging path depends on the queue, so a brief outage there is a data-quality issue, not an outage of the experiment itself."
      },
      {
        id: "hash-collision-experiments",
        prompt: "Two unrelated experiments happen to bucket the same user into 'treatment' for both. Is this a problem?",
        options: [
          { id: "bug", label: "Yes, this is always a bug that needs fixing" },
          { id: "expected", label: "Not necessarily - independent hashing per experiment ID means each experiment's bucketing is uncorrelated with the others, which is the intended, statistically sound behavior" },
          { id: "reassign", label: "The user should be immediately reassigned to avoid overlap" }
        ],
        correctOptionId: "expected",
        explanation: "Using the experiment ID as part of the hash input is exactly what makes different experiments' assignments independent of each other - some overlap is expected and statistically fine, not a bug."
      }
    ]
  },

  {
    id: "fraud-detection-system",
    title: "Design a Real-Time Fraud Detection System",
    difficulty: "hard",
    companies: ["PayPal", "Stripe", "Visa"],
    tags: ["ML", "Fraud Detection", "Real-time"],
    summary: "Score every transaction for fraud risk in milliseconds, using features computed from a live event stream.",
    statement:
      "Design a real-time fraud detection system for a payments platform: every transaction must be scored for fraud " +
      "risk within a tight latency budget, using both the transaction's own details and features aggregated from the " +
      "user's recent transaction history.",
    functionalRequirements: [
      "Score every incoming transaction for fraud risk before it's approved.",
      "Incorporate real-time behavioral features (e.g. transaction velocity in the last few minutes).",
      "Durably record every transaction and its fraud decision for audits and disputes."
    ],
    nonFunctionalRequirements: [
      "Scoring latency must be low enough to not noticeably delay a legitimate transaction.",
      "Recent transaction history must be aggregated in near real-time, not on a daily batch cadence.",
      "Every decision must be auditable after the fact, including which features drove it."
    ],
    scaleNote: "Tens of thousands of transactions/sec at peak, each needing a scoring decision in well under 100ms.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Every transaction request enters through a single gateway before any fraud scoring or processing happens.",
        misplacedHint: "The transaction request needs one stable entry point first, before fraud scoring or anything else runs."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits: "The transaction service coordinates the whole flow: it durably records the transaction and asks the fraud model for a risk score before approving it.",
        misplacedHint: "Coordinating the transaction flow is this service's job, right behind the gateway - not something the model or ledger do independently."
      },
      {
        id: "ledger_db",
        parentId: "web_server",
        whyItFits: "Every transaction is durably recorded in an auditable ledger, independent of what the fraud model decides - a hard requirement for a payments platform.",
        misplacedHint: "Recording the transaction is the transaction service's own responsibility, a sibling of the fraud-scoring path, not a child of the model."
      },
      {
        id: "message_queue",
        parentId: "web_server",
        whyItFits: "Each transaction event is also published to a stream so behavioral features (like recent transaction velocity) can be aggregated in near real-time.",
        misplacedHint: "Publishing the event for stream aggregation happens right when the transaction service handles the request - it's a direct child of that service."
      },
      {
        id: "stream_processor",
        parentId: "message_queue",
        whyItFits: "A stream processor consumes the transaction event stream and continuously aggregates behavioral features (velocity, recent locations) per user.",
        misplacedHint: "Stream aggregation only happens after events are published to the stream - it's downstream of the queue, not called directly by the transaction service."
      },
      {
        id: "feature_store_online",
        parentId: "stream_processor",
        whyItFits: "The stream processor writes its freshly-aggregated behavioral features into a low-latency online feature store, ready for the fraud model to read at scoring time.",
        misplacedHint: "Writing aggregated features is the stream processor's output step - the online store is downstream of it, not something the model writes to directly."
      },
      {
        id: "model_serving",
        parentId: "web_server",
        whyItFits: "The transaction service calls a model-serving endpoint (reading from the online feature store internally) to get a real-time fraud risk score.",
        misplacedHint: "Scoring is requested directly by the transaction service as part of handling the transaction - it's a sibling of the ledger and the queue, not nested under either."
      },
      {
        id: "model_registry",
        parentId: "model_serving",
        whyItFits: "The serving endpoint loads the currently-approved fraud model version from a registry, so a bad model can be rolled back instantly without touching the transaction service.",
        misplacedHint: "Model version lookup is the serving endpoint's own concern - the registry is a direct dependency of model serving."
      }
    ],
    distractorIds: ["cdn", "trie_store", "geo_service", "transcoding_service", "search_index"],
    keyTakeaways: [
      "Recording the transaction (ledger) and scoring it for fraud are parallel concerns - a fraud-model outage should never block the durable record of what happened.",
      "Real-time behavioral features need a streaming pipeline, not a nightly batch job - fraud patterns shift in minutes, not days.",
      "As with any serving system, a model registry is what makes rolling back a bad fraud model fast and safe."
    ],
    estimationQuestions: [
      {
        id: "scoring-qps",
        prompt: "The platform processes 30,000 transactions/sec at peak, and each one needs a fraud score. What's the required scoring throughput?",
        unit: "scores/sec",
        placeholder: "e.g. 30000",
        expectedValue: 30000,
        tolerancePercent: 10,
        explanation: "Every transaction needs exactly one score, so scoring throughput has to match transaction throughput 1:1 - 30,000 scores/sec at peak."
      },
      {
        id: "latency-tax",
        prompt: "If the whole transaction must complete in 300ms and fraud scoring is one sequential step in that path taking 40ms, what percentage of the total budget does scoring consume?",
        unit: "%",
        placeholder: "e.g. 13",
        expectedValue: 13.3,
        tolerancePercent: 20,
        explanation: "40ms / 300ms ~= 13% of the total transaction latency budget - a meaningful enough slice that scoring latency is a first-class design constraint, not an afterthought."
      }
    ],
    tradeoff: {
      nodeId: "stream_processor",
      prompt: "How should 'this user's transaction velocity in the last 5 minutes' be computed for use in fraud scoring?",
      options: [
        {
          id: "streaming-agg",
          label: "Continuously aggregated by a stream processor as transaction events arrive",
          correct: true,
          rationale: "Fraud patterns can develop in minutes - a streaming aggregation keeps this feature close to real-time, exactly when it matters most for catching an attack in progress."
        },
        {
          id: "nightly-batch",
          label: "Computed once per night from the previous day's transaction logs",
          correct: false,
          rationale: "A fraud burst happening right now wouldn't show up in this feature until the next day's batch job - far too late to prevent the fraud it's meant to catch."
        },
        {
          id: "no-history",
          label: "Don't use recent history at all - only score based on the current transaction's own fields",
          correct: false,
          rationale: "Velocity and pattern-based signals (many transactions in a short window, unusual sequences) are some of the strongest fraud indicators - ignoring recent history throws away a lot of signal."
        }
      ]
    },
    failureQuestions: [
      {
        id: "model-serving-down",
        prompt: "The fraud model-serving endpoint becomes temporarily unavailable. What should the transaction service do?",
        options: [
          { id: "block-all", label: "Block every transaction until scoring is back" },
          { id: "fallback-policy", label: "Fall back to a simpler rules-based check (or a conservative default) so legitimate transactions aren't all blocked by an ML outage" },
          { id: "approve-all", label: "Approve every transaction with no check at all" }
        ],
        correctOptionId: "fallback-policy",
        explanation: "Blocking every transaction over an ML-serving outage is too costly, but approving everything with zero checks is too risky - a simpler fallback policy is the pragmatic middle ground."
      },
      {
        id: "stream-lag",
        prompt: "The stream processor falls behind and behavioral features are now several minutes stale. What's the biggest risk?",
        options: [
          { id: "none", label: "None, since the transaction still gets scored" },
          { id: "missed-burst", label: "A fast-moving fraud burst (many transactions in the last minute) might not be reflected yet, letting some fraudulent transactions score as lower-risk than they actually are" },
          { id: "ledger-corrupted", label: "The transaction ledger becomes corrupted" }
        ],
        correctOptionId: "missed-burst",
        explanation: "The whole point of real-time behavioral features is catching in-progress patterns - staleness specifically undermines the fastest-moving, most time-sensitive fraud signals."
      }
    ]
  },

  {
    id: "vector-search-engine",
    title: "Design a Semantic (Vector) Search Engine",
    difficulty: "hard",
    companies: ["Google", "Pinecone", "Spotify"],
    tags: ["ML", "Search", "Embeddings"],
    summary: "Find the most semantically similar items to a query, not just ones that share exact keywords.",
    statement:
      "Design a semantic search engine: given a text query, return the most semantically similar documents/items from a " +
      "large corpus, using vector embeddings and approximate nearest-neighbor search rather than exact keyword " +
      "matching.",
    functionalRequirements: [
      "Convert an incoming query into a vector embedding.",
      "Retrieve the most similar item vectors from a large, pre-indexed corpus.",
      "Support adding new items to the searchable index without a full rebuild each time."
    ],
    nonFunctionalRequirements: [
      "Search latency must stay low even as the corpus grows to hundreds of millions of items.",
      "Nearest-neighbor search must be approximate (not exact) to stay fast at this scale, trading a little recall for speed.",
      "The embedding model used at query time must always match the one used to build the index."
    ],
    scaleNote: "Hundreds of millions of indexed items, each represented as a several-hundred-dimension vector.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Every search query enters through a single gateway before it's turned into a vector or matched against the index.",
        misplacedHint: "The query needs one stable entry point first, before any embedding or vector lookup happens."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits: "The search service coordinates the flow: turn the query into a vector, look up nearest neighbors, then assemble the response.",
        misplacedHint: "Coordinating the search flow is this service's job, right behind the gateway - not something the embedding step or vector index do on their own."
      },
      {
        id: "embedding_service",
        parentId: "web_server",
        whyItFits: "The search service first sends the raw query text to an embedding service, which converts it into the same vector space the corpus was indexed in.",
        misplacedHint: "Converting the query into a vector is the very first step the search service delegates - the embedding service is a direct child of it."
      },
      {
        id: "model_registry",
        parentId: "embedding_service",
        whyItFits: "The embedding service loads its model version from a registry, so the query-time embedding model can never silently drift from the one used to build the index.",
        misplacedHint: "Model version lookup for the embedding step is the embedding service's own concern, not the search service's or the vector database's."
      },
      {
        id: "vector_db",
        parentId: "web_server",
        whyItFits: "The search service takes the resulting query vector and asks a vector database to find the most similar item vectors using approximate nearest-neighbor search.",
        misplacedHint: "Nearest-neighbor lookup happens after the query has already been embedded - the vector database is a sibling of the embedding service, both hanging off the search service."
      },
      {
        id: "object_storage",
        parentId: "vector_db",
        whyItFits: "Because rebuilding a huge approximate-nearest-neighbor index from scratch is expensive, the vector database periodically snapshots its index structure to durable storage for fast recovery.",
        misplacedHint: "Index snapshotting is the vector database's own durability mechanism - it sits behind the vector database, not behind the search service directly."
      }
    ],
    distractorIds: ["message_queue", "payment_processor", "geo_service", "notification_dispatcher", "cdn"],
    keyTakeaways: [
      "Query-time and index-time embeddings must come from the exact same model version, or 'similar' vectors stop meaning anything.",
      "Approximate (not exact) nearest-neighbor search is the deliberate tradeoff that keeps latency low at hundreds of millions of vectors.",
      "The embedding step and the nearest-neighbor lookup are separable concerns handled by different specialized components."
    ],
    estimationQuestions: [
      {
        id: "index-size",
        prompt: "100 million items are each represented as a 768-dimension float32 vector. Roughly how much storage does the raw vector index need?",
        unit: "GB",
        placeholder: "e.g. 307",
        expectedValue: 307,
        tolerancePercent: 20,
        explanation: "100,000,000 x 768 dims x 4 bytes/float ~= 307 GB - before any additional index structure overhead, which is why ANN index memory footprint is a real capacity-planning concern."
      },
      {
        id: "exact-scan-infeasible",
        prompt: "If comparing a query vector against one item vector takes roughly 1 microsecond, how many milliseconds would an exact linear scan over 100 million items take?",
        unit: "ms",
        placeholder: "e.g. 100000",
        expectedValue: 100000,
        tolerancePercent: 15,
        explanation: "100,000,000 x 1 microsecond = 100,000 ms (100 seconds) - wildly too slow for live search, which is exactly why approximate nearest-neighbor indexing (not brute force) is required at this scale."
      }
    ],
    tradeoff: {
      nodeId: "vector_db",
      prompt: "How should nearest-neighbor search be performed against 100 million+ item vectors?",
      options: [
        {
          id: "ann-index",
          label: "An approximate nearest-neighbor index (e.g. HNSW or IVF-based)",
          correct: true,
          rationale: "Trades a small amount of recall for dramatically faster lookups, which is the only way to keep latency low at hundreds of millions of vectors."
        },
        {
          id: "exact-scan",
          label: "An exact brute-force comparison against every vector in the corpus",
          correct: false,
          rationale: "Exact search guarantees the true nearest neighbors but scales linearly with corpus size - completely infeasible in real time at this scale."
        },
        {
          id: "keyword-only",
          label: "Fall back to plain keyword matching instead of vector similarity",
          correct: false,
          rationale: "Keyword matching misses the entire point of semantic search - it can't find results that are conceptually similar but share no exact words with the query."
        }
      ]
    },
    failureQuestions: [
      {
        id: "model-mismatch",
        prompt: "The embedding model is silently upgraded to a new version for live queries, but the corpus index was never re-embedded with it. What happens?",
        options: [
          { id: "fine", label: "Nothing, embeddings are always compatible across model versions" },
          { id: "meaningless-results", label: "Search quality silently degrades or becomes meaningless, since query vectors and index vectors now live in different, incompatible vector spaces" },
          { id: "crash", label: "The search service crashes immediately" }
        ],
        correctOptionId: "meaningless-results",
        explanation: "Different embedding model versions generally produce vector spaces that aren't directly comparable - this is exactly why the embedding service's model version is pinned via the registry."
      },
      {
        id: "vector-db-down",
        prompt: "The vector database becomes temporarily unavailable. What's the most direct impact?",
        options: [
          { id: "embedding-fails", label: "Query embedding itself fails" },
          { id: "no-results", label: "Search requests can't retrieve any nearest-neighbor results, even though the query was successfully embedded" },
          { id: "index-corrupted", label: "The underlying corpus data is permanently lost" }
        ],
        correctOptionId: "no-results",
        explanation: "The vector database is the component actually holding the searchable index - its outage blocks retrieval specifically, independent of whether embedding itself still works."
      }
    ]
  },

  {
    id: "llm-inference-serving",
    title: "Design an LLM Inference Serving System",
    difficulty: "hard",
    companies: ["OpenAI", "Anthropic", "Google"],
    tags: ["ML", "LLM", "Inference"],
    summary: "Serve large language model completions at scale, under tight cost and GPU-capacity constraints.",
    statement:
      "Design a serving system for a large language model (like a ChatGPT-style API): accept a prompt, generate a " +
      "completion using an expensive GPU-backed model, and do it for a huge number of concurrent users without " +
      "either bankrupting the GPU budget or making everyone wait in a slow queue.",
    functionalRequirements: [
      "Accept a prompt and return a generated completion.",
      "Support many concurrent requests without each one monopolizing a whole GPU.",
      "Protect the platform from any single user or client consuming disproportionate GPU capacity."
    ],
    nonFunctionalRequirements: [
      "GPU capacity is the platform's scarcest, most expensive resource and must be used efficiently (batching, not one-request-per-GPU).",
      "Latency to the first generated token matters as much as total completion time for a good user experience.",
      "A bad or oversized request from one client shouldn't degrade service for everyone else."
    ],
    scaleNote: "Generation is far slower and more expensive per request than a typical API call - GPU capacity, not raw request count, is usually the binding constraint.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Every prompt request enters through a single gateway that handles auth and routing before any GPU capacity is touched.",
        misplacedHint: "Auth and routing happen before any expensive GPU work starts - the gateway is the first hop, not something behind the rate limiter."
      },
      {
        id: "rate_limiter_service",
        parentId: "api_gateway",
        whyItFits:
          "Because GPU capacity is scarce and expensive, a rate limiter enforces per-client quotas right after the gateway, before a request can consume any generation capacity.",
        misplacedHint: "Rate limiting has to happen before a request reaches the GPU-backed serving layer - it sits directly behind the gateway, protecting everything downstream."
      },
      {
        id: "model_serving",
        parentId: "rate_limiter_service",
        whyItFits: "Requests that pass the rate limiter reach the model-serving layer, which batches concurrent requests together to use GPU capacity efficiently and generates the completion.",
        misplacedHint: "Only requests that have already passed the rate limiter should reach the GPU-backed serving layer - it sits behind the limiter, not in front of it."
      },
      {
        id: "model_registry",
        parentId: "model_serving",
        whyItFits: "The serving layer loads the specific model checkpoint/version it's meant to run from a registry, keeping which model is live a controllable, versioned choice.",
        misplacedHint: "Model checkpoint lookup is the serving layer's own responsibility - the registry is a direct dependency of model serving."
      },
      {
        id: "cache",
        parentId: "model_serving",
        whyItFits: "Repeated or overlapping prompt prefixes can reuse cached intermediate computation instead of recomputing it from scratch, meaningfully cutting cost and latency for common patterns.",
        misplacedHint: "Reusing prior computation is an optimization inside the serving layer's own generation path, not something the rate limiter or gateway does."
      },
      {
        id: "message_queue",
        parentId: "model_serving",
        whyItFits:
          "Because generation is slow and GPU batches fill up, incoming requests queue briefly for the next available batch slot rather than each grabbing a dedicated GPU.",
        misplacedHint: "Queuing for a batch slot is how the serving layer manages GPU contention internally - it's a child of model serving, not something upstream of it."
      }
    ],
    distractorIds: ["cdn", "geo_service", "graph_store", "payment_processor", "trie_store"],
    keyTakeaways: [
      "Rate limiting sits in front of the GPU-backed serving layer specifically because GPU capacity - not request count - is the resource actually worth protecting.",
      "Batching many concurrent requests onto shared GPU capacity (rather than one GPU per request) is what makes serving at scale affordable.",
      "A model registry keeps 'which checkpoint is live' controllable and reversible, exactly as it would for any other serving system."
    ],
    estimationQuestions: [
      {
        id: "gpu-count",
        prompt: "The platform needs to serve 10,000 concurrent generation requests, and one GPU (with batching) can handle 50 concurrent requests. How many GPUs are needed at minimum?",
        unit: "GPUs",
        placeholder: "e.g. 200",
        expectedValue: 200,
        tolerancePercent: 20,
        explanation: "10,000 / 50 = 200 GPUs minimum for that concurrency level, before redundancy - illustrating why batching efficiency directly determines infrastructure cost."
      },
      {
        id: "token-latency",
        prompt: "A completion averages 300 tokens, generated at 30 tokens/sec. Roughly how many seconds does one full completion take?",
        unit: "seconds",
        placeholder: "e.g. 10",
        expectedValue: 10,
        tolerancePercent: 15,
        explanation: "300 tokens / 30 tokens/sec = 10 seconds - much slower than a typical API call, which is why time-to-first-token (not just total latency) matters so much for perceived responsiveness."
      }
    ],
    tradeoff: {
      nodeId: "model_serving",
      prompt: "How should the serving layer use its GPU capacity across many concurrent requests?",
      options: [
        {
          id: "batching",
          label: "Dynamically batch multiple concurrent requests together onto shared GPU capacity",
          correct: true,
          rationale: "GPUs are dramatically more cost-efficient when processing many requests in parallel batches rather than one at a time - the standard approach for affordable LLM serving at scale."
        },
        {
          id: "one-gpu-per-request",
          label: "Dedicate one full GPU to each individual request until it completes",
          correct: false,
          rationale: "This wastes the vast majority of each GPU's capacity on most requests and would require an enormous, cost-prohibitive GPU fleet to serve meaningful concurrency."
        },
        {
          id: "cpu-fallback",
          label: "Run generation on CPU instead of GPU to avoid GPU capacity constraints entirely",
          correct: false,
          rationale: "CPU inference for a large language model is orders of magnitude slower - this would make latency far worse, not solve the capacity problem."
        }
      ]
    },
    failureQuestions: [
      {
        id: "no-rate-limit",
        prompt: "One client accidentally sends a very high rate of generation requests. Without a rate limiter, what's the risk?",
        options: [
          { id: "no-risk", label: "No risk, GPUs can always be added on demand" },
          { id: "starve-others", label: "That one client can consume a disproportionate share of GPU batching capacity, degrading latency for every other client" },
          { id: "model-corrupts", label: "The model weights become corrupted" }
        ],
        correctOptionId: "starve-others",
        explanation: "GPU capacity is shared and finite - without per-client limits, one misbehaving or unusually heavy client can starve everyone else sharing the same batching pool."
      },
      {
        id: "registry-rollback",
        prompt: "A newly deployed model checkpoint starts producing noticeably worse completions. What's the fastest safe response?",
        options: [
          { id: "wait-it-out", label: "Wait to see if it improves once more users have tried it" },
          { id: "registry-rollback-action", label: "Point the model registry back at the previous known-good checkpoint, which serving instances pick up on their next load" },
          { id: "retrain-fast", label: "Immediately retrain a brand new model from scratch" }
        ],
        correctOptionId: "registry-rollback-action",
        explanation: "A registry-based rollback is fast and low-risk precisely because it doesn't require redeploying serving infrastructure or waiting on a fresh, expensive training run."
      }
    ]
  },

  {
    id: "model-monitoring-system",
    title: "Design a Model Monitoring & Drift Detection System",
    difficulty: "hard",
    companies: ["Uber", "Google", "Arize"],
    tags: ["MLOps", "Monitoring", "Drift Detection"],
    summary: "Continuously watch live predictions and features so a silently degrading model gets caught, not discovered by users.",
    statement:
      "Design a system that continuously monitors a production ML model: it watches live prediction and feature " +
      "distributions, compares them against the distributions seen during training, and alerts an on-call engineer " +
      "when something has drifted enough to risk real accuracy degradation.",
    functionalRequirements: [
      "Continuously ingest live predictions and the features that produced them.",
      "Compare live feature/prediction distributions against a training-time baseline.",
      "Alert a human when drift crosses a meaningful threshold, with enough context to investigate."
    ],
    nonFunctionalRequirements: [
      "Monitoring must not add latency to the live serving path it's observing.",
      "Detection should happen within a reasonable window (hours, not weeks) after real drift begins.",
      "Alerts need enough context (which feature, how much it moved) to be actionable, not just a generic warning."
    ],
    scaleNote: "Monitors many models simultaneously, each processing a continuous stream of live predictions.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Serving systems being monitored push their prediction and feature logs in through a single ingestion gateway.",
        misplacedHint: "Every monitored serving system needs one common ingestion entry point first."
      },
      {
        id: "message_queue",
        parentId: "api_gateway",
        whyItFits: "Incoming prediction/feature logs are enqueued immediately, decoupling ingestion from the (heavier) analysis that happens afterward - so ingestion itself stays fast and never blocks the serving system pushing logs.",
        misplacedHint: "Buffering incoming logs is the first thing that happens after the gateway accepts them - the queue is a direct child of the gateway."
      },
      {
        id: "stream_processor",
        parentId: "message_queue",
        whyItFits: "A stream processor consumes the log stream and continuously computes rolling statistics (distributions, percentiles) over live features and predictions.",
        misplacedHint: "Computing live statistics only happens after logs are pulled off the queue - the stream processor is downstream of it, not called directly by the gateway."
      },
      {
        id: "drift_monitor",
        parentId: "stream_processor",
        whyItFits: "The drift monitor compares the stream processor's live statistics against a stored baseline and decides whether the divergence is large enough to matter.",
        misplacedHint: "Drift comparison happens once live statistics already exist - the monitor is downstream of the stream processor, not upstream of it."
      },
      {
        id: "feature_store_offline",
        parentId: "drift_monitor",
        whyItFits: "The drift monitor's baseline - what training-time feature distributions actually looked like - comes from the offline feature store used when the model was trained.",
        misplacedHint: "The training-time baseline is a direct dependency the drift monitor reads from, not something the stream processor or queue provides."
      },
      {
        id: "notification_dispatcher",
        parentId: "drift_monitor",
        whyItFits: "When drift crosses a meaningful threshold, the monitor triggers an alert through a dispatcher that reaches the right on-call engineer via email/Slack/page.",
        misplacedHint: "Alerting is the last step, fired only once the monitor has actually detected meaningful drift - it's a direct child of the drift monitor."
      }
    ],
    distractorIds: ["cdn", "geo_service", "payment_processor", "trie_store", "graph_store"],
    keyTakeaways: [
      "Monitoring is deliberately asynchronous (queue + stream processing) so it never adds latency to the live serving path it's watching.",
      "Drift is only meaningful relative to a training-time baseline - the offline feature store is what makes 'has this changed' answerable.",
      "An alert is only useful with context (which feature, how much) - that context has to be captured at the point drift is actually detected."
    ],
    estimationQuestions: [
      {
        id: "log-volume",
        prompt: "A monitored model serves 40,000 predictions/sec, and each logs itself plus 30 feature values. How many total log fields/sec need to be ingested?",
        unit: "fields/sec",
        placeholder: "e.g. 1200000",
        expectedValue: 1200000,
        tolerancePercent: 20,
        explanation: "40,000 x 30 = 1,200,000 fields/sec - a volume that requires a queue plus a stream processor, not synchronous per-request analysis."
      },
      {
        id: "detection-window",
        prompt: "If drift statistics are recomputed every 15 minutes and an alert requires 3 consecutive breaches to avoid noise, what's the maximum realistic detection delay?",
        unit: "minutes",
        placeholder: "e.g. 45",
        expectedValue: 45,
        tolerancePercent: 15,
        explanation: "15 minutes x 3 consecutive checks = 45 minutes worst-case - a deliberate tradeoff between catching drift quickly and not paging someone over a single noisy blip."
      }
    ],
    tradeoff: {
      nodeId: "message_queue",
      prompt: "How should prediction/feature logs get from the live serving system into the monitoring pipeline?",
      options: [
        {
          id: "async-queue",
          label: "Asynchronously, via a queue that the serving system writes to and immediately moves on from",
          correct: true,
          rationale: "This guarantees monitoring can never add latency to the live prediction path - the serving system's job is done the instant the log is enqueued."
        },
        {
          id: "sync-call",
          label: "Synchronously - the serving system waits for the monitoring system to acknowledge each log before responding to its own caller",
          correct: false,
          rationale: "This ties the live prediction's latency to the monitoring system's health and speed - a monitoring hiccup would directly slow down or break live serving."
        },
        {
          id: "no-logging",
          label: "Don't log every prediction - just review a manual sample occasionally",
          correct: false,
          rationale: "Manual, occasional sampling can't catch drift within hours - it also can't provide the statistical basis needed to distinguish real drift from normal noise."
        }
      ]
    },
    failureQuestions: [
      {
        id: "monitoring-down",
        prompt: "The entire monitoring pipeline goes down for a day. What's the impact on the live model being monitored?",
        options: [
          { id: "model-stops", label: "The live model stops serving predictions" },
          { id: "blind-spot", label: "The live model keeps serving completely normally; the team just has a blind spot and won't be alerted to any drift that happens during that day" },
          { id: "predictions-wrong", label: "Predictions from that day become incorrect" }
        ],
        correctOptionId: "blind-spot",
        explanation: "Monitoring is an observability layer sitting alongside serving, not in its request path - an outage there is a visibility gap, not a serving outage."
      },
      {
        id: "threshold-too-sensitive",
        prompt: "The drift alert threshold is set far too sensitively. What's the most likely practical consequence?",
        options: [
          { id: "no-consequence", label: "No real consequence, more alerts are always better" },
          { id: "alert-fatigue", label: "Alert fatigue - engineers start ignoring or muting frequent false-positive alerts, which risks missing the one that's real" },
          { id: "model-retrains-itself", label: "The model automatically retrains itself to fix the issue" }
        ],
        correctOptionId: "alert-fatigue",
        explanation: "A threshold tuned too tight produces frequent noise, and the predictable human response to constant false alarms is to start tuning them out - undermining the entire point of alerting."
      }
    ]
  },

  {
    id: "data-labeling-pipeline",
    title: "Design a Data Labeling Pipeline",
    difficulty: "hard",
    companies: ["Scale AI", "Tesla", "Google"],
    tags: ["MLOps", "Data Labeling", "Data Pipeline"],
    summary: "Turn a stream of raw, unlabeled examples into a trustworthy labeled dataset ready for training.",
    statement:
      "Design a data labeling pipeline: raw unlabeled examples (images, text, sensor data) arrive continuously, need to " +
      "be routed to human or automated labelers, and the resulting labeled dataset must be reliable enough to train a " +
      "production model on.",
    functionalRequirements: [
      "Accept a continuous stream of raw, unlabeled examples.",
      "Route examples to labelers (human or automated) and collect their label decisions.",
      "Assemble a finished, labeled dataset that downstream training pipelines can consume."
    ],
    nonFunctionalRequirements: [
      "Label quality must be measurable - not every labeler decision should be blindly trusted.",
      "Raw example storage and label-decision storage should scale independently, since their access patterns differ.",
      "The pipeline should support routing different example types to different labeling strategies."
    ],
    scaleNote: "Labeling throughput is typically the bottleneck for how quickly a new model or feature can be trained.",
    rootComponentId: "client",
    nodes: [
      {
        id: "api_gateway",
        parentId: null,
        whyItFits: "Both raw-example submissions and labeler-decision submissions come in through a single gateway.",
        misplacedHint: "Any incoming data - a new example to label, or a completed label - needs one common entry point first."
      },
      {
        id: "web_server",
        parentId: "api_gateway",
        whyItFits: "The labeling coordinator service tracks the state of each example (unlabeled, in-progress, labeled) and routes work to the right labeling strategy.",
        misplacedHint: "Tracking example state and routing is the coordinator's job, right behind the gateway - not something the storage layers do on their own."
      },
      {
        id: "labeling_service",
        parentId: "web_server",
        whyItFits: "The labeling service manages the actual labeling workflow: assigning examples to human annotators or automated labelers, and collecting their decisions.",
        misplacedHint: "Assigning and collecting label decisions is a distinct workflow the coordinator delegates to - it's a direct child of the coordinator."
      },
      {
        id: "object_storage",
        parentId: "labeling_service",
        whyItFits: "Raw unlabeled examples (images, audio, sensor data) are large binary blobs, stored durably and cheaply, and fetched by whichever labeler is currently working on that example.",
        misplacedHint: "Raw example bytes are fetched as part of the labeling workflow - object storage is a direct dependency of the labeling service."
      },
      {
        id: "sql_db",
        parentId: "labeling_service",
        whyItFits: "Structured label decisions, labeler identity, and inter-annotator agreement metadata need transactional consistency and are stored relationally, separate from the raw example bytes.",
        misplacedHint: "Label decisions are recorded directly by the labeling service as annotators submit them - this store is a sibling of object storage, both hanging off the labeling service."
      },
      {
        id: "orchestrator",
        parentId: "web_server",
        whyItFits: "An orchestrator periodically assembles the finished, quality-checked labels and raw examples into a versioned dataset ready for training pipelines to consume.",
        misplacedHint: "Assembling the final training dataset is a scheduled batch step the coordinator kicks off - it's a sibling of the labeling service, not nested under it."
      },
      {
        id: "data_lake",
        parentId: "orchestrator",
        whyItFits: "The orchestrator writes the finished, versioned labeled dataset into a data lake, where downstream training pipelines can pull it from.",
        misplacedHint: "Writing the finished dataset is the orchestrator's own output step - the data lake is a direct dependency of it, not of the labeling service."
      }
    ],
    distractorIds: ["cdn", "message_queue", "payment_processor", "geo_service", "trie_store"],
    keyTakeaways: [
      "Raw example bytes and structured label metadata are different shapes of data with different access patterns, so they scale in separate stores.",
      "Label quality needs to be measured (agreement metadata), not assumed - garbage labels produce a garbage-trained model.",
      "The finished, versioned dataset in the data lake is the clean handoff point between labeling and training - the two pipelines don't need to know about each other's internals."
    ],
    estimationQuestions: [
      {
        id: "labeler-throughput",
        prompt: "1 million examples need labeling, and one human labeler can label 200 examples/hour. How many labeler-hours are needed in total (ignoring any automation)?",
        unit: "labeler-hours",
        placeholder: "e.g. 5000",
        expectedValue: 5000,
        tolerancePercent: 10,
        explanation: "1,000,000 / 200 = 5,000 labeler-hours - a number that quickly makes the case for routing at least some examples to automated or semi-automated labeling instead of 100% manual work."
      },
      {
        id: "quality-check-overhead",
        prompt: "If 10% of labeled examples are randomly double-checked by a second labeler to measure agreement, how many extra labeler-hours does that add on top of the 5,000 above?",
        unit: "labeler-hours",
        placeholder: "e.g. 500",
        expectedValue: 500,
        tolerancePercent: 15,
        explanation: "10% of 5,000 = 500 extra labeler-hours - the ongoing cost of being able to actually measure label quality rather than just assuming it."
      }
    ],
    tradeoff: {
      nodeId: "labeling_service",
      prompt: "How should the pipeline decide who labels a given example - a human or an automated labeler?",
      options: [
        {
          id: "route-by-confidence",
          label: "Route easy/high-confidence examples to automated labelers and route ambiguous or novel examples to humans",
          correct: true,
          rationale: "This concentrates the expensive, slow human labeling budget on exactly the examples that actually need human judgment, while cheap automation handles the clear-cut majority."
        },
        {
          id: "always-human",
          label: "Always use human labelers for every example, regardless of difficulty",
          correct: false,
          rationale: "Human labeling is by far the slowest and most expensive option - using it on every single example, including obvious ones, wastes most of that budget."
        },
        {
          id: "always-automated",
          label: "Always use fully automated labeling with no human involvement",
          correct: false,
          rationale: "Automated labelers make systematic mistakes on ambiguous or novel cases with no correction mechanism - label quality would silently degrade with nothing to catch it."
        }
      ]
    },
    failureQuestions: [
      {
        id: "low-agreement",
        prompt: "Inter-annotator agreement on a batch of labels comes back unexpectedly low. What does this most likely indicate?",
        options: [
          { id: "storage-issue", label: "A storage system failure" },
          { id: "unclear-guidelines", label: "The labeling instructions/guidelines for that example type are probably ambiguous or the task is genuinely hard for humans to agree on" },
          { id: "network-issue", label: "A network issue between the gateway and the labeling service" }
        ],
        correctOptionId: "unclear-guidelines",
        explanation: "Low agreement is a quality signal about the labeling task itself (unclear guidelines, genuinely ambiguous examples) - it's exactly the kind of problem measuring agreement is meant to surface."
      },
      {
        id: "orchestrator-down",
        prompt: "The dataset-assembly orchestrator breaks and stops running for a week. What's the impact?",
        options: [
          { id: "labeling-stops", label: "New examples can no longer be submitted or labeled at all" },
          { id: "stale-dataset", label: "Labeling keeps happening normally; downstream training pipelines just won't see a fresh assembled dataset until the orchestrator is fixed" },
          { id: "labels-lost", label: "Already-collected labels are lost" }
        ],
        correctOptionId: "stale-dataset",
        explanation: "Labeling and dataset assembly are decoupled - collected labels stay safely in their own store regardless, and only the periodic 'package it up for training' step is affected."
      }
    ]
  }
];

const PROBLEMS_BY_ID: Map<string, CatalogProblem> = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

/** Legacy lookup against the static `PROBLEMS` array - only used by migration/export tooling now. */
export function getCatalogProblem(id: string): CatalogProblem | undefined {
  return PROBLEMS_BY_ID.get(id);
}

export function buildSolutionNodes(problem: CatalogProblem): SolutionNode[] {
  return problem.nodes.map((node) => ({
    componentId: node.id,
    parentComponentId: node.parentId,
    whyItFits: node.whyItFits
  }));
}

export function toProblemSummary(problem: CatalogProblem): SystemDesignProblemSummary {
  return {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    companies: problem.companies,
    tags: problem.tags,
    summary: problem.summary
  };
}

export function toProblemDetail(problem: CatalogProblem): SystemDesignProblemDetail {
  return {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    companies: problem.companies,
    tags: problem.tags,
    summary: problem.summary,
    statement: problem.statement,
    functionalRequirements: problem.functionalRequirements,
    nonFunctionalRequirements: problem.nonFunctionalRequirements,
    scaleNote: problem.scaleNote,
    rootComponentId: problem.rootComponentId,
    componentIds: problem.nodes.map((node) => node.id),
    distractorIds: problem.distractorIds,
    totalNodeCount: problem.nodes.length,
    estimationQuestions: (problem.estimationQuestions ?? []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      unit: question.unit,
      placeholder: question.placeholder
    })),
    tradeoffs: problem.tradeoff
      ? [
          {
            nodeId: problem.tradeoff.nodeId,
            prompt: problem.tradeoff.prompt,
            options: problem.tradeoff.options.map((option) => ({ id: option.id, label: option.label }))
          }
        ]
      : [],
    failureQuestions: (problem.failureQuestions ?? []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options
    }))
  };
}

export function checkEstimation(problem: CatalogProblem, request: EstimateRequest): EstimateResponse {
  const questions = problem.estimationQuestions ?? [];
  const results = request.answers
    .map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        return null;
      }

      const tolerance = question.expectedValue * (question.tolerancePercent / 100);
      const withinRange = Math.abs(answer.value - question.expectedValue) <= tolerance;
      const low = question.expectedValue - tolerance;
      const high = question.expectedValue + tolerance;

      return {
        questionId: question.id,
        withinRange,
        yourValue: answer.value,
        expectedValue: question.expectedValue,
        expectedRangeLabel: `${formatEstimateNumber(low)} - ${formatEstimateNumber(high)} ${question.unit}`,
        explanation: question.explanation
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return { results };
}

function formatEstimateNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value * 100) / 100}`;
}

export function checkTradeoff(problem: CatalogProblem, request: TradeoffRequest): TradeoffResponse | null {
  if (!problem.tradeoff || problem.tradeoff.nodeId !== request.nodeId) {
    return null;
  }

  const chosen = problem.tradeoff.options.find((option) => option.id === request.optionId);
  const correctOption = problem.tradeoff.options.find((option) => option.correct);
  if (!chosen || !correctOption) {
    return null;
  }

  return {
    correct: chosen.correct,
    chosenRationale: chosen.rationale,
    correctOptionId: correctOption.id,
    correctLabel: correctOption.label,
    correctRationale: correctOption.rationale
  };
}

export function checkFailureQuiz(problem: CatalogProblem, request: FailureQuizRequest): FailureQuizResponse {
  const questions = problem.failureQuestions ?? [];
  const results = request.answers
    .map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        return null;
      }

      return {
        questionId: question.id,
        correct: question.correctOptionId === answer.optionId,
        correctOptionId: question.correctOptionId,
        explanation: question.explanation
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return { results };
}

export function getCatalogSolution(problem: CatalogProblem): SystemDesignSolution {
  return {
    problemId: problem.id,
    rootComponentId: problem.rootComponentId,
    nodes: buildSolutionNodes(problem),
    keyTakeaways: problem.keyTakeaways
  };
}

/**
 * Validates one drag-and-drop placement attempt against the canonical tree. Deliberately
 * stateless: the caller passes the set of component ids already placed on their canvas so this
 * function never needs server-side session storage, while still being able to compute progress
 * and reject duplicate placements.
 */
export function validatePlacement(
  problem: CatalogProblem,
  request: ValidatePlacementRequest
): ValidatePlacementResponse {
  const { parentComponentId, attemptedComponentId, placedComponentIds } = request;
  const total = problem.nodes.length;
  const validPlacedIds = placedComponentIds.filter((placedId) => problem.nodes.some((node) => node.id === placedId));
  const placedSoFar = validPlacedIds.length;

  if (placedSoFar >= total) {
    return {
      correct: false,
      alreadyComplete: true,
      message: "This design is already complete - nothing left to place.",
      progress: { placedSoFar, total }
    };
  }

  if (attemptedComponentId === problem.rootComponentId) {
    return {
      correct: false,
      message: "The client is already on the board as your starting point - drag a component onto it or one of its children instead.",
      progress: { placedSoFar, total }
    };
  }

  if (validPlacedIds.includes(attemptedComponentId)) {
    const label = getComponent(attemptedComponentId)?.label ?? attemptedComponentId;
    return {
      correct: false,
      message: `You've already placed ${label} on this canvas - find its next missing neighbor instead.`,
      progress: { placedSoFar, total }
    };
  }

  const canonicalNode = problem.nodes.find((node) => node.id === attemptedComponentId);
  const attemptedLabel = getComponent(attemptedComponentId)?.label ?? attemptedComponentId;

  if (!canonicalNode) {
    const category = getComponent(attemptedComponentId)?.category;
    const categoryLabel = category ? COMPONENT_CATEGORY_META[category].label.toLowerCase() : "component";
    return {
      correct: false,
      message: `${attemptedLabel} isn't part of a typical "${problem.title}" design. This ${categoryLabel} solves a real problem elsewhere - just not this one.`,
      progress: { placedSoFar, total }
    };
  }

  const canonicalParentId = canonicalNode.parentId ?? problem.rootComponentId;
  if (canonicalParentId !== parentComponentId) {
    return {
      correct: false,
      message: canonicalNode.misplacedHint,
      progress: { placedSoFar, total }
    };
  }

  return {
    correct: true,
    message: `Correct! ${attemptedLabel} fits right here.`,
    whyItFits: canonicalNode.whyItFits,
    progress: { placedSoFar: placedSoFar + 1, total }
  };
}
