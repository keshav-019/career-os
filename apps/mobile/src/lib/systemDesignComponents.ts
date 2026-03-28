/** Direct copy of apps/web/src/lib/system-design/component-library.ts - pure client-safe metadata (label,
 *  category, blurb), small enough (under 100 lines) to duplicate rather than fetch over HTTP, same reasoning as
 *  the resume template metadata. Never contains a problem's canonical tree or hints - those stay server-side and
 *  only ever reach the client through the validate/solution API routes. */
export type ComponentCategory = "edge" | "compute" | "data" | "messaging" | "coordination";

export type ComponentDefinition = {
  id: string;
  label: string;
  category: ComponentCategory;
  blurb: string;
};

export const COMPONENT_CATEGORY_META: Record<ComponentCategory, { label: string; accent: string }> = {
  edge: { label: "Edge & Routing", accent: "brand" },
  compute: { label: "Compute", accent: "violet" },
  data: { label: "Data & Storage", accent: "success" },
  messaging: { label: "Messaging", accent: "warning" },
  coordination: { label: "Coordination", accent: "muted" }
};

export const COMPONENT_LIBRARY: ComponentDefinition[] = [
  { id: "client", label: "Client / User", category: "edge", blurb: "The browser, mobile app, or device that starts the request." },
  { id: "dns", label: "DNS Resolver", category: "edge", blurb: "Translates a domain name into the IP address of an entry point." },
  { id: "cdn", label: "CDN", category: "edge", blurb: "Caches static or media assets geographically close to users." },
  { id: "load_balancer", label: "Load Balancer", category: "edge", blurb: "Spreads incoming requests across many identical servers." },
  { id: "api_gateway", label: "API Gateway", category: "edge", blurb: "Single entry point that handles auth, routing, and request shaping." },

  { id: "web_server", label: "Web / App Server", category: "compute", blurb: "Stateless servers that run the core application logic." },
  { id: "app_service", label: "Application Service", category: "compute", blurb: "A focused backend service that owns one piece of business logic." },
  { id: "worker", label: "Background Worker", category: "compute", blurb: "Consumes queued jobs asynchronously, off the request path." },
  { id: "websocket_gateway", label: "WebSocket Gateway", category: "compute", blurb: "Holds long-lived connections for real-time, bidirectional delivery." },
  { id: "stream_processor", label: "Stream Processor", category: "compute", blurb: "Processes unbounded event streams in near real time (e.g. Flink/Spark Streaming)." },
  { id: "transcoding_service", label: "Transcoding Service", category: "compute", blurb: "Converts uploaded media into multiple resolutions/bitrates." },
  { id: "geo_service", label: "Geospatial Dispatch Service", category: "compute", blurb: "Matches locations to nearby drivers/items using geohashing or quad-trees." },
  { id: "id_generator", label: "Unique ID Generator", category: "compute", blurb: "Hands out globally unique, roughly time-sortable IDs (e.g. Snowflake)." },
  { id: "rate_limiter_service", label: "Rate Limiter Middleware", category: "compute", blurb: "Rejects requests once a client exceeds its allowed rate." },
  { id: "ranking_service", label: "Ranking / Scoring Service", category: "compute", blurb: "Scores and orders candidate items before they're returned." },
  { id: "matching_service", label: "Matching Engine", category: "compute", blurb: "Pairs two sides of a marketplace (e.g. riders and drivers, seats and buyers)." },
  { id: "payment_processor", label: "Payment Gateway", category: "compute", blurb: "Talks to an external processor (Stripe/Visa) to move real money." },
  { id: "notification_dispatcher", label: "Notification Dispatcher", category: "compute", blurb: "Fans a single event out to email/SMS/push provider APIs." },
  { id: "url_encoder", label: "URL Encoding Service", category: "compute", blurb: "Converts a long URL into a short, collision-free code." },
  { id: "crawler_workers", label: "Crawler Worker Pool", category: "compute", blurb: "Fetches and parses pages pulled from the URL frontier." },
  { id: "sync_engine", label: "Sync / Diff Engine", category: "compute", blurb: "Chunks files and computes deltas so only changed blocks re-sync." },
  { id: "training_cluster", label: "Training Cluster", category: "compute", blurb: "Pool of GPU/TPU workers that run distributed model training jobs." },
  { id: "model_serving", label: "Model Serving Endpoint", category: "compute", blurb: "Hosts a trained model behind a low-latency API for real-time inference." },
  { id: "batch_inference_job", label: "Batch Inference Job", category: "compute", blurb: "Periodically scores a large dataset offline instead of in real time." },
  { id: "embedding_service", label: "Embedding Service", category: "compute", blurb: "Converts raw items (text, images, users) into vector embeddings." },
  { id: "labeling_service", label: "Data Labeling Service", category: "compute", blurb: "Routes unlabeled examples to human or automated labelers to produce training labels." },
  { id: "ab_assignment_service", label: "A/B Assignment Service", category: "compute", blurb: "Deterministically buckets each user into an experiment variant." },
  { id: "moderation_classifier", label: "Content Moderation Classifier", category: "compute", blurb: "Scores content for policy violations before it's published." },

  { id: "sql_db", label: "Relational Database", category: "data", blurb: "Strong consistency, joins, and transactions (Postgres/MySQL-style)." },
  { id: "nosql_db", label: "NoSQL Database", category: "data", blurb: "Horizontally-scalable wide-column/document store (Cassandra/DynamoDB-style)." },
  { id: "cache", label: "Distributed Cache", category: "data", blurb: "In-memory key-value store that absorbs repeated reads (Redis/Memcached)." },
  { id: "object_storage", label: "Object Storage", category: "data", blurb: "Durable blob storage for large files, images, and video (S3-style)." },
  { id: "search_index", label: "Search Index", category: "data", blurb: "Inverted index built for fast full-text or fuzzy lookups (Elasticsearch-style)." },
  { id: "graph_store", label: "Social Graph Store", category: "data", blurb: "Stores who-follows-whom edges for fast friend/follower lookups." },
  { id: "trie_store", label: "In-Memory Prefix Trie", category: "data", blurb: "Serves ranked prefix completions in microseconds." },
  { id: "ledger_db", label: "Ledger / Transaction Store", category: "data", blurb: "Append-only, auditable record of every balance-changing event." },
  { id: "metadata_db", label: "Metadata Store", category: "data", blurb: "Tracks ownership, filenames, and versions separately from raw bytes." },
  { id: "url_mapping_db", label: "URL Mapping Store", category: "data", blurb: "Key-value table mapping short codes back to their original long URL." },
  { id: "frontier_queue", label: "URL Frontier", category: "data", blurb: "Priority queue of URLs still waiting to be crawled." },
  { id: "bloom_filter", label: "Bloom Filter", category: "data", blurb: "Probabilistic set used to skip URLs that were almost certainly seen before." },
  { id: "counter_store", label: "Counter Store", category: "data", blurb: "Fast atomic counters used to enforce a rolling rate-limit window." },
  { id: "feature_store_online", label: "Online Feature Store", category: "data", blurb: "Low-latency store serving pre-computed features at inference time." },
  { id: "feature_store_offline", label: "Offline Feature Store", category: "data", blurb: "Batch-computed historical features used for training, backed by a data warehouse/lake." },
  { id: "vector_db", label: "Vector Database", category: "data", blurb: "Stores embeddings and supports fast approximate nearest-neighbor search." },
  { id: "data_lake", label: "Data Lake", category: "data", blurb: "Raw, large-scale storage for all historical events/logs used to build training data." },

  { id: "message_queue", label: "Message Queue", category: "messaging", blurb: "Durable, ordered buffer between producers and consumers (Kafka/SQS-style)." },
  { id: "pub_sub", label: "Pub/Sub Fan-out Bus", category: "messaging", blurb: "Delivers one event to many independent subscribers at once." },

  { id: "zookeeper", label: "Coordination Service", category: "coordination", blurb: "Leader election and shared config/state across a cluster (ZooKeeper-style)." },
  { id: "third_party_gateway", label: "Third-Party Gateway", category: "coordination", blurb: "An external provider your system calls out to (SMS/email/push vendor)." },
  { id: "model_registry", label: "Model Registry", category: "coordination", blurb: "Versioned store of trained model artifacts, metadata, and lineage." },
  { id: "experiment_tracker", label: "Experiment Tracker", category: "coordination", blurb: "Logs training runs, hyperparameters, and metrics for comparison (MLflow-style)." },
  { id: "drift_monitor", label: "Model / Data Drift Monitor", category: "coordination", blurb: "Watches live prediction and feature distributions for divergence from training data." },
  { id: "orchestrator", label: "Pipeline Orchestrator", category: "coordination", blurb: "Schedules and sequences multi-step data/training pipelines (Airflow-style)." },
  { id: "canary_router", label: "Canary / Shadow Router", category: "edge", blurb: "Routes a small slice of live traffic to a new model version before a full rollout." }
];

export const COMPONENT_BY_ID: Record<string, ComponentDefinition> = Object.fromEntries(
  COMPONENT_LIBRARY.map((component) => [component.id, component])
);
