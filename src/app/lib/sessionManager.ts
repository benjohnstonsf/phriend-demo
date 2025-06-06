import { UserSession, CallState } from '../types';

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, UserSession> = new Map();

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public createSession(sessionId: string, callId?: string): UserSession {
    const session: UserSession = {
      id: sessionId,
      callId: callId,
      status: 'counseling',
      callState: 'onboarding',
      createdAt: new Date(),
      startTime: Date.now(),
      transcripts: [],
      voiceCloneCompleted: false,
      futureSelfCreated: false,
    };

    this.sessions.set(sessionId, session);
    console.log(`✅ Session created: ${sessionId}`);
    return session;
  }

  public getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  public updateSession(sessionId: string, updates: Partial<UserSession>): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = { ...session, ...updates };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  public updateCallState(sessionId: string, newState: CallState): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found for call state update: ${sessionId}`);
      return null;
    }

    session.callState = newState;
    this.sessions.set(sessionId, session);
    console.log(`🔄 Call state updated for ${sessionId}: ${newState}`);
    return session;
  }

  public deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`🗑️ Session deleted: ${sessionId}`);
    }
    return deleted;
  }

  public getElapsedSeconds(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session || !session.startTime) {
      return 0;
    }
    return Math.floor((Date.now() - session.startTime) / 1000);
  }

  public getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }
} 