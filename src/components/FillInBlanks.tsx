import { useEffect, useRef, useState } from 'react';
import { Bot, Play, Loader2, Send, Mic, MicOff, Check, ArrowRight } from 'lucide-react';
import { LogicScenario } from '../data/scenario';
import { validateAnswer, AnswerStatus } from '../services/ai';

// Web Speech API types
interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionErrorEvent {
    error: string;
}
interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

export interface StepResult {
    stepIndex: number;
    instruction: string;
    userAnswer: string;
    expectedAnswer: string;
    correct: boolean;
    status: AnswerStatus;
    feedback: string;
    timeTakenMs: number;
}

interface FillInBlanksProps {
    scenario: LogicScenario;
    currentStep: number;
    isDemoMode?: boolean;
    onStepSuccess: (vars: Record<string, string>) => void;
    onTestComplete?: (results: StepResult[]) => void;
}

type Phase = 'answering' | 'evaluating' | 'results';

interface BlankFeedback {
    status: AnswerStatus;
    feedback: string;
}

export default function FillInBlanks({ scenario, currentStep, isDemoMode = false, onStepSuccess, onTestComplete }: FillInBlanksProps) {
    const totalBlanks = scenario.steps.length;
    const template = scenario.codeTemplate || '';

    // One answer per blank
    const [answers, setAnswers] = useState<string[]>(() => Array(totalBlanks).fill(''));
    const [phase, setPhase] = useState<Phase>('answering');
    const [feedbacks, setFeedbacks] = useState<(BlankFeedback | null)[]>(() => Array(totalBlanks).fill(null));
    const [evalProgress, setEvalProgress] = useState(0);
    const [stepResults, setStepResults] = useState<StepResult[]>([]);

    // For single-step validation (Demo Mode)
    const [isValidatingStep, setIsValidatingStep] = useState(false);

    const testStartRef = useRef(Date.now());
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const topRef = useRef<HTMLDivElement>(null);

    // Voice
    const [voiceTarget, setVoiceTarget] = useState<number | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, totalBlanks);
        // Only focus first blank initially or when step changes in Demo Mode
        if (!isDemoMode) {
            setTimeout(() => inputRefs.current[0]?.focus(), 200);
        } else {
            setTimeout(() => inputRefs.current[currentStep]?.focus(), 200);
        }
    }, [totalBlanks, isDemoMode, currentStep]);

    useEffect(() => {
        return () => { recognitionRef.current?.abort(); };
    }, []);

    const updateAnswer = (idx: number, val: string) => {
        setAnswers(prev => { const a = [...prev]; a[idx] = val; return a; });
    };

    // Voice
    const startListening = (idx: number) => {
        if (!speechSupported || isListening) return;
        setVoiceTarget(idx);
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const r = new SR();
        r.continuous = false; r.interimResults = false; r.lang = 'en-US';
        r.onresult = (e: SpeechRecognitionEvent) => {
            const t = e.results[e.resultIndex][0].transcript;
            updateAnswer(idx, answers[idx] ? `${answers[idx]} ${t}` : t);
        };
        r.onerror = () => { setIsListening(false); setVoiceTarget(null); };
        r.onend = () => { setIsListening(false); setVoiceTarget(null); };
        recognitionRef.current = r;
        r.start();
        setIsListening(true);
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
        setIsListening(false);
        setVoiceTarget(null);
    };

    const filledCount = answers.filter(a => a.trim() !== '').length;

    // ── Submit all (Batch Mode) ──
    const handleSubmitAll = async () => {
        stopListening();
        setPhase('evaluating');
        setEvalProgress(0);

        const results: StepResult[] = [];
        const fbs: (BlankFeedback | null)[] = [];
        const elapsed = Date.now() - testStartRef.current;
        const perStep = Math.round(elapsed / totalBlanks);

        for (let i = 0; i < totalBlanks; i++) {
            setEvalProgress(i + 1);
            const step = scenario.steps[i];
            const ans = answers[i].trim();

            if (!ans) {
                results.push({ stepIndex: i, instruction: step.instruction, userAnswer: '(no answer)', expectedAnswer: step.expectedAnswer, correct: false, status: 'incorrect', feedback: 'No answer provided.', timeTakenMs: perStep });
                fbs.push({ status: 'incorrect', feedback: 'No answer provided.' });
                continue;
            }
            try {
                const v = await validateAnswer(ans, step, scenario);
                results.push({ stepIndex: i, instruction: step.instruction, userAnswer: ans, expectedAnswer: step.expectedAnswer, correct: v.correct, status: v.status, feedback: v.feedback, timeTakenMs: perStep });
                fbs.push({ status: v.status, feedback: v.feedback });
            } catch {
                results.push({ stepIndex: i, instruction: step.instruction, userAnswer: ans, expectedAnswer: step.expectedAnswer, correct: false, status: 'incorrect', feedback: 'Evaluation failed.', timeTakenMs: perStep });
                fbs.push({ status: 'incorrect', feedback: 'Evaluation failed.' });
            }
        }

        setStepResults(results);
        setFeedbacks(fbs);
        setPhase('results');
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // ── Validate Single Step (Demo Mode) ──
    const handleValidateSingle = async () => {
        if (isValidatingStep) return;
        setIsValidatingStep(true);
        stopListening();

        const idx = currentStep;
        const step = scenario.steps[idx];
        const ans = answers[idx].trim();
        const elapsed = Date.now() - testStartRef.current; // Rough timing

        let result: StepResult;
        let fb: BlankFeedback;

        try {
            if (!ans) {
                fb = { status: 'incorrect', feedback: 'Please enter an answer.' };
                result = { stepIndex: idx, instruction: step.instruction, userAnswer: '(no answer)', expectedAnswer: step.expectedAnswer, correct: false, status: 'incorrect', feedback: 'Please enter an answer.', timeTakenMs: 0 };
            } else {
                const v = await validateAnswer(ans, step, scenario);
                fb = { status: v.status, feedback: v.feedback };
                result = { stepIndex: idx, instruction: step.instruction, userAnswer: ans, expectedAnswer: step.expectedAnswer, correct: v.correct, status: v.status, feedback: v.feedback, timeTakenMs: 0 };
            }
        } catch (e) {
            fb = { status: 'incorrect', feedback: 'Error validating.' };
            result = { stepIndex: idx, instruction: step.instruction, userAnswer: ans, expectedAnswer: step.expectedAnswer, correct: false, status: 'incorrect', feedback: 'Error validating.', timeTakenMs: 0 };
        }

        // Update feedbacks ONLY for this index
        setFeedbacks(prev => {
            const next = [...prev];
            next[idx] = fb;
            return next;
        });

        setIsValidatingStep(false);

        // Always proceed to next step (Demo Mode acts as a Test now)
        // Add result to stepResults regardless of correctness
        setStepResults(prev => [...prev, result]);
        onStepSuccess({});

        // Check if last step
        if (idx === totalBlanks - 1) {
            setPhase('results');
            // Could auto-complete here or let user click "Finish"
        }
    };

    // ── Build the code view ──
    const renderUnifiedTemplate = () => {
        if (!template) {
            // Fallback: show blanks as a plain list
            // (Simplified logic for brevity as most scenarios use unified template now)
            return (
                <div className="text-slate-500">Template not available. Please regenerate scenario.</div>
            );
        }

        const regex = /___BLANK_(\d+)___/g;
        const parts: { type: 'text' | 'blank'; content: string; blankIdx?: number }[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(template)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: template.slice(lastIndex, match.index) });
            }
            parts.push({ type: 'blank', content: match[0], blankIdx: parseInt(match[1]) - 1 });
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < template.length) {
            parts.push({ type: 'text', content: template.slice(lastIndex) });
        }

        return (
            <div className="bg-[#0d1117] rounded-xl border border-slate-800 overflow-hidden">
                {/* Code window header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-800">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500/70"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500/70"></div>
                    </div>
                    <span className="text-xs text-slate-500 ml-2 font-mono">Sample Code</span>
                </div>

                {/* Code with inline blanks */}
                <div className="p-5 font-mono text-sm leading-relaxed overflow-x-auto">
                    <pre className="whitespace-pre-wrap text-slate-300">
                        {parts.map((part, i) => {
                            if (part.type === 'text') {
                                return <span key={i}>{part.content}</span>;
                            }
                            const idx = part.blankIdx!;
                            const fb = feedbacks[idx];

                            // ── DEMO MODE LOGIC ──
                            // Locked: if demo mode and index > currentStep
                            // Completed: if demo mode and index < currentStep (or if it has positive feedback)
                            // Active: if demo mode and index === currentStep

                            const isLocked = isDemoMode && idx > currentStep && phase !== 'results';
                            const isCompleted = isDemoMode && idx < currentStep;
                            const isActive = !isDemoMode || idx === currentStep;

                            // Determine style
                            let inputColor = 'border-teal-500/50 text-teal-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20';

                            if (phase === 'results' && fb) {
                                // Final results view (or completed steps in demo)
                                inputColor = fb.status === 'correct'
                                    ? 'border-emerald-500/60 text-emerald-300 bg-emerald-950/30'
                                    : fb.status === 'partially_correct'
                                        ? 'border-amber-500/60 text-amber-300 bg-amber-950/30'
                                        : 'border-red-500/60 text-red-300 bg-red-950/30';
                            } else if (isCompleted && fb) {
                                // Already solved in demo mode - Color based on result
                                inputColor = fb.status === 'correct'
                                    ? 'border-emerald-500/60 text-emerald-300 bg-emerald-950/30'
                                    : fb.status === 'partially_correct'
                                        ? 'border-amber-500/60 text-amber-300 bg-amber-950/30'
                                        : 'border-red-500/60 text-red-300 bg-red-950/30';
                            } else if (isLocked) {
                                inputColor = 'border-slate-700 text-slate-500 bg-slate-800/50 cursor-not-allowed';
                            }

                            return (
                                <span key={i} className="inline-block align-middle my-0.5">
                                    <span className={`text-[10px] mr-1 font-bold ${isLocked ? 'text-slate-600' : 'text-teal-500/60'}`}>{idx + 1}</span>
                                    {isLocked ? (
                                        <span className="inline-block px-2 py-0.5 rounded border border-slate-700 bg-slate-800/30 text-slate-600 select-none">???</span>
                                    ) : (
                                        <input
                                            ref={el => { inputRefs.current[idx] = el; }}
                                            type="text"
                                            value={answers[idx]}
                                            onChange={e => updateAnswer(idx, e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    if (isDemoMode) {
                                                        const ans = answers[idx].trim();
                                                        if (ans) handleValidateSingle();
                                                    } else {
                                                        const next = inputRefs.current[idx + 1];
                                                        if (next) next.focus();
                                                        else if (filledCount === totalBlanks) handleSubmitAll();
                                                    }
                                                }
                                            }}
                                            placeholder={isCompleted ? '' : `Blank ${idx + 1}`}
                                            disabled={isCompleted || (phase !== 'answering' && !isDemoMode) || (isDemoMode && phase === 'results')}
                                            className={`bg-slate-950/80 border-2 rounded-md px-2.5 py-1 font-mono text-sm min-w-[100px] max-w-[350px] outline-none transition-all placeholder:text-slate-600 disabled:opacity-80 ${inputColor}`}
                                        />
                                    )}

                                    {/* Mic button (Only active step) */}
                                    {isActive && !isCompleted && phase === 'answering' && speechSupported && !isLocked && (
                                        <button
                                            onClick={() => isListening && voiceTarget === idx ? stopListening() : startListening(idx)}
                                            className={`inline-flex items-center justify-center w-6 h-6 rounded ml-1 transition-all ${isListening && voiceTarget === idx ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-teal-400 hover:bg-teal-500/10'}`}
                                            title={`Voice input for Blank ${idx + 1}`}
                                        >
                                            {isListening && voiceTarget === idx ? <MicOff size={12} /> : <Mic size={12} />}
                                        </button>
                                    )}

                                    {/* Result icon */}
                                    {(phase === 'results' || isCompleted) && fb && (
                                        <span className="ml-1 text-xs">
                                            {fb.status === 'correct' ? '✅' : fb.status === 'partially_correct' ? '⚠️' : '❌'}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </pre>
                </div>
            </div>
        );
    };

    // ── Score summary (results) ──
    const renderScore = () => {
        // Show score if phase is results OR if demo mode is finished (all correct)
        // Actually stepResults will accumulate in demo mode too.
        if (phase !== 'results') return null;

        const correct = stepResults.filter(r => r.status === 'correct').length;
        const partial = stepResults.filter(r => r.status === 'partially_correct').length;
        const incorrect = stepResults.filter(r => r.status === 'incorrect').length;
        const score = Math.round(((correct + partial * 0.5) / totalBlanks) * 100);

        return (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-slate-200">Results</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">{score}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-emerald-400">{correct}</div>
                        <div className="text-[10px] text-emerald-500/70 uppercase tracking-wider">Correct</div>
                    </div>
                    <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-amber-400">{partial}</div>
                        <div className="text-[10px] text-amber-500/70 uppercase tracking-wider">Partial</div>
                    </div>
                    <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-2 text-center">
                        <div className="text-xl font-bold text-red-400">{incorrect}</div>
                        <div className="text-[10px] text-red-500/70 uppercase tracking-wider">Incorrect</div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFeedbackList = () => {
        if (phase !== 'results') return null;
        return (
            <div className="mt-4 space-y-1.5">
                {stepResults.map((r, i) => {
                    const fb = feedbacks[i];
                    if (!fb) return null;
                    const icon = fb.status === 'correct' ? '✅' : fb.status === 'partially_correct' ? '⚠️' : '❌';
                    const label = fb.status === 'correct' ? 'Correct' : fb.status === 'partially_correct' ? 'Partially Correct' : 'Incorrect';
                    const color = fb.status === 'correct' ? 'text-emerald-400' : fb.status === 'partially_correct' ? 'text-amber-400' : 'text-red-400';
                    return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400 font-mono text-xs w-16">Blank {i + 1}</span>
                            <span>{icon}</span>
                            <span className={`font-medium ${color}`}>{label}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Helper for demo mode feedback message (current blank)
    const renderCurrentFeedback = () => {
        if (!isDemoMode || phase === 'results') return null;
        const fb = feedbacks[currentStep];
        if (!fb || fb.status === 'correct') return null; // Don't show if correct (we advanced) or null

        return (
            <div className="mb-4 bg-red-950/30 border border-red-500/30 p-3 rounded-lg text-red-200 text-sm flex items-start gap-2">
                <span>❌</span>
                <span>{fb.feedback}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
            {/* Header */}
            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-5 bg-slate-900/95 backdrop-blur-sm z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                        <Bot size={18} />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-slate-200">Fill in the Blanks</div>
                        <div className="text-xs text-slate-500">
                            {phase === 'answering' ? `${filledCount} of ${totalBlanks} filled` :
                                phase === 'evaluating' ? `Evaluating ${evalProgress}/${totalBlanks}…` :
                                    'Complete'}
                        </div>
                    </div>
                </div>
                {/* Progress dots */}
                <div className="flex gap-1">
                    {scenario.steps.map((_, i) => {
                        const fb = feedbacks[i];
                        let c = answers[i].trim() ? 'bg-teal-500' : 'bg-slate-700';
                        if (phase === 'evaluating' && i < evalProgress) c = 'bg-teal-500 animate-pulse';

                        // Show result color if in results phase OR if we have feedback in demo mode (completed step)
                        if ((phase === 'results' || isDemoMode) && fb) {
                            c = fb.status === 'correct' ? 'bg-emerald-500' : fb.status === 'partially_correct' ? 'bg-amber-500' : 'bg-red-500';
                        }

                        // Demo mode specific dot styling
                        if (isDemoMode && i === currentStep && phase !== 'results') c = 'bg-blue-500 animate-pulse';

                        return <div key={i} className={`h-1.5 w-5 rounded-full transition-colors ${c}`} />;
                    })}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div ref={topRef} />

                {/* Evaluating overlay */}
                {phase === 'evaluating' && (
                    <div className="bg-slate-800/60 rounded-xl border border-teal-500/30 p-6 text-center">
                        <Loader2 size={28} className="animate-spin text-teal-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-slate-200">Evaluating answers…</div>
                        <div className="text-xs text-slate-400 mt-1">{evalProgress} / {totalBlanks}</div>
                        <div className="w-full bg-slate-900 rounded-full h-2 mt-3 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all" style={{ width: `${(evalProgress / totalBlanks) * 100}%` }} />
                        </div>
                    </div>
                )}

                {/* Demo Mode Single Step Feedback */}
                {renderCurrentFeedback()}

                {/* Score (results) */}
                {renderScore()}

                {/* The unified code template */}
                {renderUnifiedTemplate()}

                {/* Feedback list (results) */}
                {renderFeedbackList()}
            </div>

            {/* Bottom bar */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex-shrink-0">
                {phase === 'answering' && (
                    <>
                        {isDemoMode ? (
                            <button
                                onClick={handleValidateSingle}
                                disabled={isValidatingStep || !answers[currentStep]?.trim()}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all ${isValidatingStep || !answers[currentStep]?.trim() ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-500 text-slate-950 hover:bg-blue-400 shadow-lg shadow-blue-500/20'}`}
                            >
                                {isValidatingStep ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                {isValidatingStep ? 'Checking...' : `Check Blank ${currentStep + 1}`}
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmitAll}
                                disabled={filledCount === 0}
                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all ${filledCount > 0 ? 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-lg shadow-teal-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                <Play size={16} /> Run and Validate ({filledCount}/{totalBlanks})
                            </button>
                        )}

                        <div className="text-center mt-1.5 text-[10px] text-slate-500">
                            {isDemoMode ? 'Solve one blank at a time to proceed.' : 'Fill in all blanks, then validate. Press Enter to jump to next blank.'}
                        </div>
                    </>
                )}
                {phase === 'evaluating' && (
                    <div className="w-full py-3 rounded-lg bg-slate-800 text-slate-400 text-sm text-center flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Evaluating…
                    </div>
                )}
                {phase === 'results' && onTestComplete && (
                    <button
                        onClick={() => onTestComplete(stepResults)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all"
                    >
                        <Send size={16} /> Submit Assessment & View Report
                    </button>
                )}
            </div>
        </div>
    );
}
