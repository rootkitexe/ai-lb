import mongoose from 'mongoose';

let cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } = {
    conn: null,
    promise: null,
};

export async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const uri = process.env.MONGODB_URI || '';
        cached.promise = mongoose.connect(uri, { dbName: 'conassess' });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}
