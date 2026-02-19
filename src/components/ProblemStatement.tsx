import { FileText } from 'lucide-react';
import React from 'react';

interface ProblemStatementProps {
    content: string;
    blanks?: { instruction: string }[];
}

// Helper to process inline markdown (bold, code) and return React elements
function renderInline(text: string): React.ReactNode[] {
    // Split by bold (**...**) and code (`...`) patterns  
    const parts: React.ReactNode[] = [];
    // Use a combined regex to find bold or code tokens
    const regex = /\*\*(.*?)\*\*|`(.*?)`/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Push text before this match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        if (match[1] !== undefined) {
            // Bold
            parts.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>);
        } else if (match[2] !== undefined) {
            // Inline code
            parts.push(
                <code key={match.index} className="bg-slate-800 px-1.5 py-0.5 rounded text-teal-300 font-mono text-xs">
                    {match[2]}
                </code>
            );
        }
        lastIndex = match.index + match[0].length;
    }
    // Push remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts;
}

export default function ProblemStatement({ content, blanks }: ProblemStatementProps) {
    const renderContent = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // H1
            if (line.startsWith('# ')) {
                elements.push(
                    <h1 key={i} className="text-2xl font-bold text-slate-100 mb-4 mt-2">
                        {renderInline(line.replace('# ', ''))}
                    </h1>
                );
                i++;
                continue;
            }
            // H2
            if (line.startsWith('## ')) {
                elements.push(
                    <h2 key={i} className="text-lg font-semibold text-teal-400 mb-3 mt-6">
                        {renderInline(line.replace('## ', ''))}
                    </h2>
                );
                i++;
                continue;
            }

            // Alert block: > [!WARNING] or > [!NOTE] etc.
            if (line.startsWith('> [!')) {
                const alertType = line.match(/\[!(.*?)\]/)?.[1] || 'NOTE';
                const alertLines: string[] = [];
                i++; // skip the > [!TYPE] line
                while (i < lines.length && lines[i].startsWith('> ')) {
                    alertLines.push(lines[i].replace(/^>\s?/, ''));
                    i++;
                }
                const colorMap: Record<string, string> = {
                    WARNING: 'bg-amber-950/30 border-amber-500 text-amber-200',
                    CAUTION: 'bg-red-950/30 border-red-500 text-red-200',
                    NOTE: 'bg-blue-950/30 border-blue-500 text-blue-200',
                    TIP: 'bg-emerald-950/30 border-emerald-500 text-emerald-200',
                    IMPORTANT: 'bg-purple-950/30 border-purple-500 text-purple-200',
                };
                const colors = colorMap[alertType] || colorMap.NOTE;
                elements.push(
                    <div key={`alert-${i}`} className={`my-4 p-4 border-l-4 rounded-r-lg text-sm ${colors}`}>
                        {alertLines.map((l, j) => <p key={j}>{renderInline(l)}</p>)}
                    </div>
                );
                continue;
            }

            // List item
            if (line.startsWith('- ')) {
                elements.push(
                    <li key={i} className="ml-4 mb-1.5 text-slate-300 text-sm list-disc marker:text-teal-500">
                        {renderInline(line.replace('- ', ''))}
                    </li>
                );
                i++;
                continue;
            }

            // Empty line
            if (line.trim() === '') {
                elements.push(<div key={i} className="h-2" />);
                i++;
                continue;
            }

            // Default paragraph
            elements.push(
                <p key={i} className="mb-2 text-slate-300 text-sm leading-relaxed">
                    {renderInline(line)}
                </p>
            );
            i++;
        }

        return elements;
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] border-b border-slate-800">
            {/* Context Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-[#0d1117]">
                <div className="text-blue-400">
                    <FileText size={16} />
                </div>
                <span className="font-semibold text-slate-200 tracking-wide text-xs uppercase">Problem Context</span>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <article className="prose prose-invert prose-sm max-w-none">
                    {renderContent(content)}
                </article>
            </div>
        </div>
    );
}
