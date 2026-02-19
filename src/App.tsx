import { useState } from 'react';
import { Terminal, ChevronRight, Home, ArrowLeft, Container, Server, Sparkles, Loader2 } from 'lucide-react';
import FillInBlanks from './components/FillInBlanks';
import type { StepResult } from './components/FillInBlanks';
import ProblemStatement from './components/ProblemStatement';
import { scenarios, LogicScenario } from './data/scenario';
import { aiScenarioConfigs } from './data/aiscenario';
import { generateScenario } from './services/ai';
import { registerUser, submitTest, type UserProfile, type StepResultData } from './services/api';
import OnboardingForm from './pages/OnboardingForm';
import EvalReport from './pages/EvalReport';
import Dashboard from './pages/Dashboard';

type AppView = 'landing' | 'onboarding' | 'assessment' | 'report' | 'dashboard';

function App() {
    const [view, setView] = useState<AppView>('landing');
    const [activeScenario, setActiveScenario] = useState<LogicScenario>(scenarios[0]);
    const [isGenerating, setIsGenerating] = useState(false);

    // User & test state
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [currentTopic, setCurrentTopic] = useState('');
    const [currentDifficulty, setCurrentDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

    // Report state
    const [reportData, setReportData] = useState<{
        score: number;
        totalSteps: number;
        correctAnswers: number;
        steps: StepResultData[];
        aiSummary: string;
    } | null>(null);

    // ─── Landing Page Handlers ───────────────────────────────────────
    const handleStartScenario = (scenario: LogicScenario) => {
        setActiveScenario(scenario);
        setView('assessment');
    };

    const handleStartAIScenario = async (configIdx: number) => {
        if (isGenerating) return;
        setIsGenerating(true);
        try {
            const config = aiScenarioConfigs[configIdx];
            const generated = await generateScenario(config);
            setActiveScenario(generated);
            setView('assessment');
        } catch (e) {
            console.error("Failed to generate scenario", e);
            alert("Failed to generate AI scenario. Please check your API key and try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── Onboarding Handler ──────────────────────────────────────────
    const handleOnboardingComplete = async (
        userData: { name: string; email: string; jobRole: string; experience: 'Junior' | 'Mid' | 'Senior' },
        topic: string,
        difficulty: 'Easy' | 'Medium' | 'Hard'
    ) => {
        setIsGenerating(true);
        try {
            // Register user
            const user = await registerUser(userData);
            setCurrentUser(user);
            setCurrentTopic(topic);
            setCurrentDifficulty(difficulty);

            // Map difficulty to scenario config difficulty
            const expMap: Record<string, 'Junior' | 'Mid' | 'Senior'> = {
                'Easy': 'Junior', 'Medium': 'Mid', 'Hard': 'Senior'
            };

            // Generate AI scenario from user's topic
            const generated = await generateScenario({
                id: `ai-custom-${Date.now()}`,
                title: topic,
                description: `AI-generated ${difficulty} assessment on ${topic}`,
                topic: topic,
                difficulty: expMap[difficulty],
                blanks: 5,
                environment: topic.toLowerCase().includes('docker') ? 'Docker' :
                    topic.toLowerCase().includes('k8s') || topic.toLowerCase().includes('kubernetes') ? 'Kubernetes' :
                        'Cloud',
                tags: [topic, 'AI-Generated', difficulty],
            });

            setActiveScenario(generated);
            setView('assessment');
        } catch (e) {
            console.error("Onboarding failed", e);
            alert("Failed to start assessment. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── Test Submission Handler ─────────────────────────────────────
    const handleTestComplete = async (results: StepResult[]) => {
        const totalSteps = results.length;
        const correctCount = results.filter(r => r.status === 'correct').length;
        const partialCount = results.filter(r => r.status === 'partially_correct').length;
        const score = Math.round(((correctCount + partialCount * 0.5) / totalSteps) * 100);

        // Generate AI summary with 3-tier breakdown
        const strengths = results.filter(r => r.status === 'correct').map(r => r.instruction);
        const partials = results.filter(r => r.status === 'partially_correct').map(r => r.instruction);
        const weaknesses = results.filter(r => r.status === 'incorrect').map(r => r.instruction);
        const aiSummary = [
            `Assessment Summary: ${score}% (${correctCount} correct, ${partialCount} partial, ${totalSteps - correctCount - partialCount} incorrect out of ${totalSteps})`,
            '',
            strengths.length > 0 ? `Strengths:\n${strengths.map(s => `• ${s}`).join('\n')}` : '',
            partials.length > 0 ? `Partially Correct:\n${partials.map(s => `• ${s}`).join('\n')}` : '',
            weaknesses.length > 0 ? `Areas for Improvement:\n${weaknesses.map(s => `• ${s}`).join('\n')}` : '',
            '',
            score >= 80 ? 'Excellent performance! You demonstrated strong competency in this area.' :
                score >= 60 ? 'Good performance with some areas to work on. Keep practicing!' :
                    'You should review the fundamentals of this topic and try again.',
        ].filter(Boolean).join('\n');

        const stepsData: StepResultData[] = results.map(r => ({
            stepIndex: r.stepIndex,
            instruction: r.instruction,
            userAnswer: r.userAnswer,
            expectedAnswer: r.expectedAnswer,
            correct: r.correct,
            status: r.status,
            feedback: r.feedback,
            timeTakenMs: r.timeTakenMs,
        }));

        // Save to DB if user is registered
        if (currentUser) {
            try {
                await submitTest({
                    userId: currentUser._id,
                    topic: currentTopic || activeScenario.title,
                    difficulty: currentDifficulty,
                    steps: stepsData,
                    aiSummary,
                });
            } catch (e) {
                console.error("Failed to save test results:", e);
            }
        }

        setReportData({
            score,
            totalSteps,
            correctAnswers: correctCount,
            steps: stepsData,
            aiSummary,
        });
        setView('report');
    };

    // ─── Router ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30">
            {view === 'landing' && (
                <LandingPage
                    onStartScenario={handleStartScenario}
                    onStartAIScenario={handleStartAIScenario}
                    onStartTest={() => setView('onboarding')}
                    isGenerating={isGenerating}
                />
            )}
            {view === 'onboarding' && (
                <OnboardingForm
                    onComplete={handleOnboardingComplete}
                    isLoading={isGenerating}
                />
            )}
            {view === 'assessment' && (
                <AssessmentView
                    scenario={activeScenario}
                    onBack={() => setView('landing')}
                    onTestComplete={handleTestComplete}
                />
            )}
            {view === 'report' && reportData && (
                <EvalReport
                    topic={currentTopic || activeScenario.title}
                    difficulty={currentDifficulty}
                    score={reportData.score}
                    totalSteps={reportData.totalSteps}
                    correctAnswers={reportData.correctAnswers}
                    steps={reportData.steps}
                    aiSummary={reportData.aiSummary}
                    onGoToDashboard={() => setView(currentUser ? 'dashboard' : 'landing')}
                />
            )}
            {view === 'dashboard' && currentUser && (
                <Dashboard
                    user={currentUser}
                    onStartNew={() => setView('onboarding')}
                    onLogout={() => {
                        setCurrentUser(null);
                        setView('landing');
                    }}
                />
            )}
        </div>
    );
}

// ─── Scenario Card Config ────────────────────────────────────────────
const scenarioCardConfig: Record<string, { icon: typeof Terminal; color: string; tags: string[] }> = {
    'k8s-crashloop': {
        icon: Server,
        color: 'teal',
        tags: ['Kubernetes', 'Debugging', 'Senior'],
    },
    'docker-fill-blanks': {
        icon: Container,
        color: 'blue',
        tags: ['Docker', 'Fill-in-Blanks', 'Mid'],
    },
};

interface LandingPageProps {
    onStartScenario: (s: LogicScenario) => void;
    onStartAIScenario: (idx: number) => void;
    onStartTest: () => void;
    isGenerating: boolean;
}

function LandingPage({ onStartScenario, onStartAIScenario, onStartTest, isGenerating }: LandingPageProps) {
    return (
        <div className="container mx-auto px-4 py-12">
            <header className="mb-12 text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent mb-4">
                    ConAssess
                </h1>
                <p className="text-slate-400 text-lg">Senior Engineering Competency Framework</p>

                {/* CTA: Take AI Test */}
                <button
                    onClick={onStartTest}
                    className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-semibold px-6 py-3 rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all shadow-lg shadow-teal-500/20"
                >
                    <Sparkles size={18} />
                    Take AI Assessment
                </button>
            </header>

            {/* Section: Practice Scenarios */}
            <div className="max-w-5xl mx-auto mb-8">
                <div className="flex items-center gap-2 mb-5">
                    <Terminal size={18} className="text-teal-400" />
                    <h2 className="text-lg font-semibold text-slate-200">Practice Scenarios</h2>
                    <span className="text-xs text-slate-500 ml-2">— No registration required</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenarios.map((sc) => {
                        const config = scenarioCardConfig[sc.id] || { icon: Terminal, color: 'teal', tags: [] };
                        const IconComponent = config.icon;
                        const colorMap: Record<string, string> = {
                            teal: 'text-teal-400 group-hover:bg-teal-950 border-teal-500/50 shadow-teal-900/10',
                            blue: 'text-blue-400 group-hover:bg-blue-950 border-blue-500/50 shadow-blue-900/10',
                        };
                        const colors = colorMap[config.color] || colorMap.teal;
                        const [textColor, hoverBg, borderColor, shadowColor] = colors.split(' ');

                        return (
                            <div
                                key={sc.id}
                                onClick={() => onStartScenario(sc)}
                                className={`group relative bg-slate-900 border border-slate-800 rounded-xl p-6 hover:${borderColor} hover:shadow-lg hover:${shadowColor} transition-all cursor-pointer`}
                            >
                                <div className={`absolute top-4 right-4 ${textColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                    <ChevronRight size={24} />
                                </div>

                                <div className={`h-12 w-12 bg-slate-800 rounded-lg flex items-center justify-center mb-4 ${textColor} ${hoverBg} transition-colors`}>
                                    <IconComponent size={24} />
                                </div>

                                <h3 className="text-xl font-semibold mb-2 text-slate-100">{sc.title}</h3>
                                <p className="text-slate-400 text-sm mb-4">{sc.description}</p>

                                <div className="flex gap-2 flex-wrap">
                                    {config.tags.map((tag) => (
                                        <span key={tag} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-3 flex items-center gap-1.5">
                                    <span className={`text-xs font-medium ${sc.difficulty === 'Senior' ? 'text-red-400' : sc.difficulty === 'Mid' ? 'text-amber-400' : 'text-green-400'}`}>
                                        {sc.difficulty}
                                    </span>
                                    <span className="text-xs text-slate-600">•</span>
                                    <span className="text-xs text-slate-500">{sc.steps.length} steps</span>
                                </div>
                            </div>
                        );
                    })}

                    {/* AI-Generated Scenario Cards */}
                    {aiScenarioConfigs.map((aiConfig, idx) => (
                        <div
                            key={aiConfig.id}
                            onClick={() => !isGenerating && onStartAIScenario(idx)}
                            className={`group relative bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-900/10 transition-all ${isGenerating ? 'pointer-events-none' : 'cursor-pointer'}`}
                        >
                            {/* AI Badge */}
                            <div className="absolute top-4 right-4 flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5">
                                <Sparkles size={10} className="text-purple-400" />
                                <span className="text-[10px] font-medium text-purple-400">AI-Generated</span>
                            </div>

                            <div className="h-12 w-12 bg-slate-800 rounded-lg flex items-center justify-center mb-4 text-purple-400 group-hover:bg-purple-950 transition-colors">
                                {isGenerating ? (
                                    <Loader2 size={24} className="animate-spin" />
                                ) : (
                                    <Sparkles size={24} />
                                )}
                            </div>

                            <h3 className="text-xl font-semibold mb-2 text-slate-100">{aiConfig.title}</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                {isGenerating ? 'AI is preparing your challenge...' : aiConfig.description}
                            </p>

                            <div className="flex gap-2 flex-wrap">
                                {aiConfig.tags.map((tag) => (
                                    <span key={tag} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-3 flex items-center gap-1.5">
                                <span className={`text-xs font-medium ${aiConfig.difficulty === 'Senior' ? 'text-red-400' : aiConfig.difficulty === 'Mid' ? 'text-amber-400' : 'text-green-400'}`}>
                                    {aiConfig.difficulty}
                                </span>
                                <span className="text-xs text-slate-600">•</span>
                                <span className="text-xs text-slate-500">{aiConfig.blanks} steps</span>
                                <span className="text-xs text-slate-600">•</span>
                                <span className="text-xs text-purple-400">Unique every time</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function AssessmentView({ scenario, onBack, onTestComplete }: {
    scenario: LogicScenario;
    onBack: () => void;
    onTestComplete?: (results: StepResult[]) => void;
}) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleStepSuccess = (vars: Record<string, string>) => {
        void vars; // unused but kept for interface compatibility
        setTimeout(() => {
            setCurrentStep(prev => prev + 1);
        }, 500);
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
            {/* Minimal Header */}
            <header className="h-14 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-950 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center text-sm font-medium">
                        <span className="text-slate-400">{scenario.difficulty}</span>
                        <ChevronRight size={14} className="mx-2 text-slate-600" />
                        <span className="text-slate-200">{scenario.title}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
                    >
                        <Home size={14} />
                        <span>Home</span>
                    </button>
                </div>
            </header>

            {/* Main Split Layout */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left Panel: Problem Context (full height) */}
                <div className="w-3/5 border-r border-slate-800 flex flex-col bg-[#0d1117] overflow-hidden">
                    <ProblemStatement content={scenario.context} blanks={scenario.steps} />
                </div>

                {/* Right Panel: AI Interviewer (Chat) */}
                <div className="w-2/5 bg-slate-900 flex flex-col relative min-w-[400px]">
                    <FillInBlanks
                        scenario={scenario}
                        currentStep={currentStep}
                        onStepSuccess={handleStepSuccess}
                        onTestComplete={onTestComplete}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
