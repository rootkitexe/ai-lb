import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../lib/db.js';
import { User } from '../../server/models/User.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectDB();

        const { name, email, jobRole, experience } = req.body;

        if (!name || !email || !jobRole || !experience) {
            return res.status(400).json({ error: 'All fields are required: name, email, jobRole, experience' });
        }

        let user = await User.findOne({ email });

        if (user) {
            user.name = name;
            user.jobRole = jobRole;
            user.experience = experience;
            await user.save();
        } else {
            user = await User.create({ name, email, jobRole, experience });
        }

        res.status(201).json({ user });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
}
