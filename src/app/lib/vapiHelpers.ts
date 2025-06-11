import { UserSession } from '../types';

interface PlayHTVoice {
  id: string;
  voice_engine?: string;
  name?: string;
  [key: string]: unknown;
}

export interface VapiAssistantConfig {
  name: string;
  credentials?: Array<{
    provider: 'playht';
    apiKey: string;
    userId: string;
  }>;
  voice: {
    provider: 'playht' | 'vapi';
    voiceId: string;
    stability?: number;
    similarityBoost?: number;
  };
  model: {
    provider: 'openai';
    model: 'gpt-4o';
    systemPrompt: string;
    temperature?: number;
  };
  firstMessage: string;
  endCallPhrases: string[];
  recordingEnabled?: boolean;
  metadata?: {
    originalCallId?: string;
    type?: string;
    createdAt?: number;
    [key: string]: unknown;
  };
}

export async function verifyPlayHTVoice(voiceId: string): Promise<boolean> {
  const apiKey = process.env.PLAYHT_SECRET_KEY;
  const userId = process.env.PLAYHT_USER_ID;
  
  if (!apiKey || !userId) {
    console.log('⚠️ PlayHT credentials not available for voice verification');
    return false;
  }

  try {
    console.log('🔍 Verifying PlayHT voice availability:', voiceId);
    
    // Try to get the voice from PlayHT API
    const response = await fetch('https://api.play.ht/api/v2/cloned-voices', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-USER-ID': userId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('❌ Failed to fetch PlayHT voices:', response.status);
      return false;
    }

    const data = await response.json();
    console.log(`📊 Found ${data.length} PlayHT voices`);
    
    // Check if our voice ID exists in the list
    const voiceExists = data.some((voice: PlayHTVoice) => voice.id === voiceId || voice.voice_engine === voiceId);
    console.log(`🎭 Voice ${voiceId} exists in PlayHT:`, voiceExists);
    
    return voiceExists;
  } catch (error) {
    console.error('❌ Error verifying PlayHT voice:', error);
    return false;
  }
}

