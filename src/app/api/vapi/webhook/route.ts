import { NextRequest, NextResponse } from 'next/server';
import { UserSession } from '../../../types';

// In-memory session storage (use Redis in production)
const sessions = new Map<string, UserSession>();

interface VapiCall {
  id: string;
  metadata?: {
    sessionId?: string;
    [key: string]: unknown;
  };
}

interface VapiWebhookData {
  role?: string;
  transcript?: string;
  content?: string;
  recordingUrl?: string;
  url?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, call, data } = body;

    console.log('Vapi webhook received:', { type, callId: call?.id, data });

    switch (type) {
      case 'call-started':
        await handleCallStarted(call);
        break;
      
      case 'transcript':
        await handleTranscript(call, data);
        break;
      
      case 'recording':
        await handleRecording(call, data);
        break;
      
      case 'call-ended':
        await handleCallEnded(call);
        break;
      
      default:
        console.log('Unhandled webhook type:', type);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCallStarted(call: VapiCall) {
  const sessionId = call?.metadata?.sessionId || call?.id;
  
  const session: UserSession = {
    id: sessionId,
    callId: call?.id,
    status: 'counseling',
    createdAt: new Date(),
  };
  
  sessions.set(sessionId, session);
  console.log('Session started:', sessionId);
}

async function handleTranscript(call: VapiCall, data: VapiWebhookData) {
  const sessionId = call?.metadata?.sessionId || call?.id;
  const session = sessions.get(sessionId);
  
  if (!session || data.role !== 'user') return;

  const transcript = data.transcript || data.content;
  if (!transcript) return;

  // Extract user name from early conversation
  if (!session.userName && transcript.length > 0) {
    const nameMatch = transcript.match(/my name is (\w+)|i'm (\w+)|i am (\w+)|call me (\w+)/i);
    if (nameMatch) {
      session.userName = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
      console.log('Captured user name:', session.userName);
    }
  }

  // Capture problem description from longer messages
  if (!session.problemDescription && transcript.length > 50) {
    session.problemDescription = transcript;
    console.log('Captured problem description');
  }

  sessions.set(sessionId, session);
}

async function handleRecording(call: VapiCall, data: VapiWebhookData) {
  const sessionId = call?.metadata?.sessionId || call?.id;
  const session = sessions.get(sessionId);
  
  if (!session) return;

  if (data.recordingUrl || data.url) {
    session.recordingUrl = data.recordingUrl || data.url;
    console.log('Recording URL captured:', session.recordingUrl);
    sessions.set(sessionId, session);
  }
}

async function handleCallEnded(call: VapiCall) {
  const sessionId = call?.metadata?.sessionId || call?.id;
  const session = sessions.get(sessionId);
  
  if (!session) return;

  session.status = 'processing';
  sessions.set(sessionId, session);
  
  console.log('Call ended, starting voice cloning process...', {
    sessionId,
    hasRecording: !!session.recordingUrl,
    userName: session.userName,
    hasProblem: !!session.problemDescription
  });

  // Trigger voice cloning and callback process
  try {
    await processVoiceCloning(session);
  } catch (error) {
    console.error('Voice cloning process failed:', error);
    session.status = 'error';
    sessions.set(sessionId, session);
  }
}

async function processVoiceCloning(session: UserSession) {
  if (!session.recordingUrl) {
    throw new Error('No recording URL available');
  }

  try {
    // Step 1: Clone voice using ElevenLabs
    console.log('Starting voice cloning...');
    const cloneResponse = await fetch('/api/elevenlabs/clone-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        recordingUrl: session.recordingUrl,
        name: session.userName || 'User'
      })
    });

    if (!cloneResponse.ok) {
      throw new Error('Voice cloning failed');
    }

    const cloneData = await cloneResponse.json();
    session.clonedVoiceId = cloneData.voice_id;
    session.status = 'calling_back';
    
    console.log('Voice cloned successfully:', cloneData.voice_id);

    // Step 2: Create future self assistant and initiate callback
    console.log('Creating future self assistant...');
    const callbackResponse = await fetch('/api/vapi/create-future-self', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        voiceId: session.clonedVoiceId,
        userName: session.userName,
        problemDescription: session.problemDescription
      })
    });

    if (!callbackResponse.ok) {
      throw new Error('Future self creation failed');
    }

    session.status = 'completed';
    sessions.set(session.id, session);
    
    console.log('Future self callback initiated successfully');

  } catch (error) {
    console.error('Processing error:', error);
    session.status = 'error';
    sessions.set(session.id, session);
    throw error;
  }
}

// Helper endpoint to get session status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  
  return NextResponse.json({ session });
} 