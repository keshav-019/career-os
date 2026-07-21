const path = require("node:path");
const { createDesktopHelperServer } = require("../src/helper-server");

const source = String.raw`\documentclass{article}
\usepackage{amsmath}
\begin{document}
CareerOS helper API smoke:
\[
  a^2 + b^2 = c^2
\]
\end{document}`;

async function main() {
  const app = {
    getPath() {
      return path.resolve(__dirname, "..", ".tmp-helper-user-data");
    },
    getVersion() {
      return "0.1.0-smoke";
    },
    isPackaged: false
  };

  const helper = createDesktopHelperServer({
    app,
    log: {
      error() {},
      info() {},
      warn() {}
    },
    port: 0
  });

  const { url } = await helper.start();
  try {
    const health = await fetch(`${url}/health`).then((response) => response.json());
    if (!health.ok || !health.latexRuntime?.available) {
      throw new Error(`Unexpected health payload: ${JSON.stringify(health)}`);
    }

    const response = await fetch(`${url}/compile-latex`, {
      body: JSON.stringify({ source }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok || typeof payload.pdfBase64 !== "string" || payload.pdfBase64.length < 100) {
      throw new Error(`Unexpected compile payload: ${JSON.stringify(payload).slice(0, 1000)}`);
    }

    console.log(
      JSON.stringify(
        {
          engine: payload.engine,
          health: health.latexRuntime.name,
          ok: true,
          pdfBytes: Buffer.from(payload.pdfBase64, "base64").length
        },
        null,
        2
      )
    );
  } finally {
    await helper.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
