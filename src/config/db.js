import mongoose from 'mongoose';

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    console.warn('MONGODB_URI not set — skipping database connection (Milestone 1).');
    return null;
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
  return mongoose.connection;
}
