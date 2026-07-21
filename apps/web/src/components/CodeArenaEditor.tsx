'use client';

import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirrorModule, { type Extension } from '@uiw/react-codemirror';
import { useMemo, type ComponentType } from 'react';
import type { CodingLanguage } from '@/lib/interview/coding-arena-client';

interface CodeArenaEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodingLanguage;
}

function getLanguageExtension(language: CodingLanguage): Extension {
  switch (language) {
    case 'c':
    case 'cpp':
      return cpp();
    case 'java':
      return java();
    case 'python':
      return python();
    case 'rust':
      return rust();
    case 'javascript':
    default:
      return javascript();
  }
}

export default function CodeArenaEditor({ value, onChange, language }: CodeArenaEditorProps) {
  const extensions = useMemo(() => [getLanguageExtension(language), oneDark], [language]);
  const CodeMirror = CodeMirrorModule as unknown as ComponentType<{
    basicSetup: Record<string, boolean>;
    className: string;
    extensions: Extension[];
    onChange: (value: string) => void;
    value: string;
  }> | undefined;

  return (
    <div className="latex-editor-shell coding-arena-editor-shell">
      {CodeMirror ? (
        <CodeMirror
          basicSetup={{
            autocompletion: true,
            closeBrackets: true,
            highlightActiveLineGutter: true,
            lineNumbers: true
          }}
          className="latex-code-mirror coding-arena-code-mirror"
          extensions={extensions}
          onChange={onChange}
          value={value}
        />
      ) : (
        <textarea
          className="coding-arena-textarea-fallback"
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          value={value}
        />
      )}
    </div>
  );
}
