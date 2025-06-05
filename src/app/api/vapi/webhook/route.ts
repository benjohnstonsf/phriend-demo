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
  type?: string;
  call?: VapiCall;
  data?: VapiWebhookData;
  message?: {
    type: string;
    call?: VapiCall;
    status?: string;
    role?: string;
    conversation?: Array<{ role: string; content: string }>;
    transcript?: string;
    [key: string]: unknown;
  };
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
  // Always log incoming webhooks for debugging
  console.log('🔥 WEBHOOK RECEIVED:', new Date().toISOString());
  
  try {
    const body = await req.json() as VapiWebhookPayload;
    
    // Always log the basic info for debugging
    console.log('🔥 Raw payload keys:', Object.keys(body));
    
    // Handle Vapi's actual payload structure - events are wrapped in 'message'
    const message = (body as VapiWebhookPayload).message;
    if (!message) {
      prodLog('❌ Invalid webhook payload: no message field');
      return NextResponse.json({ error: 'No message field found' }, { status: 400 });
    }
    
    const { type, call, status, role, conversation, transcript } = message;
    
    console.log('🔥 Extracted event type:', type);
    console.log('🔥 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔥 isDevelopment:', isDevelopment);
    
    // Validate message structure
    if (!type || typeof type !== 'string') {
      prodLog('❌ Invalid webhook payload: missing or invalid type field in message');
      console.log('🔥 Available fields in message:', Object.keys(message));
      console.log('🔥 Type field value:', type, 'Type of type:', typeof type);
      return NextResponse.json({ error: 'Missing or invalid type field in message' }, { status: 400 });
    }

    // Enhanced logging for Step 1 - detailed in dev, minimal in prod
    devLog('🎯 Vapi Webhook Event:', {
      type,
      callId: call?.id,
      timestamp: new Date().toISOString()
    });
    
    // Log the full payload for debugging Step 1 (dev only)
    devLog('📦 Full message:', JSON.stringify(message, null, 2));

    // Production logging for important events
    if (!isDevelopment && ['status-update', 'speech-update', 'conversation-update', 'transcript', 'end-of-call-report'].includes(type)) {
      prodLog(`📞 Vapi Event: ${type}`, { callId: call?.id });
    }

    switch (type) {
      case 'status-update':
        if (status === 'in-progress') {
          console.log('🟢 Call started! (status-update: in-progress)');
          
          // Check for monitor URLs - these are critical for Step 2 audio streaming
          if (call?.monitor?.listenUrl && call?.monitor?.controlUrl) {
            devLog('🎧 Monitor URLs available:', call.monitor);
            devLog('   🔊 Listen URL (WebSocket for audio):', call.monitor.listenUrl);
            devLog('   🎛️  Control URL (for call control):', call.monitor.controlUrl);
            prodLog('✅ Monitor URLs captured for audio streaming');
          } else {
            prodLog('⚠️  WARNING: No monitor URLs found! Check monitorPlan settings.');
            devLog('   Available call data:', call);
          }
          
          if (call) await handleCallStarted(call);
        } else {
          devLog('📊 Status update:', status);
        }
        break;
      
      case 'conversation-update':
        devLog('💬 Conversation update:', {
          messageCount: conversation?.length || 0,
          timestamp: new Date().toISOString()
        });
        if (call && conversation) {
          await handleConversationUpdate(call, conversation);
        }
        break;
        
      case 'speech-update':
        devLog('🎤 Speech update:', {
          role: role,
          status: status,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'transcript':
        if (role && transcript) {
          devLog('📝 Transcript event:', {
            role: role,
            text: transcript,
            timestamp: new Date().toISOString()
          });
          if (call) await handleTranscript(call, { role, transcript });
        }
        break;
        
      case 'user-interrupted':
        devLog('⚡ User interrupted! (Potential emotional moment)', {
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'end-of-call-report':
        devLog('🔴 Call ended! (end-of-call-report)');
        prodLog('📞 Call ended', { callId: call?.id });
        if (call) await handleCallEnded(call);
        break;
      
      default:
        devLog('❓ Unhandled event type:', type);
        devLog('Event data keys:', Object.keys(message));
    }

    // Always return 200 OK to Vapi
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.log('🔥 WEBHOOK ERROR CAUGHT:', error);
    console.log('🔥 Error type:', typeof error);
    console.log('🔥 Error message:', error instanceof Error ? error.message : 'Unknown error');
    
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

async function handleConversationUpdate(call: VapiCall, conversation: Array<{ role: string; content: string }>) {
  try {
    const sessionId = call?.metadata?.sessionId || call?.id;
    const session = sessions.get(sessionId);
    
    if (!session) return;

    // Look for user messages in the conversation to extract information
    const userMessages = conversation.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    
    for (const msg of userMessages) {
      if (msg.role === 'user') {
        // Extract user name from conversation
        if (!session.userName && msg.content.length > 0) {
          const nameMatch = msg.content.match(/my name is (\w+)|i'm (\w+)|i am (\w+)|call me (\w+)/i);
          if (nameMatch) {
            session.userName = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
            devLog('Captured user name from conversation:', session.userName);
          }
        }

        // Capture problem description from longer messages
        if (!session.problemDescription && msg.content.length > 50) {
          session.problemDescription = msg.content;
          devLog('Captured problem description from conversation');
        }
      }
    }

    sessions.set(sessionId, session);
  } catch (error) {
    prodLog('❌ Error in handleConversationUpdate:', error);
  }
}

async function handleTranscript(call: VapiCall, data: { role: string; transcript: string }) {
  const sessionId = call?.metadata?.sessionId || call?.id;
  const session = sessions.get(sessionId);
  
  if (!session || data.role !== 'user') return;

  const transcript = data.transcript;
  if (!transcript) return;

  // Extract user name from early conversation
  if (!session.userName && transcript.length > 0) {
    const nameMatch = transcript.match(/my name is (\w+)|i'm (\w+)|i am (\w+)|call me (\w+)/i);
    if (nameMatch) {
      session.userName = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
      devLog('Captured user name from transcript:', session.userName);
    }
  }

  // Capture problem description from longer messages
  if (!session.problemDescription && transcript.length > 50) {
    session.problemDescription = transcript;
    devLog('Captured problem description from transcript');
  }

  sessions.set(sessionId, session);
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