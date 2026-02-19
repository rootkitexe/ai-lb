import { useState } from 'react';
import { UserCircle, Mail, Briefcase, ChevronRight, Loader2, Terminal, Sparkles } from 'lucide-react';

interface OnboardingFormProps {
    onComplete: (user: any, topic: string, difficulty: 'Easy' | 'Medium' | 'Hard') => void;
    isLoading: boolean;
}

const experienceOptions = [
    { value: 'Junior' as const, label: 'Junior (0-2 yrs)', color: 'text-green-400 border-green-500/40 bg-green-500/10' },
    { value: 'Mid' as const, label: 'Mid (2-5 yrs)', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    { value: 'Senior' as const, label: 'Senior (5+ yrs)', color: 'text-red-400 border-red-500/40 bg-red-500/10' },
];



function difficultyFromExperience(exp: 'Junior' | 'Mid' | 'Senior'): 'Easy' | 'Medium' | 'Hard' {
    switch (exp) {
        case 'Junior': return 'Easy';
        case 'Mid': return 'Medium';
        case 'Senior': return 'Hard';
    }
}

export default function OnboardingForm({ onComplete, isLoading }: OnboardingFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [jobRole, setJobRole] = useState('');
    const [experience, setExperience] = useState<'Junior' | 'Mid' | 'Senior' | ''>('');
    const [topic, setTopic] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = 'Name is required';
        if (!email.trim()) errs.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email';
        if (!jobRole.trim()) errs.jobRole = 'Job role is required';
        if (!experience) errs.experience = 'Select experience level';
        if (!topic.trim()) errs.topic = 'Enter a topic';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || !experience) return;

        const difficulty = difficultyFromExperience(experience);
        onComplete({ name, email, jobRole, experience }, topic, difficulty);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Terminal size={14} className="text-teal-400" />
                        <span className="text-sm text-teal-400 font-medium">ConAssess</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100 mb-2">Start Your Assessment</h1>
                    <p className="text-slate-400">Enter your details and choose a topic to begin</p>
                </div>

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                            <UserCircle size={14} className="text-slate-500" />
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                        />
                        {errors.name && <span className="text-red-400 text-xs mt-1">{errors.name}</span>}
                    </div>

                    {/* Email */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                            <Mail size={14} className="text-slate-500" />
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@company.com"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                        />
                        {errors.email && <span className="text-red-400 text-xs mt-1">{errors.email}</span>}
                    </div>

                    {/* Job Role */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                            <Briefcase size={14} className="text-slate-500" />
                            Job Role
                        </label>
                        <input
                            type="text"
                            value={jobRole}
                            onChange={(e) => setJobRole(e.target.value)}
                            placeholder="DevOps Engineer"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                        />
                        {errors.jobRole && <span className="text-red-400 text-xs mt-1">{errors.jobRole}</span>}
                    </div>

                    {/* Experience Level */}
                    <div>
                        <label className="text-sm font-medium text-slate-300 mb-2 block">Experience Level</label>
                        <div className="grid grid-cols-3 gap-3">
                            {experienceOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setExperience(opt.value)}
                                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${experience === opt.value
                                        ? opt.color
                                        : 'border-slate-700 text-slate-400 bg-slate-800 hover:border-slate-600'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {errors.experience && <span className="text-red-400 text-xs mt-1">{errors.experience}</span>}
                        {experience && (
                            <div className="mt-2 text-xs text-slate-500">
                                Difficulty auto-set to: <span className="font-semibold text-slate-400">
                                    {difficultyFromExperience(experience)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Topic */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                            <Sparkles size={14} className="text-purple-400" />
                            Assessment Topic
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Docker Networking"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
                        />
                        {errors.topic && <span className="text-red-400 text-xs mt-1">{errors.topic}</span>}


                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-semibold py-3 rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Generating Assessment...
                            </>
                        ) : (
                            <>
                                Start Assessment
                                <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
