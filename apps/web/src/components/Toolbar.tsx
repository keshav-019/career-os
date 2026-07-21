'use client';

import { Download, Loader2, Play } from 'lucide-react';

interface ToolbarProps {
    onCompile: () => void;
    onDownload: () => void;
    isCompiling: boolean;
    hasPdf: boolean;
}

export default function Toolbar({ onCompile, onDownload, isCompiling, hasPdf }: ToolbarProps) {
    return (
        <div className="latex-toolbar-actions">
            <button className="primary-button" onClick={onCompile} disabled={isCompiling} type="button">
                {isCompiling ? <Loader2 className="spin-icon" size={15} /> : <Play size={15} />}
                {isCompiling ? 'Compiling' : 'Compile'}
            </button>
            <button className="ghost-button" onClick={onDownload} disabled={!hasPdf} type="button">
                <Download size={15} />
                Download PDF
            </button>
        </div>
    );
}
