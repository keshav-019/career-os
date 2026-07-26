import cors from "cors";
import express from "express";
import aiRouter from "./routes/ai";
import interviewRouter from "./routes/interview";
import oauthRouter from "./routes/oauth";
import systemDesignRouter from "./routes/systemDesign";

const app = express();

// This backend has no legitimate browser-based caller - only the mobile app's native fetch, which CORS doesn't
// apply to at all (CORS is a browser-enforced mechanism; it's a no-op for RN/curl/server-to-server requests that
// never send an Origin header). Disabling it here just stops the previous default of reflecting every browser
// origin, which was flagged in a security review, with zero effect on the mobile app.
app.use(cors({ origin: false }));
app.use(express.json({ limit: "5mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "careeros-mobile-backend" });
});

app.use("/api/interview", interviewRouter);
app.use("/api/system-design", systemDesignRouter);
app.use("/api/ai", aiRouter);
app.use("/api/oauth", oauthRouter);

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`careeros-mobile-backend listening on port ${port}`);
});
