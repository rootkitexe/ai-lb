import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../lib/db.js';
import { TestResult } from '../../server/models/TestResult.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectDB();

        const { id } = req.query;
        const test = await TestResult.findById(id as string)
            .populate('userId', 'name email jobRole experience');

        if (!test) {
            return res.status(404).json({ error: 'Test result not found' });
        }

        res.json({ test });
    } catch (error) {
        console.error('Get test error:', error);
        res.status(500).json({ error: 'Failed to get test result' });
    }
}
