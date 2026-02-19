import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../lib/db.js';
import { TestResult } from '../../server/models/TestResult.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectDB();

        const { userId, topic, difficulty, steps, aiSummary } = req.body;

        if (!userId || !topic || !difficulty || !steps || !Array.isArray(steps)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const totalSteps = steps.length;
        const correctCount = steps.filter((s: any) => s.status === 'correct' || (!s.status && s.correct)).length;
        const partialCount = steps.filter((s: any) => s.status === 'partially_correct').length;
        const correctAnswers = correctCount;
        const score = Math.round(((correctCount + partialCount * 0.5) / totalSteps) * 100);

        const testResult = await TestResult.create({
            userId,
            topic,
            difficulty,
            totalSteps,
            correctAnswers,
            score,
            steps,
            aiSummary: aiSummary || '',
        });

        res.status(201).json({ testResult });
    } catch (error) {
        console.error('Submit test error:', error);
        res.status(500).json({ error: 'Failed to submit test results' });
    }
}
