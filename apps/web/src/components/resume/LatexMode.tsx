'use client';

import { AlertTriangle, CheckCircle2, Download, FileCode2, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Editor from '../Editor';
import Preview from '../Preview';
import Toolbar from '../Toolbar';
import {
  LatexCompileError,
  getLatexRuntimeStatus,
  installLatexRuntime,
  useLatexCompiler,
  type LatexRuntimeStatus
} from '@/lib/latex-compiler';

const SOURCE_STORAGE_KEY = 'careeros:resume-studio:latex-source';
const SOURCE_SAVED_AT_KEY = 'careeros:resume-studio:latex-saved-at';

const DEFAULT_TEX = String.raw`\documentclass[10pt, letterpaper]{article}

\usepackage[
    ignoreheadfoot,
    top=1.6 cm,
    bottom=1.6 cm,
    left=1.65 cm,
    right=1.65 cm,
    footskip=0.8 cm,
]{geometry}
\usepackage{titlesec}
\usepackage{tabularx}
\usepackage{array}
\usepackage[dvipsnames]{xcolor}
\usepackage{enumitem}
\usepackage{fontawesome5}
\usepackage{amsmath}
\usepackage[
    pdftitle={CareerOS Resume},
    pdfauthor={CareerOS User},
    pdfcreator={LaTeX},
    colorlinks=true,
    urlcolor=black
]{hyperref}
\usepackage[pscoord]{eso-pic}
\usepackage{calc}
\usepackage{bookmark}
\usepackage{lastpage}
\usepackage{changepage}
\usepackage{paracol}
\usepackage{ifthen}
\usepackage{needspace}
\usepackage{iftex}
\usepackage{etoolbox}

\ifPDFTeX
    \input{glyphtounicode}
    \pdfgentounicode=1
    \usepackage[T1]{fontenc}
    \usepackage[utf8]{inputenc}
    \usepackage{lmodern}
\fi

\usepackage{charter}

\raggedright
\setlength{\emergencystretch}{2em}
\AtBeginEnvironment{adjustwidth}{\partopsep0pt}
\pagestyle{empty}
\setcounter{secnumdepth}{0}
\setlength{\parindent}{0pt}
\setlength{\topskip}{0pt}
\setlength{\columnsep}{0.15cm}
\pagenumbering{gobble}
\titlespacing{\section}{-1pt}{0.1 cm}{0.1 cm}

\renewcommand\labelitemi{$\vcenter{\hbox{\small$\bullet$}}$}
\newenvironment{highlights}{
    \begin{itemize}[
        topsep=0.06 cm,
        parsep=0.06 cm,
        partopsep=0pt,
        itemsep=0pt,
        leftmargin=0 cm + 10pt
    ]
}{
    \end{itemize}
}

\newenvironment{onecolentry}{
    \begin{adjustwidth}{0 cm + 0.00001 cm}{0 cm + 0.00001 cm}
}{
    \end{adjustwidth}
}

\newcommand{\twocolentry}[2]{%
  \noindent\begin{tabular*}{\textwidth}{@{\extracolsep{\fill}} p{0.45\textwidth} >{\raggedleft\arraybackslash}p{0.5\textwidth}}%
    #1 & #2 \\
  \end{tabular*}%
}

\titleformat{\section}
  {\centering\scshape\large}
  {}
  {0pt}
  {\rule{\textwidth}{0.4pt} \\}

\begin{document}

\begin{flushleft}
    \fontsize{16 pt}{16 pt}\selectfont \textbf{YOUR NAME}
\end{flushleft}

\vspace{0.05 cm}

\twocolentry
  {Email: \texttt{you@example.com}}
  {LinkedIn: \url{https://linkedin.com/in/your-profile}}

\vspace{0.05cm}

\twocolentry
    {Mobile: +1-555-010-4242}
    {Github: \url{https://github.com/your-profile}}

\section{EDUCATION}

\begin{tabularx}{\textwidth}{X r}
\textbf{University Name} & \textit{Aug 2024 -- May 2026} \\
Degree or Program & \textbf{GPA: 8.5} \\
\end{tabularx}

\section{SKILLS SUMMARY}

\begin{onecolentry}
\begin{highlights}
\item \textbf{Languages}: Java, JavaScript, TypeScript, Python, C++, SQL
\item \textbf{Backend}: Spring Boot, Node.js, REST APIs, Microservices
\item \textbf{Databases}: PostgreSQL, MySQL, Oracle SQL
\item \textbf{Frontend}: Angular, React, HTML, CSS
\item \textbf{Cloud and Tools}: Cloud, Docker, Git, Linux
\item \textbf{ML/AI}: TensorFlow, PyTorch, NumPy, Pandas, Scikit-Learn
\end{highlights}
\end{onecolentry}

\section{WORK EXPERIENCE}

\begin{tabularx}{\textwidth}{X r}
\textbf{SOFTWARE ENGINEER @ COMPANY} & \textit{Jan 2026 -- Present}
\end{tabularx}

\begin{onecolentry}
    \begin{highlights}
        \item Built production software across frontend, backend, cloud, and data workflows.
        \item Improved release reliability through stronger debugging, automation, and observability.
        \item Delivered user-facing features with measurable impact and cross-functional collaboration.
    \end{highlights}
\end{onecolentry}

\section{PROJECTS}

\begin{onecolentry}
\textbf{CareerOS | Career Management Platform}
\hfill
\href{https://example.com}{Live Demo}
\end{onecolentry}

\vspace{0.05cm}

\begin{onecolentry}
\begin{highlights}
\item Built a career management platform featuring job application tracking, interview prep, learning workflows, and resume tooling.
\item Implemented local desktop resume compilation with a PDF preview workflow.
\end{highlights}
\end{onecolentry}

\end{document}`;

function createPdfUrl(pdf: ArrayBuffer): string {
  return URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }));
}

