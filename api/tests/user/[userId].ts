import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../../lib/db.js';
import { TestResult } from '../../../server/models/TestResult.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectDB();

        const { userId } = req.query;
        const tests = await TestResult.find({ userId: userId as string })
            .sort({ createdAt: -1 })
            .select('topic difficulty score totalSteps correctAnswers createdAt')
            .lean();

        res.json({ tests });
    } catch (error) {
        console.error('Get user tests error:', error);
        res.status(500).json({ error: 'Failed to get test results' });
    }
}
