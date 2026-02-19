import mongoose, { Schema, Document } from 'mongoose';

export interface IStepResult {
    stepIndex: number;
    instruction: string;
    userAnswer: string;
    expectedAnswer: string;
    correct: boolean;
    status: 'correct' | 'partially_correct' | 'incorrect';
    feedback: string;
    timeTakenMs: number;
}

export interface ITestResult extends Document {
    userId: mongoose.Types.ObjectId;
    topic: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    totalSteps: number;
    correctAnswers: number;
    score: number; // percentage 0-100
    steps: IStepResult[];
    aiSummary: string; // AI-generated evaluation text
    createdAt: Date;
}

const StepResultSchema = new Schema<IStepResult>({
    stepIndex: { type: Number, required: true },
    instruction: { type: String, required: true },
    userAnswer: { type: String, required: true },
    expectedAnswer: { type: String, required: true },
    correct: { type: Boolean, required: true },
    status: { type: String, enum: ['correct', 'partially_correct', 'incorrect'], default: 'incorrect' },
    feedback: { type: String, default: '' },
    timeTakenMs: { type: Number, default: 0 },
}, { _id: false });

const TestResultSchema = new Schema<ITestResult>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    totalSteps: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    score: { type: Number, required: true },
    steps: [StepResultSchema],
    aiSummary: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

// Index on userId for fast dashboard queries
TestResultSchema.index({ userId: 1, createdAt: -1 });

export const TestResult = mongoose.model<ITestResult>('TestResult', TestResultSchema);
