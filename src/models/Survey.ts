import mongoose, { Document, Schema } from 'mongoose';

export interface ISurvey extends Document {
    source: string; // Facebook, Instagram, etc.
    createdAt: Date;
}

const surveySchema: Schema = new Schema({
    source: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<ISurvey>('Survey', surveySchema, 'surveys');