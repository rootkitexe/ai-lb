import { useEffect, useRef, useState, useCallback } from 'react';
import { Bot, Send, Loader2, MessageSquare, Mic, MicOff } from 'lucide-react';
import { LogicScenario } from '../data/scenario';
import { sendMessageToAI, validateAnswer, ChatMessage, AnswerStatus } from '../services/ai';

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

interface AiInterviewerProps {
    scenario: LogicScenario;
    currentStep: number;
    variables: Record<string, string>;
    onStepSuccess: (vars: Record<string, string>) => void;
    onTestComplete?: (results: StepResult[]) => void;
}

interface UIMessage extends ChatMessage {
    id: number;
    isDirective?: boolean;
    messageType?: 'normal' | 'correct' | 'partial' | 'incorrect' | 'summary';
}

export default function AiInterviewer({ scenario, currentStep, variables: _variables, onStepSuccess, onTestComplete }: AiInterviewerProps) {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'text' | 'voice'>('text');

    // ── Voice State ──
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    // ── Step Result Tracking ──
    const stepResultsRef = useRef<StepResult[]>([]);
    const stepStartTimeRef = useRef<number>(Date.now());
    const [testFinished, setTestFinished] = useState(false);
    // Track which steps have been answered (prevent re-answering)
    const answeredStepsRef = useRef<Set<number>>(new Set());

    const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // Keep track of the conversation for the API context
    const historyRef = useRef<ChatMessage[]>([]);

    const addMessage = (role: 'user' | 'assistant', content: string, isDirective = false, messageType: UIMessage['messageType'] = 'normal') => {
        const newMsg: UIMessage = { id: Date.now() + Math.random(), role, content, isDirective, messageType };
        setMessages(prev => [...prev, newMsg]);
        historyRef.current.push({ role, content });
    };

    const callAI = async (triggerMsg?: string) => {
        setIsLoading(true);
        try {
            const apiHistory = [...historyRef.current];
            if (triggerMsg) {
                apiHistory.push({ role: 'system', content: triggerMsg });
            }

            const response = await sendMessageToAI(apiHistory, scenario, currentStep);

            if (response) {
                const isDirective = !!triggerMsg;
                addMessage('assistant', response.content, isDirective);
            }
        } catch (e) {
            addMessage('assistant', "Connection interrupted. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Initial Greeting
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (!hasInitialized.current && messages.length === 0) {
            hasInitialized.current = true;

            addMessage('assistant', `Welcome! I'll be your interviewer today for the **${scenario.title}** scenario.\n\nPlease review the problem context on the left panel. When you're ready, let's begin with the first step.`);

            const firstStep = scenario.steps[0];
            if (firstStep) {
                addMessage('assistant', firstStep.instruction, true);
            }
        }
    }, []);

    // React to Step Changes — show next question when step advances
    const lastStepRef = useRef(currentStep);
    useEffect(() => {
        if (currentStep > lastStepRef.current) {
            lastStepRef.current = currentStep;

            const nextStep = scenario.steps[currentStep];

            if (nextStep) {
                // Show the next question after a brief pause
                setTimeout(() => {
                    addMessage('assistant', nextStep.instruction, true);
                    stepStartTimeRef.current = Date.now();
                }, 500);
            } else {
                // All steps done — generate and show summary
                generateTestSummary();
            }
        }
    }, [currentStep]);

    // Generate the end-of-test summary in chat
    const generateTestSummary = () => {
        const results = stepResultsRef.current;
        const totalSteps = scenario.steps.length;

        let summaryLines = [`🎉 **Assessment Complete!**\n`];
        summaryLines.push(`Here's how you did:\n`);

        let correctCount = 0;
        let partialCount = 0;

        results.forEach((r, i) => {
            const icon = r.status === 'correct' ? '✅' : r.status === 'partially_correct' ? '⚠️' : '❌';
            const label = r.status === 'correct' ? 'Correctly answered' : r.status === 'partially_correct' ? 'Partially correct' : 'Incorrect';
            summaryLines.push(`**Step ${i + 1}:** ${icon} ${label}`);

            if (r.status === 'correct') correctCount++;
            else if (r.status === 'partially_correct') partialCount++;
        });

        // Fill in any unanswered steps as incorrect
        for (let i = results.length; i < totalSteps; i++) {
            summaryLines.push(`**Step ${i + 1}:** ❌ Not answered`);
        }

        const score = Math.round(((correctCount + partialCount * 0.5) / totalSteps) * 100);
        summaryLines.push(`\n**Score: ${score}%** (${correctCount} correct, ${partialCount} partial, ${totalSteps - correctCount - partialCount} incorrect out of ${totalSteps})`);
        summaryLines.push(`\nClick **Submit Assessment** below to save your results and view the full report.`);

        addMessage('assistant', summaryLines.join('\n'), false, 'summary');
        setTestFinished(true);
    };

    const handleSend = async (overrideText?: string) => {
        const textToSend = overrideText || input;
        if (!textToSend.trim() || isLoading) return;

        if (!overrideText) setInput('');
        addMessage('user', textToSend.trim());

        const activeStep = scenario.steps[currentStep];
        if (!activeStep) {
            // Test is already done, just chat
            await callAI();
            return;
        }

        // Check if this step was already answered
        if (answeredStepsRef.current.has(currentStep)) {
            addMessage('assistant', "You've already answered this step. Moving on...");
            return;
        }

        // ── Single-Attempt Validation ──
        setIsLoading(true);
        const stepStarted = stepStartTimeRef.current;
        try {
            const result = await validateAnswer(textToSend.trim(), activeStep, scenario);

            // Mark step as answered
            answeredStepsRef.current.add(currentStep);

            // Track this step result
            const stepResult: StepResult = {
                stepIndex: currentStep,
                instruction: activeStep.instruction,
                userAnswer: textToSend.trim(),
                expectedAnswer: activeStep.expectedAnswer,
                correct: result.correct,
                status: result.status,
                feedback: result.feedback,
                timeTakenMs: Date.now() - stepStarted,
            };
            stepResultsRef.current.push(stepResult);

            // Show feedback with status indicator
            const statusIcon = result.status === 'correct' ? '✅' : result.status === 'partially_correct' ? '⚠️' : '❌';
            const statusLabel = result.status === 'correct' ? 'Correct' : result.status === 'partially_correct' ? 'Partially Correct' : 'Incorrect';
            const messageType: UIMessage['messageType'] = result.status === 'correct' ? 'correct' : result.status === 'partially_correct' ? 'partial' : 'incorrect';

            addMessage('assistant', `${statusIcon} **${statusLabel}**\n${result.feedback}`, false, messageType);

            // Always advance to next step (regardless of correctness)
            const newVars: Record<string, string> = {};
            if (activeStep.captureVariable) {
                newVars[activeStep.captureVariable.name] = activeStep.captureVariable.value;
            }
            onStepSuccess(newVars);

        } catch (e) {
            addMessage('assistant', "Could not validate your answer. Please try again.");
            // Don't mark as answered so they can retry on error
        } finally {
            setIsLoading(false);
        }
    };

    // ── Speech Recognition ──
    const startListening = useCallback(() => {
        if (!speechSupported || isLoading) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            setTranscript(finalTranscript || interimTranscript);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setTranscript('');
    }, [speechSupported, isLoading]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const handleVoiceSend = useCallback(() => {
        if (transcript.trim()) {
            const text = transcript.trim();
            setTranscript('');
            stopListening();
            handleSend(text);
        }
    }, [transcript, stopListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Get message background color based on type
    const getMessageStyle = (msg: UIMessage) => {
        if (msg.role === 'user') {
            return 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-br-none';
        }
        if (msg.messageType === 'correct') {
            return 'bg-emerald-950/50 text-emerald-200 border border-emerald-500/30';
        }
        if (msg.messageType === 'partial') {
            return 'bg-amber-950/50 text-amber-200 border border-amber-500/30';
        }
        if (msg.messageType === 'incorrect') {
            return 'bg-red-950/50 text-red-200 border border-red-500/30';
        }
        if (msg.messageType === 'summary') {
            return 'bg-slate-800/80 text-slate-200 border border-teal-500/30 shadow-lg';
        }
        if (msg.isDirective) {
            if (msg.content.startsWith('[SYSTEM]')) {
                return 'bg-slate-950 text-slate-500 border border-slate-800 font-mono text-xs w-full max-w-full';
            }
            return 'bg-slate-800/80 text-slate-200 border border-slate-700/50 shadow-md backdrop-blur-sm';
        }
        return 'bg-slate-800/50 text-slate-300 border border-slate-800';
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
            {/* Header with Progress */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/95 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                        <Bot size={18} />
                    </div>
                    <div>
                        <div className="font-semibold text-sm text-slate-200">AI Interviewer</div>
                        <div className="text-xs text-slate-500">Step {Math.min(currentStep + 1, scenario.steps.length)} of {scenario.steps.length}</div>
                    </div>
                </div>

                {/* Visual Progress Steps — color-coded by result */}
                <div className="flex gap-1">
                    {scenario.steps.map((_, idx) => {
                        const result = stepResultsRef.current.find(r => r.stepIndex === idx);
                        let color = 'bg-slate-800'; // not yet reached
                        if (result) {
                            color = result.status === 'correct' ? 'bg-emerald-500' : result.status === 'partially_correct' ? 'bg-amber-500' : 'bg-red-500';
                        } else if (idx === currentStep) {
                            color = 'bg-teal-500'; // current step
                        }
                        return (
                            <div
                                key={idx}
                                className={`h-1.5 w-6 rounded-full ${color}`}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="flex items-center gap-2 mb-2 ml-1">
                                <Bot size={14} className="text-teal-500" />
                                <span className="text-xs font-medium text-teal-500 uppercase tracking-wider">
                                    {msg.isDirective ? 'Question' : msg.messageType === 'summary' ? 'Results' : 'Interviewer'}
                                </span>
                            </div>
                        )}

                        <div className={`max-w-[90%] rounded-xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${getMessageStyle(msg)}`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex flex-col items-start animate-pulse">
                        <div className="flex items-center gap-2 mb-2 ml-1">
                            <Bot size={14} className="text-teal-500" />
                            <span className="text-xs font-medium text-teal-500">EVALUATING</span>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl px-5 py-4 flex items-center gap-2 border border-slate-800">
                            <Loader2 size={16} className="animate-spin text-teal-500" />
                            <span className="text-xs text-slate-500">Evaluating your answer...</span>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-slate-800">
                {/* Input Tabs */}
                <div className="flex items-center gap-4 px-2 mb-2">
                    <button
                        onClick={() => { setActiveTab('text'); stopListening(); }}
                        className={`flex items-center gap-1.5 text-xs font-medium pb-2 border-b-2 transition-colors ${activeTab === 'text' ? 'text-teal-400 border-teal-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                    >
                        <MessageSquare size={14} />
                        Text
                    </button>
                    <button
                        onClick={() => setActiveTab('voice')}
                        className={`flex items-center gap-1.5 text-xs font-medium pb-2 border-b-2 transition-colors ${activeTab === 'voice' ? 'text-teal-400 border-teal-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                    >
                        <Mic size={14} />
                        Voice
                    </button>
                </div>

                {activeTab === 'text' ? (
                    /* ── Text Input ── */
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={testFinished ? "Assessment complete" : "Type your answer..."}
                            disabled={isLoading || testFinished}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-4 text-sm focus:border-teal-500/30 focus:ring-1 focus:ring-teal-500/20 outline-none text-slate-200 transition-all disabled:opacity-50 placeholder:text-slate-600 relative z-10"
                        />
                        <div className="absolute right-2 top-2 h-full flex items-center z-20">
                            <button
                                onClick={() => handleSend()}
                                className={`p-2 rounded-lg transition-all ${input.trim() && !isLoading && !testFinished ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20 hover:bg-teal-400' : 'bg-slate-900 text-slate-600'}`}
                                disabled={!input.trim() || isLoading || testFinished}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Voice Input ── */
                    <div className="flex flex-col items-center gap-3">
                        {!speechSupported ? (
                            <div className="text-sm text-red-400 py-4">
                                Your browser doesn't support speech recognition. Try Chrome or Edge.
                            </div>
                        ) : (
                            <>
                                {/* Transcript Preview */}
                                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 min-h-[52px] text-sm text-slate-200 flex items-center">
                                    {transcript ? (
                                        <span>{transcript}</span>
                                    ) : (
                                        <span className="text-slate-600 italic">
                                            {isListening ? 'Listening...' : testFinished ? 'Assessment complete' : 'Click the mic to start speaking'}
                                        </span>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={isListening ? stopListening : startListening}
                                        disabled={isLoading || testFinished}
                                        className={`p-4 rounded-full transition-all ${isListening
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse hover:bg-red-400'
                                            : 'bg-teal-500 text-white shadow-lg shadow-teal-500/20 hover:bg-teal-400'
                                            } disabled:opacity-50`}
                                    >
                                        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                    </button>

                                    {transcript.trim() && (
                                        <button
                                            onClick={handleVoiceSend}
                                            disabled={isLoading || testFinished}
                                            className="p-3 rounded-lg bg-teal-500 text-white shadow-lg shadow-teal-500/20 hover:bg-teal-400 transition-all disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="flex justify-between items-center mt-2 px-1">
                    <span className="text-[10px] text-slate-500">
                        {activeTab === 'text' ? 'Press Enter to send, Shift+Enter for new line' : isListening ? 'Tap mic to stop, then send' : 'Tap mic to start speaking'}
                    </span>
                </div>

                {/* Submit Button after Test Complete */}
                {testFinished && onTestComplete && (
                    <button
                        onClick={() => onTestComplete(stepResultsRef.current)}
                        className="w-full mt-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold py-3 rounded-lg hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2"
                    >
                        Submit Assessment & View Report
                    </button>
                )}
            </div>
        </div>
    );
}
