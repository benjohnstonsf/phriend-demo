import { NextRequest, NextResponse } from 'next/server';
import { UserSession } from '../../../types';

// In-memory session storage (use Redis in production)
const sessions = new Map<string, UserSession>();

// Environment-based logging
const isDevelopment = process.env.NODE_ENV === 'development';

interface VapiCall {
  id: string;
  metadata?: {
    sessionId?: string;
    [key: string]: unknown;
  };
  monitor?: {
    listenUrl?: string;
    controlUrl?: string;
  };
}

interface VapiWebhookData {
  role?: string;
  transcript?: string;
  content?: string;
  recordingUrl?: string;
  url?: string;
  status?: string;
  [key: string]: unknown;
}

interface VapiWebhookPayload {
  type: string;
  call?: VapiCall;
  data?: VapiWebhookData;
  [key: string]: unknown;
}

// Helper function for development logging
function devLog(message: string, data?: unknown) {
  if (isDevelopment) {
    console.log(message, data || '');
  }
}

// Helper function for production logging (errors and important events)
function prodLog(message: string, data?: unknown) {
  console.log(message, data || '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as VapiWebhookPayload;
    
    // Validate payload structure
    if (!body || typeof body !== 'object') {
      prodLog('❌ Invalid webhook payload: not an object');
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    if (!body.type || typeof body.type !== 'string') {
      prodLog('❌ Invalid webhook payload: missing or invalid type field');
      return NextResponse.json({ error: 'Missing or invalid type field' }, { status: 400 });
    }

    const { type, call, data } = body;

    // Enhanced logging for Step 1 - detailed in dev, minimal in prod
    devLog('🎯 Vapi Webhook Event:', {
      type,
      callId: call?.id,
      timestamp: new Date().toISOString()
    });
    
    // Log the full payload for debugging Step 1 (dev only)
    devLog('📦 Full payload:', JSON.stringify(body, null, 2));

    // Production logging for important events
    if (!isDevelopment && ['call-started', 'call-ended', 'error'].includes(type)) {
      prodLog(`📞 Vapi Event: ${type}`, { callId: call?.id });
    }

    switch (type) {
      case 'call-started':
        devLog('🟢 Call started!');
        
        // Validate call object
        if (!call || !call.id) {
          prodLog('⚠️  Warning: call-started event missing call data');
          break;
        }
        
        // Log monitor URLs - these are critical for Step 2 audio streaming
        if (call.monitor?.listenUrl && call.monitor?.controlUrl) {
          devLog('🎧 Monitor URLs available:', call.monitor);
          devLog('   🔊 Listen URL (WebSocket for audio):', call.monitor.listenUrl);
          devLog('   🎛️  Control URL (for call control):', call.monitor.controlUrl);
          prodLog('✅ Monitor URLs captured for audio streaming');
        } else {
          prodLog('⚠️  WARNING: No monitor URLs found! Check monitorPlan settings.');
          devLog('   Available call data:', call);
        }
        await handleCallStarted(call);
        break;
      
      case 'transcript':
        if (data?.role && (data?.transcript || data?.content)) {
          devLog('📝 Transcript event:', {
            role: data.role,
            text: data.transcript || data.content,
            timestamp: new Date().toISOString()
          });
          if (call) await handleTranscript(call, data);
        } else {
          devLog('⚠️  Malformed transcript event:', data);
        }
        break;
        
      case 'speech-update':
        devLog('🎤 Speech update:', {
          role: data?.role,
          status: data?.status,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'user-interrupted':
        devLog('⚡ User interrupted! (Potential emotional moment)', {
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'recording':
        const recordingUrl = data?.recordingUrl || data?.url;
        if (recordingUrl) {
          devLog('🎬 Recording event:', {
            recordingUrl,
            timestamp: new Date().toISOString()
          });
          if (call) await handleRecording(call, data);
        } else {
          devLog('⚠️  Recording event without URL:', data);
        }
        break;
      
      case 'call-ended':
        devLog('🔴 Call ended!');
        prodLog('📞 Call ended', { callId: call?.id });
        if (call) await handleCallEnded(call);
        break;
      
      case 'error':
        prodLog('❌ Vapi error event:', data);
        break;
      
      default:
        devLog('❓ Unhandled event type:', type);
        if (data) devLog('Event data:', data);
    }

    // Always return 200 OK to Vapi
    return NextResponse.json({ success: true });
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      prodLog('❌ Webhook JSON parsing error:', error.message);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    
    prodLog('❌ Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCallStarted(call: VapiCall) {
  try {
    const sessionId = call?.metadata?.sessionId || call?.id;
    
    if (!sessionId) {
      prodLog('❌ Cannot create session: missing sessionId and call.id');
      return;
    }
    
    const session: UserSession = {
      id: sessionId,
      callId: call?.id,
      status: 'counseling',
      createdAt: new Date(),
    };
    
    // Store monitor URLs for audio streaming in Step 2
    if (call?.monitor?.listenUrl) {
      devLog('💾 Storing monitor URLs for audio streaming...');
      // We'll add audio streaming state to UserSession in Step 2
    }
    
    sessions.set(sessionId, session);
    devLog('✅ Session started:', sessionId);
    prodLog('🎯 New session created', { sessionId, callId: call?.id });
    
  } catch (error) {
    prodLog('❌ Error in handleCallStarted:', error);
  }
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