function formatRuntime(runtime: LatexRuntimeStatus | null): string {
  if (!runtime) {
    return 'Checking compiler';
  }

  if (runtime.available) {
    return `${runtime.name}${runtime.version ? ` - ${runtime.version}` : ''}`;
  }

  return runtime.installMessage || 'Portable compiler is not ready.';
}

function readInitialSource(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_TEX;
  }

  return window.localStorage.getItem(SOURCE_STORAGE_KEY) || DEFAULT_TEX;
}

function saveSource(source: string): string {
  const savedAt = new Date().toISOString();
  window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
  window.localStorage.setItem(SOURCE_SAVED_AT_KEY, savedAt);
  return savedAt;
}

function LatexDiagnostics({ error }: { error: LatexCompileError }) {
  const logLines = error.log.split('\n').filter((line) => line.trim()).slice(-80);

  return (
    <section className="latex-diagnostics" aria-live="polite">
      <div className="latex-diagnostics-head">
        <div className="status-card-icon warning">
          <AlertTriangle size={17} />
        </div>
        <div>
          <p className="eyebrow">Compile Diagnostics</p>
          <h3>{error.message}</h3>
          <span>{error.engine}</span>
        </div>
      </div>
      <pre>{logLines.join('\n')}</pre>
    </section>
  );
}

