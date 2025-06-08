import { NextRequest, NextResponse } from 'next/server';
import { UserSession } from '../../../types';
import { VapiAudioCapture } from '../../../lib/audioCapture';
import { createFutureSelfAssistant } from '../../../lib/vapiHelpers';
import { SessionManager } from '../../../lib/sessionManager';

// Use SessionManager instead of in-memory storage
const sessionManager = SessionManager.getInstance();

// Store active audio captures
const audioCaptures = new Map<string, VapiAudioCapture>();

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
    
    // Use SessionManager to create session with proper callState initialization
    const session = sessionManager.createSession(sessionId, call?.id);

    // Set up call state timing progression
    // 0-55s: 'onboarding'
    // 55-60s: 'preparing_interruption' 
    // 60-65s: 'interruption_delivered'
    // 65s+: 'ready_for_future_call'

    // Schedule state transitions
    setTimeout(() => {
      sessionManager.updateCallState(sessionId, 'preparing_interruption');
    }, 55000); // 55 seconds

    // 🎯 DISABLED: Now creating Future Self immediately when voice clone is ready
    /*
    const futureSelfTimer = setTimeout(async () => {
      console.log('⏰ 60 seconds elapsed - triggering Future Self creation...');
      sessionManager.updateCallState(sessionId, 'interruption_delivered');
      await triggerFutureSelfCreation(sessionId);
      
      // Schedule transition to ready state after 5 more seconds
      setTimeout(() => {
        sessionManager.updateCallState(sessionId, 'ready_for_future_call');
      }, 5000);
    }, 60000); // 60 seconds

    // Update session with timer
    sessionManager.updateSession(sessionId, { futureSelfTimer });
    */
    
    // Store monitor URLs for audio streaming in Step 2
    if (call?.monitor?.listenUrl) {
      devLog('💾 Starting audio capture for real-time processing...');
      
      // Create and start audio capture with real-time cloning support
      const audioCapture = new VapiAudioCapture(call.id, sessionId, session.userName || 'User');
      audioCaptures.set(call.id, audioCapture);
      
      // Set up event handlers for audio capture
      audioCapture.on('connected', () => {
        devLog('🔗 WebSocket connection established successfully');
      });
      
      audioCapture.on('audioChunk', () => {
        // Audio chunk received - real-time cloning happens automatically
        const stats = audioCapture.getStats();
        if (stats.audioChunksReceived % 500 === 0) {
          devLog(`🎵 Audio progress: ${stats.audioChunksReceived} chunks, ${stats.totalAudioBytes} bytes`);
        }
      });
      
      // 🎭 UPDATED: Real-time voice cloning event handler
      audioCapture.on('voiceCloneReady', async (data) => {
        console.log('🎭 Real-time voice cloning triggered!');
        console.log(`📊 Audio stats: ${data.stats.chunks} chunks, ${data.stats.bytes} bytes, ${data.stats.duration}s`);
        
        try {
          // Convert Blob to FormData for the API call
          const formData = new FormData();
          formData.append('sessionId', data.sessionId);
          formData.append('callId', data.callId);
          formData.append('userName', data.userName);
          formData.append('audio', data.audioBlob, 'realtime_audio.wav');
          
          console.log('📤 Sending audio to real-time cloning API...');
          
          // Call the real-time cloning API with extended timeout and better error handling
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('⏰ Voice cloning communication timed out, but ElevenLabs may still be processing...');
          }, 900000); // 15 minute timeout
          
          try {
            const cloneResponse = await fetch('http://localhost:3000/api/elevenlabs/clone-voice-realtime', {
              method: 'POST',
              body: formData,
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (cloneResponse.ok) {
              const cloneData = await cloneResponse.json();
              
              // Update session with cloned voice ID
              const currentSession = sessionManager.getSession(sessionId);
              if (currentSession) {
                currentSession.clonedVoiceId = cloneData.voice_id;
                currentSession.voiceCloneCompleted = true;
                sessionManager.updateSession(sessionId, currentSession);
                
                console.log(`✅ Real-time voice cloning completed: ${cloneData.voice_id}`);
                console.log('🎭 Voice clone ready! Creating Future Self assistant immediately...');
                
                // 🎯 NEW: Create Future Self assistant immediately when voice clone is ready
                await triggerFutureSelfCreation(sessionId);
                
                // Clear fallback timer since voice clone succeeded
                if (currentSession.fallbackTimer) {
                  clearTimeout(currentSession.fallbackTimer);
                  currentSession.fallbackTimer = undefined;
                  sessionManager.updateSession(sessionId, currentSession);
                }
              }
              
            } else {
              const errorText = await cloneResponse.text();
              console.error('❌ Real-time voice cloning failed:', errorText);
            }
            
          } catch (fetchError) {
            clearTimeout(timeoutId);
            const error = fetchError as Error;
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
              console.log('⚠️ Communication timeout occurred, but voice cloning may have succeeded at ElevenLabs');
            } else {
              throw fetchError;
            }
          }
          
        } catch (error) {
          console.error('❌ Real-time cloning process failed:', error);
        }
      });
      
      audioCapture.on('voiceCloneError', (error) => {
        console.error('❌ Voice clone error:', error);
      });
      
      audioCapture.on('metadata', (metadata: Record<string, unknown>) => {
        devLog('📊 Audio metadata:', metadata);
      });
      
      audioCapture.on('error', (error: Error) => {
        prodLog('❌ Audio capture error:', error.message);
      });
      
      audioCapture.on('closed', (stats: { callId: string; audioChunksReceived: number; totalAudioBytes: number }) => {
        prodLog('🔴 Audio capture ended:', {
          callId: stats.callId,
          chunks: stats.audioChunksReceived,
          bytes: stats.totalAudioBytes
        });
      });
      
      // Connect to the WebSocket
      await audioCapture.connect(call.monitor.listenUrl);
      devLog('🎙️ Audio capture started for call:', call.id);
      
    } else {
      prodLog('⚠️  WARNING: No monitor URLs found! Check monitorPlan settings.');
      devLog('   Available call data:', call);
    }
    
    // 🎯 IMPROVED: Add fallback timer in case voice cloning fails or takes too long
    const fallbackTimer = setTimeout(async () => {
      console.log('⏰ 30 seconds elapsed - checking if Future Self needs to be created...');
      const currentSession = sessionManager.getSession(sessionId);
      if (currentSession && !currentSession.futureSelfCreated) {
        console.log('🔄 Creating Future Self with fallback (voice clone may not be ready)...');
        await triggerFutureSelfCreation(sessionId);
      }
    }, 30000); // 30 second fallback

    // Update session with fallback timer for cleanup
    session.fallbackTimer = fallbackTimer;
    sessionManager.updateSession(sessionId, session);
    devLog('✅ Session started:', sessionId);
    prodLog('🎯 New session created', { sessionId, callId: call?.id });
    
  } catch (error) {
    prodLog('❌ Error in handleCallStarted:', error);
  }
}

