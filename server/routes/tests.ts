import { Router, Request, Response } from 'express';
import { TestResult } from '../models/TestResult.js';

const router = Router();

// POST /api/tests/submit — Submit test results
router.post('/submit', async (req: Request, res: Response) => {
    try {
        const { userId, topic, difficulty, steps, aiSummary } = req.body;

        if (!userId || !topic || !difficulty || !steps || !Array.isArray(steps)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const totalSteps = steps.length;
        const correctCount = steps.filter((s: any) => s.status === 'correct' || (!s.status && s.correct)).length;
        const partialCount = steps.filter((s: any) => s.status === 'partially_correct').length;
        const correctAnswers = correctCount; // For backward compatibility
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
});

// GET /api/tests/user/:userId — Get all tests for a user (dashboard)
router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
        const tests = await TestResult.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .select('topic difficulty score totalSteps correctAnswers createdAt')
            .lean();

        res.json({ tests });
    } catch (error) {
        console.error('Get user tests error:', error);
        res.status(500).json({ error: 'Failed to get test results' });
    }
});

// GET /api/tests/:id — Get a specific test result (detailed report)
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const test = await TestResult.findById(req.params.id).populate('userId', 'name email jobRole experience');
        if (!test) {
            return res.status(404).json({ error: 'Test result not found' });
        }
        res.json({ test });
    } catch (error) {
        console.error('Get test error:', error);
        res.status(500).json({ error: 'Failed to get test result' });
    }
});

export default router;
