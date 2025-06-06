'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { VoiceCallState } from '../types';

interface VapiError {
  error?: {
    type?: string;
    msg?: string;
  };
  message?: string;
  errorMsg?: string;
}

interface VapiMessage {
  type: string;
  transcript?: string;
  transcriptType?: string;
  [key: string]: unknown;
}

const VoiceCounselor = () => {
  const [callState, setCallState] = useState<VoiceCallState>({
    isConnected: false,
    isLoading: false,
    status: 'Ready to connect',
  });
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    // Initialize Vapi
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (publicKey) {
      vapiRef.current = new Vapi(publicKey);
      
      // Set up event listeners with detailed logging
      vapiRef.current.on('call-start', () => {
        console.log('✅ Call started successfully');
        setCallState(prev => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          status: 'Connected - Start speaking...',
        }));
      });

      vapiRef.current.on('call-end', () => {
        console.log('📞 Call ended');
        setCallState(prev => ({
          ...prev,
          isConnected: false,
          isLoading: false,
          status: 'Processing your voice... You&apos;ll receive a call from your future self soon!',
        }));
      });

      vapiRef.current.on('error', (error: VapiError) => {
        console.error('❌ Vapi error:', error);
        
        // Check for specific error types
        if (error?.error?.type === 'ejected') {
          console.error('🚫 Call was ejected by Vapi:', error.error?.msg);
          setCallState(prev => ({
            ...prev,
            isConnected: false,
            isLoading: false,
            status: 'Ready to connect',
            error: `Call terminated: ${error.error?.msg || 'Service ejected the call'}`,
          }));
        } else {
          setCallState(prev => ({
            ...prev,
            isConnected: false,
            isLoading: false,
            status: 'Ready to connect',
            error: `Connection failed: ${error.message || error.errorMsg || 'Unknown error'}`,
          }));
        }
      });

      vapiRef.current.on('message', (message: VapiMessage) => {
        console.log('📨 Vapi message:', message);
        
        // Log specific message types for debugging
        if (message.type === 'transcript' && message.transcriptType === 'final') {
          console.log('💬 Final transcript:', message.transcript);
        }
        
        if (message.type === 'function-call') {
          console.log('🔧 Function call:', message);
        }
        
        if (message.type === 'speech-start') {
          console.log('🗣️ Speech started');
        }
        
        if (message.type === 'speech-end') {
          console.log('🔇 Speech ended');
        }
      });

      // Add connection state monitoring
      vapiRef.current.on('speech-start', () => {
        console.log('🎤 User speech started');
      });

      vapiRef.current.on('speech-end', () => {
        console.log('🎤 User speech ended');
      });

    } else {
      console.error('❌ NEXT_PUBLIC_VAPI_PUBLIC_KEY not found in environment variables');
      setCallState(prev => ({
        ...prev,
        error: 'Vapi public key not configured',
      }));
    }

    return () => {
      if (vapiRef.current) {
        console.log('🧹 Cleaning up Vapi instance');
        vapiRef.current.stop();
      }
    };
  }, []);

  const startCall = async () => {
    if (!vapiRef.current) {
      console.error('❌ Vapi not initialized');
      return;
    }

    // Generate session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🚀 Starting call with session ID:', newSessionId);

    setCallState(prev => ({
      ...prev,
      isLoading: true,
      status: 'Connecting...',
      error: undefined,
    }));

    try {
      await vapiRef.current.start({
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a warm, empathetic AI counselor. Your role is to:
1. Greet the user warmly and ask for their first name
2. Ask what's troubling them or what they'd like to talk about
3. Listen actively and provide supportive responses
4. Ask follow-up questions to understand their situation better
5. The conversation should last about 2-3 minutes to capture enough voice data

Keep responses concise but caring. Show genuine interest in their wellbeing.
Remember, this person will soon receive a call from their "future self" with wisdom and reassurance.

Session ID: ${newSessionId}`
            }
          ],
          temperature: 0.7,
        },
        voice: {
          provider: 'playht',
          voiceId: 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json',
        },
        endCallPhrases: ['goodbye', 'thank you', 'that helps', 'I feel better', 'end call'],
        maxDurationSeconds: 300, // 5 minutes max
        metadata: {
          sessionId: newSessionId,
          type: 'counseling_session'
        }
      });
      
      console.log('✅ Call configuration sent successfully');
      
    } catch (error) {
      console.error('❌ Failed to start call:', error);
      setCallState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to start call: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your microphone permissions.`,
      }));
    }
  };

  const endCall = () => {
    console.log('🛑 User manually ending call');
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Phriend
          </h1>
          <p className="text-gray-600 mb-8">
            Talk to an AI counselor about what&apos;s on your mind. 
            Your future self will call you back with wisdom and comfort.
          </p>

          <div className="mb-6">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              callState.isConnected 
                ? 'bg-green-100 text-green-800' 
                : callState.isLoading 
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                callState.isConnected ? 'bg-green-500' : callState.isLoading ? 'bg-yellow-500' : 'bg-gray-500'
              }`} />
              {callState.status}
            </div>
          </div>

          {callState.error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
              {callState.error}
              <div className="mt-2 text-xs">
                💡 Try refreshing the page or checking your microphone permissions
              </div>
            </div>
          )}

          <div className="space-y-4">
            {!callState.isConnected ? (
              <button
                onClick={startCall}
                disabled={callState.isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg transition duration-300 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {callState.isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </div>
                ) : (
                  'Start Voice Session'
                )}
              </button>
            ) : (
              <button
                onClick={endCall}
                className="w-full bg-red-500 text-white py-4 px-6 rounded-xl font-semibold text-lg transition duration-300 hover:bg-red-600"
              >
                End Session
              </button>
            )}
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <p>Make sure your microphone is enabled for the best experience.</p>
            <p className="mt-1">This session will be recorded to create your personalized future self voice.</p>
            <p className="mt-2 font-medium">🐛 Debug mode: Check browser console for detailed logs</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCounselor; 