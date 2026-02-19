// Frontend API client — talks to Express backend via Vite proxy

const BASE = '/api';

export interface RegisterData {
    name: string;
    email: string;
    jobRole: string;
    experience: 'Junior' | 'Mid' | 'Senior';
}

export interface StepResultData {
    stepIndex: number;
    instruction: string;
    userAnswer: string;
    expectedAnswer: string;
    correct: boolean;
    status: 'correct' | 'partially_correct' | 'incorrect';
    feedback: string;
    timeTakenMs: number;
}

export interface SubmitTestData {
    userId: string;
    topic: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    steps: StepResultData[];
    aiSummary?: string;
}

export interface UserProfile {
    _id: string;
    name: string;
    email: string;
    jobRole: string;
    experience: 'Junior' | 'Mid' | 'Senior';
    createdAt: string;
}

export interface TestSummary {
    _id: string;
    topic: string;
    difficulty: string;
    score: number;
    totalSteps: number;
    correctAnswers: number;
    createdAt: string;
}

export interface DetailedTestResult {
    _id: string;
    userId: UserProfile;
    topic: string;
    difficulty: string;
    totalSteps: number;
    correctAnswers: number;
    score: number;
    steps: StepResultData[];
    aiSummary: string;
    createdAt: string;
}

// ─── User APIs ───────────────────────────────────────────────────────

export async function registerUser(data: RegisterData): Promise<UserProfile> {
    const res = await fetch(`${BASE}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json.user;
}

export async function getUser(id: string): Promise<UserProfile> {
    const res = await fetch(`${BASE}/users/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to get user');
    return json.user;
}

// ─── Test APIs ───────────────────────────────────────────────────────

export async function submitTest(data: SubmitTestData): Promise<DetailedTestResult> {
    const res = await fetch(`${BASE}/tests/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to submit test');
    return json.testResult;
}

export async function getUserTests(userId: string): Promise<TestSummary[]> {
    const res = await fetch(`${BASE}/tests/user/${userId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to get tests');
    return json.tests;
}

export async function getTestReport(testId: string): Promise<DetailedTestResult> {
    const res = await fetch(`${BASE}/tests/${testId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to get test report');
    return json.test;
}