export async function createFutureSelfAssistant(session: UserSession): Promise<string> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error('VAPI_API_KEY not found in environment variables');
  }

  // Build the system prompt with conversation context
  const systemPrompt = buildFutureSelfPrompt(session);
  
  // Determine which voice to use and prepare credentials
  let voiceConfig: {
    provider: 'playht' | 'vapi';
    voiceId: string;
    stability?: number;
    similarityBoost?: number;
  };
  
  let credentials: Array<{
    provider: 'playht';
    apiKey: string;
    userId: string;
  }> | undefined;
  
  if (session.clonedVoiceId) {
    // Get PlayHT credentials for cloned voice
    const playhtApiKey = process.env.PLAYHT_SECRET_KEY;
    const playhtUserId = process.env.PLAYHT_USER_ID;
    
    // Debug: Check if environment variables are loaded
    console.log('🔍 PlayHT Environment Check:');
    console.log(`   PLAYHT_SECRET_KEY exists: ${!!playhtApiKey}`);
    console.log(`   PLAYHT_USER_ID exists: ${!!playhtUserId}`);
    if (playhtApiKey) console.log(`   Secret key preview: ${playhtApiKey.substring(0, 8)}...`);
    if (playhtUserId) console.log(`   User ID preview: ${playhtUserId.substring(0, 8)}...`);
    
    if (!playhtApiKey || !playhtUserId) {
      throw new Error('PlayHT credentials (PLAYHT_SECRET_KEY and PLAYHT_USER_ID) not found in environment variables. Please add them to your .env.local file.');
    }
    
    // Verify voice exists before attempting to use it
    console.log('🔍 Checking if voice is ready for Vapi integration...');
    
    // Try to verify the voice is available - but don't block if verification fails
    const voiceVerified = await verifyPlayHTVoice(session.clonedVoiceId);
    if (voiceVerified) {
      console.log('✅ Voice verified in PlayHT - proceeding immediately');
    } else {
      console.log('⏳ Voice verification failed/unavailable - waiting 15 seconds for Vapi sync...');
      await new Promise(resolve => setTimeout(resolve, 15000)); // Reduced to 15 seconds
    }
    
    // Configure PlayHT voice with credentials
    voiceConfig = {
      provider: 'playht',
      voiceId: session.clonedVoiceId
    };
    
    credentials = [{
      provider: 'playht',
      apiKey: playhtApiKey,
      userId: playhtUserId
    }];
    
    console.log('🎭 Using cloned PlayHT voice with credentials');
    console.log(`   🆔 Voice ID: ${session.clonedVoiceId}`);
    console.log(`   👤 User ID: ${playhtUserId.substring(0, 8)}...`);
  } else {
    // Fallback to default Vapi voice (no credentials needed)
    voiceConfig = {
      provider: 'vapi',
      voiceId: 'jennifer'
    };
    console.log('⚠️ No cloned voice available, using default Vapi voice');
  }
  
  // Create the assistant configuration
  const assistantConfig: VapiAssistantConfig = {
    name: `Future Self - ${session.userName || 'User'}`,
    voice: voiceConfig,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: systemPrompt,
      temperature: 0.8
    },
    firstMessage: `Hello ${session.userName || 'you'}... uh ... I mean, me. This is going to be strange to hear but I'm you. I'm calling from the future. I went through what you're going through now and want to help you through this moment. Does that sound ok?`,
    endCallPhrases: ["goodbye", "talk to you later", "bye", "thank you"],
    recordingEnabled: true,
    metadata: {
      originalCallId: session.callId,
      type: 'future_self',
      createdAt: Date.now(),
      sessionId: session.id
    }
  };
  
  // Add PlayHT credentials only when using PlayHT voices
  if (credentials) {
    assistantConfig.credentials = credentials;
  }

  console.log('🎭 Creating Future Self assistant with config:', {
    name: assistantConfig.name,
    voiceProvider: assistantConfig.voice.provider,
    voiceId: assistantConfig.voice.voiceId,
    hasCredentials: !!assistantConfig.credentials,
    transcriptLength: session.transcripts.length,
    promptLength: systemPrompt.length
  });

  // Retry logic for PlayHT voice creation
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Assistant creation attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assistantConfig)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Vapi API error (attempt ${attempt}):`, response.status, errorText);
        
        // If it's a PlayHT voice not found error and we have retries left, wait and try again
        if (session.clonedVoiceId && errorText.includes('not found for provider playht') && attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt - 1) * 10000; // 10s, 20s, 40s
          console.log(`⏳ Waiting ${backoffDelay/1000} seconds before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        
        // If PlayHT voice fails on final attempt, try with default Vapi voice
        if (session.clonedVoiceId && errorText.includes('not found for provider playht') && attempt === maxRetries) {
          console.log('🔄 PlayHT voice failed all attempts, retrying with default Vapi voice...');
          
          const fallbackConfig = {
            ...assistantConfig,
            voice: {
              provider: 'vapi' as const,
              voiceId: 'jennifer'
            },
            credentials: undefined // Remove credentials for Vapi voice
          };
          
          const fallbackResponse = await fetch('https://api.vapi.ai/assistant', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(fallbackConfig)
          });
          
          if (!fallbackResponse.ok) {
            const fallbackErrorText = await fallbackResponse.text();
            console.error('❌ Fallback voice also failed:', fallbackResponse.status, fallbackErrorText);
            throw new Error(`Vapi API error: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
          }
          
          const fallbackData = await fallbackResponse.json();
          console.log('✅ Future Self assistant created with fallback voice:', fallbackData.id);
          console.log('💡 PlayHT voice was not available - assistant created with default voice');
          return fallbackData.id;
        }
        
        lastError = new Error(`Vapi API error: ${response.status} ${response.statusText}`);
        if (attempt === maxRetries) throw lastError;
        continue;
      }

      const assistantData = await response.json();
      console.log(`✅ Future Self assistant created successfully on attempt ${attempt}:`, assistantData.id);
      
      return assistantData.id;
    } catch (error) {
      console.error(`❌ Assistant creation attempt ${attempt} failed:`, error);
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting 15 seconds before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
      }
    }
  }

  // If we get here, all retries failed
  console.error('❌ All assistant creation attempts failed');
  try {
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assistantConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Vapi API error:', response.status, errorText);
      
      // If PlayHT voice fails, try with default Vapi voice
      if (session.clonedVoiceId && errorText.includes('PlayHT Voice')) {
        console.log('🔄 PlayHT voice failed, retrying with default Vapi voice...');
        
        const fallbackConfig = {
          ...assistantConfig,
          voice: {
            provider: 'vapi',
            voiceId: 'jennifer'
          }
        };
        
        const fallbackResponse = await fetch('https://api.vapi.ai/assistant', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fallbackConfig)
        });
        
        if (!fallbackResponse.ok) {
          const fallbackErrorText = await fallbackResponse.text();
          console.error('❌ Fallback voice also failed:', fallbackResponse.status, fallbackErrorText);
          throw new Error(`Vapi API error: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        console.log('✅ Future Self assistant created with fallback voice:', fallbackData.id);
        console.log('💡 To use cloned voice: Add PlayHT API key to Vapi Provider Keys section');
        return fallbackData.id;
      }
      
      throw new Error(`Vapi API error: ${response.status} ${response.statusText}`);
    }

    const assistantData = await response.json();
    console.log('✅ Future Self assistant created:', assistantData.id);
    
    return assistantData.id;
  } catch (error) {
    console.error('❌ Failed to create Future Self assistant:', error);
    throw error;
  }
}

export function buildFutureSelfPrompt(session: UserSession): string {
  const userName = session.userName || 'my friend';
  const transcriptHistory = session.transcripts
    .map(t => `${t.role.toUpperCase()}: ${t.text}`)
    .join('\n');

  return `You are the future version of the person talking, calling from 10 years in the future.

Here's the conversation your past self just had with a counselor:

---
${transcriptHistory}
---

Your task:
1. You remember this exact moment and conversation vividly
2. Address their specific concerns with wisdom from having lived through it
3. Reference specific things they said to show you remember
4. Be warm, reassuring, but also specific about how things get better
5. Speak naturally - you're talking to yourself from the past
6. Keep the mystical element but make it feel real and personal

Important details to weave in:
- Use their name "${userName}" naturally in conversation
- Reference their specific problem using their exact words from the transcript
- Share how this challenge led to growth and positive outcomes
- Be specific about what changed and how their life improved
- Maintain their speech patterns and emotional style
- Mention concrete details about how you (they) overcame this specific issue

Speaking Style:
- Talk as if you're having an intimate conversation with yourself
- Use "you" when addressing them (since you're their future self talking to past self)
- Be encouraging but authentic - no false promises
- Include specific memories from this conversation
- Show how their current struggle becomes their greatest strength

Remember: You lived through their exact situation and came out stronger. Share that journey with warmth, specificity, and hope.`;
}

export async function checkVapiAssistant(assistantId: string): Promise<boolean> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error('VAPI_API_KEY not found in environment variables');
  }

  try {
    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    console.error('❌ Failed to check Vapi assistant:', error);
    return false;
  }
} 