export default function LatexMode() {
  const [source, setSource] = useState(DEFAULT_TEX);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<LatexRuntimeStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState('Preparing LaTeX workspace...');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [compileError, setCompileError] = useState<LatexCompileError | null>(null);
  const compile = useLatexCompiler();

  const runtimeText = useMemo(() => formatRuntime(runtime), [runtime]);
  const compilerReady = Boolean(runtime?.available);
  const portableCompilerReady = runtime?.kind === 'tectonic';

  const refreshRuntime = useCallback(async () => {
    setIsChecking(true);
    try {
      const nextRuntime = await getLatexRuntimeStatus();
      setRuntime(nextRuntime);
      setStatusMessage(nextRuntime.installMessage || (nextRuntime.available ? 'Compiler ready.' : 'Compiler not ready.'));
    } catch (error) {
      setRuntime(null);
      setStatusMessage(error instanceof Error ? error.message : 'Desktop helper is not responding.');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    setSource(readInitialSource());
    setSavedAt(window.localStorage.getItem(SOURCE_SAVED_AT_KEY));
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSavedAt(saveSource(source));
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [source]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const installCompiler = useCallback(async () => {
    setIsInstalling(true);
    setCompileError(null);
    setStatusMessage('Installing portable compiler...');
    try {
      const nextRuntime = await installLatexRuntime();
      setRuntime(nextRuntime);
      setStatusMessage(nextRuntime.installMessage || 'Portable compiler ready.');
      return nextRuntime;
    } catch (error) {
      const wrapped = new LatexCompileError(error instanceof Error ? error.message : 'Compiler install failed.', {
        engine: 'CareerOS Desktop'
      });
      setCompileError(wrapped);
      setStatusMessage(wrapped.message);
      return null;
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const handleCompile = useCallback(async () => {
    if (!source.trim()) {
      setCompileError(new LatexCompileError('LaTeX source is empty.', { engine: 'CareerOS Desktop' }));
      return;
    }

    setIsCompiling(true);
    setCompileError(null);
    setStatusMessage('Compiling PDF...');
    setSavedAt(saveSource(source));

    try {
      if (!runtime?.available || runtime.kind !== 'tectonic') {
        const installedRuntime = await installCompiler();
        if (!installedRuntime?.available && !runtime?.available) {
          return;
        }
      }

      const result = await compile(source);
      const nextUrl = createPdfUrl(result.pdf);
      setPdfUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextUrl;
      });
      setStatusMessage(`Compiled with ${result.engine || 'LaTeX'}.`);
      await refreshRuntime();
    } catch (error) {
      const wrapped =
        error instanceof LatexCompileError
          ? error
          : new LatexCompileError(error instanceof Error ? error.message : 'Compilation failed.');
      setCompileError(wrapped);
      setStatusMessage(wrapped.message);
      setPdfUrl(null);
    } finally {
      setIsCompiling(false);
    }
  }, [compile, installCompiler, refreshRuntime, runtime?.available, runtime?.kind, source]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'careeros-resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pdfUrl]);

  const handleSave = () => {
    setSavedAt(saveSource(source));
    setStatusMessage('Source saved locally.');
  };

  return (
    <div className="latex-mode-shell">
      <section className="latex-mode-status-row">
        <div className="career-card latex-runtime-card">
          <div className={compilerReady ? 'status-card-icon success' : 'status-card-icon warning'}>
            {compilerReady ? <CheckCircle2 size={17} /> : <Download size={17} />}
          </div>
          <div>
            <p className="eyebrow">Compiler</p>
            <h3>{runtimeText}</h3>
            <span>{statusMessage}</span>
          </div>
        </div>

        <div className="latex-toolbar-card">
          <button className="ghost-button" disabled={isChecking} onClick={() => void refreshRuntime()} type="button">
            <RefreshCw className={isChecking ? 'spin-icon' : undefined} size={15} />
            Check
          </button>
          <button className="ghost-button" onClick={handleSave} type="button">
            <Save size={15} />
            Save
          </button>
          {!portableCompilerReady ? (
            <button className="segmented-button" disabled={isInstalling} onClick={() => void installCompiler()} type="button">
              <Download className={isInstalling ? 'spin-icon' : undefined} size={15} />
              Use Portable Compiler
            </button>
          ) : null}
          <Toolbar onCompile={handleCompile} onDownload={handleDownload} isCompiling={isCompiling} hasPdf={Boolean(pdfUrl)} />
        </div>
      </section>

      {compileError ? <LatexDiagnostics error={compileError} /> : null}

      <section className="latex-workbench">
        <article className="career-card latex-pane">
          <div className="desktop-pane-header">
            <div>
              <strong>Source</strong>
              <span>{savedAt ? 'Autosaved locally' : 'Draft not saved yet'}</span>
            </div>
            <FileCode2 size={16} />
          </div>
          <Editor value={source} onChange={setSource} />
        </article>

        <article className="career-card latex-pane">
          <div className="desktop-pane-header">
            <div>
              <strong>Preview</strong>
              <span>{statusMessage}</span>
            </div>
            <FileCode2 size={16} />
          </div>
          <Preview pdfUrl={pdfUrl} status={statusMessage} />
        </article>
      </section>
    </div>
  );
}
