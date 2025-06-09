export interface UserSession {
  id: string;
  userName?: string;
  problemDescription?: string;
  phoneNumber?: string;
  recordingUrl?: string;
  clonedVoiceId?: string;
  callId?: string;
  status: 'initializing' | 'counseling' | 'processing' | 'calling_back' | 'completed' | 'error';
  callState: CallState;
  createdAt: Date;
  futureSelfReady?: boolean;
  futureSelfAssistantId?: string;
  
  // New fields for Future Self creation
  startTime?: number;
  transcripts: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
  }>;
  voiceCloneCompleted: boolean;
  futureSelfCreated: boolean;
  futureSelfTimer?: NodeJS.Timeout;
  fallbackTimer?: NodeJS.Timeout;
}

export interface VapiWebhookEvent {
  type: 'call-started' | 'call-ended' | 'transcript' | 'recording' | 'error';
  callId: string;
  data: Record<string, unknown>;
}

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PlayHTVoiceClone {
  voice_id: string;
  name: string;
  status: 'ready' | 'processing' | 'error';
}

export type CallState = 'onboarding' | 'preparing_interruption' | 'interruption_delivered' | 'ready_for_future_call';

export interface VoiceCallState {
  isConnected: boolean;
  isLoading: boolean;
  status: string;
  error?: string;
} 