'use client';

import { FileText } from 'lucide-react';

interface PreviewProps {
    pdfUrl: string | null;
    status?: string;
}

export default function Preview({ pdfUrl, status = 'Compile to render the PDF preview.' }: PreviewProps) {
    return (
        <div className="latex-preview-shell">
            {pdfUrl ? (
                <iframe className="latex-preview-frame" src={pdfUrl} title="PDF Preview" />
            ) : (
                <div className="latex-preview-empty">
                    <FileText size={22} />
                    <h3>Preview waiting</h3>
                    <p>{status}</p>
                </div>
            )}
        </div>
    );
}
