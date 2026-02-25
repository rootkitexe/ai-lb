import { FileText } from 'lucide-react';
import React from 'react';

interface ProblemStatementProps {
    content: string;
    blanks?: { instruction: string }[];
    visibleUntilBlank?: number; // For sequential revealing in Demo Mode
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

export default function ProblemStatement({ content, blanks, visibleUntilBlank }: ProblemStatementProps) {
    const renderContent = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let i = 0;
        let instructionCount = 0;

        while (i < lines.length) {
            const line = lines[i];

            // ─── SEQUENTIAL REVEAL LOGIC (DEMO MODE) ───
            if (visibleUntilBlank !== undefined) {
                // Check if this line is an "At Blank N" instruction
                // Flexible regex to match "At Blank 5", "**At Blank: 5**", etc.
                const instructionMatch = line.match(/At\s+Blank\s*[:#-]?\s*\d+/i);
                if (instructionMatch) {
                    instructionCount++;
                    // If we've reached an instruction beyond what we're allowed to see, STOP rendering
                    if (instructionCount > visibleUntilBlank) {
                        break;
                    }
                }
            }

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
                    const content = lines[i].replace(/^>\s?/, '');

                    // Also check for hidden instructions inside alert block (edge case)
                    if (visibleUntilBlank !== undefined) {
                        const innerMatch = content.match(/At\s+Blank\s*[:#-]?\s*\d+/i);
                        // If there's an instruction inside the alert, we should technically count it.
                        // But since we peek earlier, let's keep it simple: just break the inner loop 
                        // if we find one so outer loop handles it.
                        if (innerMatch) {
                            if (instructionCount + 1 > visibleUntilBlank) {
                                break;
                            }
                        }
                    }

                    alertLines.push(content);
                    i++;
                }

                // If we broke out of the inner loop due to finding a future instruction,
                // we should also break out of the outer loop (checking if i is still within limits effectively covers this if we manipulated i, 
                // but better check if we found a stopper).
                // Actually, the inner break only exits the while loop for alerts. 
                // We need to re-check if we should stop rendering entirely.
                // Re-check the last processed line for the condition? 
                // A simpler way: if the loop ended early or if the last line checked was the stopper.
                // Let's iterate through alertLines and check.
                // Better approach: filter valid lines first? No, let's keep it simple.
                // If we found a future instruction in the alert block, we should probably not render this alert AT ALL if it starts with it?
                // The prompt structure is usually:
                // > [!NOTE]
                // > **At Blank 2:** ...
                // So if the FIRST line of the alert body is future, we skip the whole alert and break.

                if (alertLines.length > 0 && visibleUntilBlank !== undefined) {
                    const firstLineMatch = alertLines[0].match(/At\s+Blank\s*[:#-]?\s*\d+/i);
                    // Instead of using parsed numbers, we peek at the first line. 
                    // If it's an instruction, and we're strictly checking count,
                    // we can't reliably predict its count position if we skip it.
                    // But if it IS an instruction, the outer loop would have caught it 
                    // if it wasn't swallowed by the alert inner loop.
                    // Wait, the outer loop didn't catch it!
                    // Let's increment instructionCount if it IS an instruction
                    if (firstLineMatch) {
                        if (instructionCount + 1 > visibleUntilBlank) {
                            break; // Stop rendering completely
                        }
                    }
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
