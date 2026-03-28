'use client';

import { useState, useCallback } from 'react';
import Editor from './Editor';
import Preview from './Preview';
import Toolbar from './Toolbar';
import { useLatexCompiler } from '@/lib/latex-compiler';

const DEFAULT_TEX = `\\documentclass{article}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\begin{document}
\\section{Hello World}
This is a sample LaTeX document.
\\end{document}`;

export default function ResumeLatexStudio() {
    const [source, setSource] = useState(DEFAULT_TEX);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const compile = useLatexCompiler();

    const handleCompile = useCallback(async () => {
        if (!source.trim()) {
            setError('Source is empty');
            return;
        }
        setIsCompiling(true);
        setError(null);
        try {
            const result = await compile(source);
            const blob = new Blob([new Uint8Array(result.pdf)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err: unknown) {
            const fullMsg = err instanceof Error ? err.message : 'Compilation failed';
            const lines = fullMsg.split('\n').filter(line => line.trim());
            const relevant = lines.slice(-8).join('\n');
            setError(relevant || fullMsg);
            setPdfUrl(null);
        } finally {
            setIsCompiling(false);
        }
    }, [source, compile]);

    const handleDownload = useCallback(() => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = 'resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [pdfUrl]);

    return (
        <div className="latex-mode-shell">
            <Toolbar onCompile={handleCompile} onDownload={handleDownload} isCompiling={isCompiling} hasPdf={!!pdfUrl} />
            {error && (
                <div className="latex-diagnostics">
                    {error}
                </div>
            )}
            <div className="latex-workbench">
                <div className="career-card latex-pane">
                    <Editor value={source} onChange={setSource} />
                </div>
                <div className="career-card latex-pane">
                    <Preview pdfUrl={pdfUrl} />
                </div>
            </div>
        </div>
    );
}
