import { NextResponse } from 'next/server';
import { SessionManager } from '../../../lib/sessionManager';

const sessionManager = SessionManager.getInstance();

export async function GET() {
  try {
    const allSessions = sessionManager.getAllSessions();
    const sessionCount = sessionManager.getSessionCount();
    
    const debugInfo = {
      sessionCount,
      sessions: allSessions.map(session => ({
        id: session.id,
        callId: session.callId,
        callState: session.callState,
        elapsedSeconds: sessionManager.getElapsedSeconds(session.id),
        voiceCloneCompleted: session.voiceCloneCompleted,
        futureSelfCreated: session.futureSelfCreated,
        createdAt: session.createdAt
      }))
    };

    console.log('🔍 Debug session info:', debugInfo);

    return NextResponse.json(debugInfo, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Debug endpoint failed' },
      { status: 500 }
    );
  }
} 