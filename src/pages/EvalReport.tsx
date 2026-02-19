import { CheckCircle, XCircle, AlertTriangle, Clock, Trophy, ArrowRight, BarChart3 } from 'lucide-react';
import type { StepResultData } from '../services/api';

interface EvalReportProps {
    topic: string;
    difficulty: string;
    score: number;
    totalSteps: number;
    correctAnswers: number;
    steps: StepResultData[];
    aiSummary: string;
    onGoToDashboard: () => void;
}

export default function EvalReport({
    topic,
    difficulty,
    score,
    totalSteps,
    correctAnswers,
    steps,
    aiSummary,
    onGoToDashboard,
}: EvalReportProps) {
    const passed = score >= 60;

    const diffColor = difficulty === 'Hard' ? 'text-red-400' : difficulty === 'Medium' ? 'text-amber-400' : 'text-green-400';

    // Calculate 3-tier counts
    const partialCount = steps.filter(s => s.status === 'partially_correct').length;
    const incorrectCount = steps.filter(s => s.status === 'incorrect' || (!s.status && !s.correct)).length;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Evaluation Report</h1>
                    <p className="text-slate-400">
                        {topic} • <span className={diffColor}>{difficulty}</span>
                    </p>
                </div>

                {/* Score Card */}
                <div className={`rounded-2xl p-8 mb-8 border ${passed ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-red-950/30 border-red-500/30'}`}>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        {/* Circular Score */}
                        <div className="relative w-36 h-36 flex-shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                                <circle
                                    cx="60" cy="60" r="52" fill="none"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(score / 100) * 327} 327`}
                                    className={passed ? 'stroke-emerald-400' : 'stroke-red-400'}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-3xl font-bold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>{score}%</span>
                                <span className="text-xs text-slate-500 uppercase tracking-wider">{passed ? 'Passed' : 'Needs Work'}</span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                <Trophy size={20} className={passed ? 'text-emerald-400' : 'text-red-400'} />
                                <span className="text-xl font-semibold">
                                    {passed ? 'Assessment Passed' : 'Assessment Needs Improvement'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 gap-3 mt-4">
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-emerald-400">{correctAnswers}</div>
                                    <div className="text-xs text-slate-500">Correct</div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-amber-400">{partialCount}</div>
                                    <div className="text-xs text-slate-500">Partial</div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-red-400">{incorrectCount}</div>
                                    <div className="text-xs text-slate-500">Incorrect</div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-slate-100">{totalSteps}</div>
                                    <div className="text-xs text-slate-500">Total</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Summary */}
                {aiSummary && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={16} className="text-purple-400" />
                            <h2 className="text-lg font-semibold">AI Analysis</h2>
                        </div>
                        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{aiSummary}</div>
                    </div>
                )}

                {/* Per-Step Breakdown */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-slate-800">
                        <h2 className="text-lg font-semibold">Step-by-Step Breakdown</h2>
                    </div>
                    <div className="divide-y divide-slate-800">
                        {steps.map((step, i) => {
                            const status = step.status || (step.correct ? 'correct' : 'incorrect');
                            return (
                                <div key={i} className="px-6 py-4">
                                    <div className="flex items-start gap-3">
                                        {status === 'correct' ? (
                                            <CheckCircle size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                        ) : status === 'partially_correct' ? (
                                            <AlertTriangle size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <XCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-300 font-medium mb-1">
                                                Step {i + 1}: {step.instruction}
                                            </p>
                                            <div className="inline-block mb-2">
                                                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${status === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        status === 'partially_correct' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {status === 'correct' ? 'Correct' : status === 'partially_correct' ? 'Partially Correct' : 'Incorrect'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                                <div className="bg-slate-800/50 rounded px-3 py-2">
                                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-0.5">Your Answer</span>
                                                    <code className="text-xs text-slate-300">{step.userAnswer}</code>
                                                </div>
                                                <div className="bg-slate-800/50 rounded px-3 py-2">
                                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-0.5">Expected</span>
                                                    <code className="text-xs text-emerald-400">{step.expectedAnswer}</code>
                                                </div>
                                            </div>
                                            {step.feedback && (
                                                <p className="text-xs text-slate-500 mt-2 italic">{step.feedback}</p>
                                            )}
                                            {step.timeTakenMs > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Clock size={10} className="text-slate-600" />
                                                    <span className="text-[10px] text-slate-600">
                                                        {Math.round(step.timeTakenMs / 1000)}s
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CTA */}
                <div className="text-center">
                    <button
                        onClick={onGoToDashboard}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-semibold px-8 py-3 rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all"
                    >
                        Go to Dashboard
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
