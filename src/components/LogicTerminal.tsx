import { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Minus, Plus } from 'lucide-react';
import { LogicScenario } from '../data/scenario';

export interface TerminalLine {
    type: 'cmd' | 'out' | 'err' | 'system';
    content: string;
}

interface LogicTerminalProps {
    scenario: LogicScenario;
    history: TerminalLine[];
    isMinimized: boolean;
    onToggleMinimize: () => void;
}

export default function LogicTerminal({
    scenario,
    history,
    isMinimized,
    onToggleMinimize,
}: LogicTerminalProps) {
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    return (
        <div className="flex flex-col h-full bg-[#0d1117] font-mono text-sm">
            {/* Terminal Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0d1117] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="text-pink-500">
                        <TerminalIcon size={16} />
                    </div>
                    <span className="font-semibold text-slate-200 tracking-wide text-xs uppercase">Live Terminal</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggleMinimize}
                        className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        title={isMinimized ? 'Expand terminal' : 'Minimize terminal'}
                    >
                        {isMinimized ? <Plus size={14} /> : <Minus size={14} />}
                    </button>
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                    </div>
                </div>
            </div>

            {/* Terminal Output Area */}
            {!isMinimized && (
                <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    {history.map((line, i) => (
                        <div key={i} className={`whitespace-pre-wrap break-all ${line.type === 'cmd' ? 'text-slate-100 font-bold mt-2' :
                            line.type === 'err' ? 'text-red-400' :
                                line.type === 'system' ? 'text-teal-500/70 italic' :
                                    'text-emerald-400'
                            }`}>
                            {line.type === 'cmd' && <span className="text-slate-500 mr-2">$</span>}
                            {line.content}
                        </div>
                    ))}

                    {/* Active Cursor Line (Fake) */}
                    <div className="flex items-center mt-2 group opacity-50">
                        <span className="text-pink-500 mr-2 font-bold">➜</span>
                        <span className="text-cyan-500 mr-2">~</span>
                        <span className="w-2 h-4 bg-slate-500 animate-pulse"></span>
                    </div>
                    <div ref={endRef} />
                </div>
            )}

        </div>
    );
}
