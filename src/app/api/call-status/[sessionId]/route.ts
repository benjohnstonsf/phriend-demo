import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '../../../lib/sessionManager';

const sessionManager = SessionManager.getInstance();

// CORS headers for React Native access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const elapsedSeconds = sessionManager.getElapsedSeconds(sessionId);
    
    const response = {
      sessionId: session.id,
      callState: session.callState,
      futureSelfAssistantId: session.futureSelfAssistantId || null,
      elapsedSeconds,
      voiceCloneReady: session.voiceCloneCompleted,
    };

    console.log(`📊 Call status requested for ${sessionId}: ${session.callState} (${elapsedSeconds}s)`);

    return NextResponse.json(response, { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Error in call-status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
} 