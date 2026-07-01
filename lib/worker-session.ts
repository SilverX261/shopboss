import jwt from 'jsonwebtoken'

const SECRET = process.env.WORKER_JWT_SECRET ?? 'shopboss-worker-secret-change-in-prod'

export interface WorkerSession {
  worker_id: string
  shop_id: string
  worker_name: string
  plan: string
  logged_in_at: string
}

export function signWorkerJwt(payload: WorkerSession): string {
  return jwt.sign(payload, SECRET, { expiresIn: '12h' })
}

export function verifyWorkerJwt(token: string): WorkerSession | null {
  try {
    return jwt.verify(token, SECRET) as WorkerSession
  } catch {
    return null
  }
}

export const WORKER_TOKEN_KEY = 'shopboss_worker_token'
