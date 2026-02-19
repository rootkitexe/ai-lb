import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

export async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI, { dbName: 'conassess' });
        console.log('✅ Connected to MongoDB Atlas');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}