// NEW: Function to trigger Future Self creation
async function triggerFutureSelfCreation(sessionId: string) {
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      console.error('❌ Session not found for Future Self creation:', sessionId);
      return;
    }
    
    if (session.futureSelfCreated) {
      console.log('✅ Future Self already created for session:', sessionId);
      return;
    }
    
    console.log('🎭 Creating Future Self assistant...');
    console.log(`📊 Session state: voiceClone=${session.voiceCloneCompleted}, transcripts=${session.transcripts.length}`);
    
    // Check if voice clone is ready
    if (!session.voiceCloneCompleted || !session.clonedVoiceId) {
      console.log('⚠️ Voice clone not ready yet, waiting for completion...');
      
      // Set up a polling mechanism to check every 5 seconds
      const pollInterval = setInterval(async () => {
        const updatedSession = sessionManager.getSession(sessionId);
        if (updatedSession?.voiceCloneCompleted && updatedSession.clonedVoiceId) {
          clearInterval(pollInterval);
          console.log('✅ Voice clone now ready, proceeding with Future Self creation...');
          await createFutureSelfForSession(updatedSession);
        }
      }, 5000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        console.log('⏰ Stopped polling for voice clone completion');
      }, 300000);
      
      return;
    }
    
    // Voice clone is ready, create Future Self immediately
    await createFutureSelfForSession(session);
    
    // Update call state to indicate Future Self is ready
    sessionManager.updateCallState(sessionId, 'interruption_delivered');
    
    // Schedule transition to ready state after 5 seconds
    setTimeout(() => {
      sessionManager.updateCallState(sessionId, 'ready_for_future_call');
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error triggering Future Self creation:', error);
  }
}

// NEW: Helper function to create Future Self assistant
async function createFutureSelfForSession(session: UserSession) {
  try {
    console.log('🔮 Creating Future Self assistant with:', {
      sessionId: session.id,
      voiceId: session.clonedVoiceId,
      transcriptCount: session.transcripts.length,
      userName: session.userName
    });
    
    const assistantId = await createFutureSelfAssistant(session);
    
    // Update session
    session.futureSelfAssistantId = assistantId;
    session.futureSelfCreated = true;
    sessionManager.updateSession(session.id, session);
    
    console.log('🎭✅ Future Self assistant created successfully!');
    console.log(`🆔 Assistant ID: ${assistantId}`);
    console.log('🚀 Future Self callback system is now ready!');
    
  } catch (error) {
    console.error('❌ Failed to create Future Self assistant:', error);
  }
}

