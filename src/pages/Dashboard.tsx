import { useState, useEffect } from 'react';
import { Terminal, Trophy, Clock, ChevronRight, Loader2, ArrowLeft, LogOut, Plus, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { getUserTests, getTestReport, type TestSummary, type DetailedTestResult, type UserProfile } from '../services/api';

interface DashboardProps {
    user: UserProfile;
    onStartNew: () => void;
    onLogout: () => void;
}

export default function Dashboard({ user, onStartNew, onLogout }: DashboardProps) {
    const [tests, setTests] = useState<TestSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTest, setSelectedTest] = useState<DetailedTestResult | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        loadTests();
    }, [user._id]);

    const loadTests = async () => {
        try {
            setLoading(true);
            const data = await getUserTests(user._id);
            setTests(data);
        } catch (err) {
            console.error('Failed to load tests:', err);
        } finally {
            setLoading(false);
        }
    };

    const viewReport = async (testId: string) => {
        try {
            setLoadingReport(true);
            const report = await getTestReport(testId);
            setSelectedTest(report);
        } catch (err) {
            console.error('Failed to load report:', err);
        } finally {
            setLoadingReport(false);
        }
    };

    // ─── Detailed Report View ─────────────────────────────────────────
    if (selectedTest) {
        const t = selectedTest;
        const passed = t.score >= 60;
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => setSelectedTest(null)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-200 mb-6 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to Dashboard
                    </button>

                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold mb-1">Test Report: {t.topic}</h1>
                        <p className="text-slate-500 text-sm">
                            {new Date(t.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })} •
                            <span className={t.difficulty === 'Hard' ? 'text-red-400' : t.difficulty === 'Medium' ? 'text-amber-400' : 'text-green-400'}>
                                {' '}{t.difficulty}
                            </span>
                        </p>
                    </div>

                    {/* Score */}
                    <div className={`rounded-2xl p-6 mb-6 border ${passed ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-red-950/30 border-red-500/30'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="relative w-20 h-20">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                                        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round"
                                            strokeDasharray={`${(t.score / 100) * 327} 327`}
                                            className={passed ? 'stroke-emerald-400' : 'stroke-red-400'}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-xl font-bold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>{t.score}%</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-lg font-semibold">{passed ? 'Passed' : 'Needs Improvement'}</div>
                                    <div className="text-sm text-slate-400">{t.correctAnswers}/{t.totalSteps} correct</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Summary */}
                    {t.aiSummary && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 size={14} className="text-purple-400" />
                                <h3 className="text-sm font-semibold text-slate-300">AI Analysis</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{t.aiSummary}</p>
                        </div>
                    )}

                    {/* Steps */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-800">
                            <h3 className="text-sm font-semibold">Step Breakdown</h3>
                        </div>
                        <div className="divide-y divide-slate-800/50">
                            {t.steps.map((step, i) => (
                                <div key={i} className="px-5 py-3 flex items-start gap-3">
                                    {step.correct
                                        ? <CheckCircle size={16} className="text-emerald-400 mt-0.5" />
                                        : <XCircle size={16} className="text-red-400 mt-0.5" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-300">{step.instruction}</p>
                                        <div className="flex gap-4 mt-1">
                                            <span className="text-xs text-slate-500">Your answer: <code className="text-slate-400">{step.userAnswer}</code></span>
                                            {!step.correct && (
                                                <span className="text-xs text-slate-500">Expected: <code className="text-emerald-400/70">{step.expectedAnswer}</code></span>
                                            )}
                                        </div>
                                        {step.feedback && <p className="text-xs text-slate-600 mt-1">{step.feedback}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Dashboard Main View ──────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
                        <p className="text-slate-500 text-sm">Welcome back, {user.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onStartNew}
                            className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 px-4 py-2 rounded-lg hover:bg-teal-500/20 transition-colors text-sm font-medium"
                        >
                            <Plus size={16} />
                            New Test
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-sm transition-colors"
                        >
                            <LogOut size={14} />
                            Logout
                        </button>
                    </div>
                </div>

                {/* Profile Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold text-xl">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">{user.name}</h2>
                            <p className="text-slate-400 text-sm">{user.jobRole} • {user.email}</p>
                            <span className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded ${user.experience === 'Senior' ? 'text-red-400 bg-red-500/10' :
                                    user.experience === 'Mid' ? 'text-amber-400 bg-amber-500/10' :
                                        'text-green-400 bg-green-500/10'
                                }`}>
                                {user.experience}
                            </span>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="text-2xl font-bold text-slate-100">{tests.length}</div>
                            <div className="text-xs text-slate-500">Tests Taken</div>
                        </div>
                    </div>
                </div>

                {/* Test History */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Terminal size={16} className="text-teal-400" />
                            Test History
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-slate-500" />
                        </div>
                    ) : tests.length === 0 ? (
                        <div className="text-center py-12">
                            <Trophy size={32} className="mx-auto text-slate-700 mb-3" />
                            <p className="text-slate-500">No tests taken yet</p>
                            <button
                                onClick={onStartNew}
                                className="mt-3 text-sm text-teal-400 hover:text-teal-300"
                            >
                                Take your first assessment →
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {tests.map((test) => {
                                const passed = test.score >= 60;
                                return (
                                    <div
                                        key={test._id}
                                        onClick={() => viewReport(test._id)}
                                        className="px-6 py-4 flex items-center gap-4 hover:bg-slate-800/30 cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {passed ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-slate-200">{test.topic}</h3>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className={`text-xs ${test.difficulty === 'Hard' ? 'text-red-400' :
                                                        test.difficulty === 'Medium' ? 'text-amber-400' : 'text-green-400'
                                                    }`}>{test.difficulty}</span>
                                                <span className="text-xs text-slate-600">•</span>
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(test.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className={`text-lg font-bold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {test.score}%
                                            </div>
                                            <div className="text-[10px] text-slate-600">{test.correctAnswers}/{test.totalSteps}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {loadingReport && (
                    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50">
                        <Loader2 size={32} className="animate-spin text-teal-400" />
                    </div>
                )}
            </div>
        </div>
    );
}
