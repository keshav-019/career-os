import cors from "cors";
import express from "express";
import aiRouter from "./routes/ai";
import interviewRouter from "./routes/interview";
import systemDesignRouter from "./routes/systemDesign";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "careeros-mobile-backend" });
});

app.use("/api/interview", interviewRouter);
app.use("/api/system-design", systemDesignRouter);
app.use("/api/ai", aiRouter);

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`careeros-mobile-backend listening on port ${port}`);
});