async function handleConversationUpdate(call: VapiCall, conversation: Array<{ role: string; content: string }>) {
  try {
    const sessionId = call?.metadata?.sessionId || call?.id;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) return;

    // Update transcripts with new conversation messages
    for (const msg of conversation) {
      // Check if this message is already in our transcripts
      const exists = session.transcripts.some(t => 
        t.text === msg.content && t.role === (msg.role as 'user' | 'assistant')
      );
      
      if (!exists && msg.content && msg.content.trim().length > 0) {
        session.transcripts.push({
          role: msg.role as 'user' | 'assistant',
          text: msg.content.trim(),
          timestamp: Date.now()
        });
        
        devLog(`📝 Added ${msg.role} message to transcript:`, msg.content.substring(0, 100));
      }
    }

    // Extract user information from conversation
    const userMessages = conversation.filter(msg => msg.role === 'user');
    
    for (const msg of userMessages) {
      // Extract user name from conversation
      if (!session.userName && msg.content.length > 0) {
        const nameMatch = msg.content.match(/my name is (\w+)|i'm (\w+)|i am (\w+)|call me (\w+)/i);
        if (nameMatch) {
          session.userName = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
          devLog('👤 Captured user name from conversation:', session.userName);
        }
      }

      // Capture problem description from longer messages
      if (!session.problemDescription && msg.content.length > 50) {
        session.problemDescription = msg.content;
        devLog('📋 Captured problem description from conversation');
      }
    }

    sessionManager.updateSession(sessionId, session);
    
    // Log transcript progress
    if (session.transcripts.length > 0 && session.transcripts.length % 5 === 0) {
      console.log(`📊 Transcript progress: ${session.transcripts.length} messages collected for Future Self`);
    }
    
  } catch (error) {
    prodLog('❌ Error in handleConversationUpdate:', error);
  }
}

async function handleTranscript(call: VapiCall, data: { role: string; transcript: string }) {
  try {
    const sessionId = call?.metadata?.sessionId || call?.id;
    const session = sessionManager.getSession(sessionId);
    
    if (!session || !data.transcript || data.transcript.trim().length === 0) return;

    const transcript = data.transcript.trim();
    
    // Add transcript to session
    const exists = session.transcripts.some(t => 
      t.text === transcript && t.role === (data.role as 'user' | 'assistant')
    );
    
    if (!exists) {
      session.transcripts.push({
        role: data.role as 'user' | 'assistant',
        text: transcript,
        timestamp: Date.now()
      });
      
      devLog(`📝 Added ${data.role} transcript:`, transcript.substring(0, 100));
    }

    // Extract user information from transcripts
    if (data.role === 'user') {
      // Extract user name from early conversation
      if (!session.userName && transcript.length > 0) {
        const nameMatch = transcript.match(/my name is (\w+)|i'm (\w+)|i am (\w+)|call me (\w+)/i);
        if (nameMatch) {
          session.userName = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
          devLog('👤 Captured user name from transcript:', session.userName);
        }
      }

      // Capture problem description from longer messages
      if (!session.problemDescription && transcript.length > 50) {
        session.problemDescription = transcript;
        devLog('📋 Captured problem description from transcript');
      }
    }

    sessionManager.updateSession(sessionId, session);
    
  } catch (error) {
    prodLog('❌ Error in handleTranscript:', error);
  }
}

async function handleCallEnded(call: VapiCall) {
  const sessionId = call?.metadata?.sessionId || call?.id;
  const session = sessionManager.getSession(sessionId);
  
  // Clean up audio capture first
  if (call?.id) {
    const audioCapture = audioCaptures.get(call.id);
    if (audioCapture) {
      devLog('🧹 Cleaning up audio capture for call:', call.id);
      audioCapture.disconnect();
      audioCaptures.delete(call.id);
      devLog('✅ Audio capture cleaned up successfully');
    }
  }
  
  // Clear the Future Self timer if it exists
  if (session?.futureSelfTimer) {
    clearTimeout(session.futureSelfTimer);
    devLog('⏰ Cleared Future Self timer');
  }
  
  // Clear the fallback timer if it exists
  if (session?.fallbackTimer) {
    clearTimeout(session.fallbackTimer);
    devLog('⏰ Cleared fallback timer');
  }
  
  if (!session) return;

  session.status = 'processing';
  sessionManager.updateSession(sessionId, session);
  
  console.log('🔴 Call ended, final session state:', {
    sessionId,
    transcriptCount: session.transcripts.length,
    userName: session.userName,
    voiceCloneCompleted: session.voiceCloneCompleted,
    futureSelfCreated: session.futureSelfCreated,
    assistantId: session.futureSelfAssistantId
  });

  // If Future Self wasn't created yet due to timing, try one more time
  if (!session.futureSelfCreated && session.voiceCloneCompleted && session.clonedVoiceId) {
    console.log('🎭 Call ended - attempting final Future Self creation...');
    await createFutureSelfForSession(session);
  }
}

// Helper endpoint to get session status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }
  
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  
  return NextResponse.json({ session });
} 