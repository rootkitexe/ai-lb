import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';

const router = Router();

// POST /api/users/register — Create or find user
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { name, email, jobRole, experience } = req.body;

        if (!name || !email || !jobRole || !experience) {
            return res.status(400).json({ error: 'All fields are required: name, email, jobRole, experience' });
        }

        // Check if user already exists by email
        let user = await User.findOne({ email });

        if (user) {
            // Update existing user info
            user.name = name;
            user.jobRole = jobRole;
            user.experience = experience;
            await user.save();
        } else {
            // Create new user
            user = await User.create({ name, email, jobRole, experience });
        }

        res.status(201).json({ user });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// GET /api/users/:id — Get user profile
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

export default router;
