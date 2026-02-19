import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    jobRole: string;
    experience: 'Junior' | 'Mid' | 'Senior';
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true },
    email: { type: String, required: true },
    jobRole: { type: String, required: true },
    experience: { type: String, enum: ['Junior', 'Mid', 'Senior'], required: true },
    createdAt: { type: Date, default: Date.now },
});

// Index on email for fast lookups
UserSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
