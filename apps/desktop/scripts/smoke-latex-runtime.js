const fs = require("node:fs");
const path = require("node:path");
const { createLatexRuntime } = require("../src/latex-runtime");

const pastedResumePath = "C:/Users/kesha/.codex/attachments/ffd957b5-7d55-47be-ba94-04c4b53a155d/pasted-text.txt";

function readOptionalFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function tex(strings, ...values) {
  return String.raw({ raw: strings.raw }, ...values);
}

const pastedResume = readOptionalFile(pastedResumePath);

const samples = [
  {
    name: "basic-article",
    expect: "pass",
    source: tex`\documentclass{article}
\begin{document}
Hello from CareerOS.
\end{document}`
  },
  {
    name: "math-ams",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{amsmath,amssymb}
\begin{document}
\[
  \int_0^1 x^2\,dx = \frac{1}{3}, \qquad \mathbb{R}^n
\]
\end{document}`
  },
  {
    name: "tables-booktabs",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{booktabs,tabularx,xcolor}
\begin{document}
\begin{tabularx}{\linewidth}{Xrr}
\toprule
Item & Before & After \\
\midrule
Latency & 180 & 95 \\
Errors & 12 & 1 \\
\bottomrule
\end{tabularx}
\end{document}`
  },
  {
    name: "tikz-diagram",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
  \draw[rounded corners, thick, blue] (0,0) rectangle (5,2);
  \node at (2.5,1) {CareerOS};
\end{tikzpicture}
\end{document}`
  },
  {
    name: "fontspec-windows-font",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{fontspec}
\setmainfont{Arial}
\begin{document}
Fontconfig and system fonts are working.
\end{document}`
  },
  {
    name: "hyperref-bookmarks",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage[colorlinks=true,urlcolor=blue]{hyperref}
\usepackage{bookmark}
\begin{document}
\section{Links}
\href{https://example.com}{Example}
\end{document}`
  },
  {
    name: "bibliography-filecontents",
    expect: "pass",
    source: tex`\begin{filecontents*}{refs.bib}
@article{knuth1984,
  title={Literate Programming},
  author={Knuth, Donald E.},
  journal={The Computer Journal},
  year={1984}
}
\end{filecontents*}
\documentclass{article}
\begin{document}
Knuth wrote about literate programming \cite{knuth1984}.
\bibliographystyle{plain}
\bibliography{refs}
\end{document}`
  },
  {
    name: "code-listings",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{listings,xcolor}
\lstset{basicstyle=\ttfamily\small,keywordstyle=\color{blue}}
\begin{document}
\begin{lstlisting}[language=Python]
print("CareerOS")
\end{lstlisting}
\end{document}`
  },
  {
    name: "beamer-slides",
    expect: "pass",
    source: tex`\documentclass{beamer}
\usetheme{Madrid}
\title{CareerOS}
\author{Resume Studio}
\begin{document}
\frame{\titlepage}
\begin{frame}{Pipeline}
  \begin{itemize}
    \item Track roles
    \item Compile resumes
  \end{itemize}
\end{frame}
\end{document}`
  },
  {
    name: "algorithm2e",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage[ruled,vlined]{algorithm2e}
\begin{document}
\begin{algorithm}
\KwIn{Applications}
\KwOut{Prioritized pipeline}
\ForEach{role in applications}{
  score role\;
}
\caption{CareerOS ranking}
\end{algorithm}
\end{document}`
  },
  {
    name: "unicode-text",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{fontspec}
\setmainfont{Arial}
\begin{document}
Résumé, café, naïve, São Paulo, München, and an en dash -- all in one local compile.
\end{document}`
  },
  {
    name: "fontawesome-unused-overleaf-style",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{fontawesome5}
\begin{document}
The package is present but no icon commands are used.
\end{document}`
  },
  {
    name: "fontawesome-used",
    expect: "pass",
    source: tex`\documentclass{article}
\usepackage{fontawesome5}
\begin{document}
\faGithub\ \faLinkedin\ \faEnvelope
\end{document}`
  },
  {
    name: "minted-shell-escape",
    expect: "fail",
    source: tex`\documentclass{article}
\usepackage{minted}
\begin{document}
\begin{minted}{python}
print("CareerOS")
\end{minted}
\end{document}`
  },
  {
    name: "invalid-syntax",
    expect: "fail",
    source: tex`\documentclass{article}
\begin{document}
\section{Broken
\end{document}`
  },
  {
    name: "missing-input-file",
    expect: "fail",
    source: tex`\documentclass{article}
\begin{document}
\input{chapters/intro}
\end{document}`
  },
  {
    name: "missing-external-image",
    expect: "fail",
    source: tex`\documentclass{article}
\usepackage{graphicx}
\begin{document}
\includegraphics{does-not-exist.png}
\end{document}`
  }
];

if (pastedResume) {
  samples.splice(1, 0, {
    name: "pasted-overleaf-resume",
    expect: "pass",
    source: pastedResume
  });
}

async function main() {
  const app = {
    isPackaged: false,
    getPath() {
      return path.resolve(__dirname, "..", ".tmp-smoke-user-data");
    }
  };

  const runtime = createLatexRuntime({
    app,
    log: {
      info() {},
      warn() {},
      error() {}
    }
  });

  const results = [];

  for (const sample of samples) {
    const startedAt = Date.now();
    try {
      const result = await runtime.compile(sample.source);
      const elapsedMs = Date.now() - startedAt;
      const passed = sample.expect === "pass";
      results.push({
        elapsedMs,
        engine: result.engine,
        name: sample.name,
        ok: passed,
        pdfBytes: result.pdfBuffer.length,
        status: passed ? "PASS" : "UNEXPECTED PASS"
      });
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const expectedFailure = sample.expect === "fail";
      results.push({
        elapsedMs,
        engine: error.engine || "unknown",
        name: sample.name,
        ok: expectedFailure,
        reason: error.summary || error.message || "Compile failed.",
        status: expectedFailure ? "EXPECTED FAIL" : "FAIL"
      });
    }
  }

  console.table(
    results.map((result) => ({
      sample: result.name,
      status: result.status,
      engine: result.engine,
      ms: result.elapsedMs,
      bytes: result.pdfBytes || "",
      reason: result.reason || ""
    }))
  );

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
