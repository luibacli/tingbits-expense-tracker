import mongoose from 'mongoose'

let connecting: Promise<typeof mongoose> | null = null

/** Connect once and reuse the connection (also across serverless invocations of the same instance). */
export function connectDB(uri: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose)
  if (!connecting) {
    connecting = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 })
      .catch((err) => { connecting = null; throw err })
  }
  return connecting
}
