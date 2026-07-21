'use client';

import CodeMirror from '@uiw/react-codemirror';
import { latex } from 'codemirror-lang-latex';
import { oneDark } from '@codemirror/theme-one-dark';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';

interface EditorProps {
    value: string;
    onChange: (value: string) => void;
}

export default function Editor({ value, onChange }: EditorProps) {
    return (
        <div className="latex-editor-shell">
            <CodeMirror
                value={value}
                onChange={onChange}
                extensions={[
                    latex(),
                    oneDark,
                    highlightSelectionMatches(),
                    keymap.of([
                        ...defaultKeymap,
                        ...searchKeymap,
                    ]),
                ]}
                className="latex-code-mirror"
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSelectionMatches: true,
                    closeBrackets: true,
                    autocompletion: true,
                }}
            />
        </div>
    );
}
