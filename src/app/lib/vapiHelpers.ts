import { UserSession } from '../types';

export interface VapiAssistantConfig {
  name: string;
  voice: {
    provider: '11labs' | 'vapi';
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
}

export async function createFutureSelfAssistant(session: UserSession): Promise<string> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error('VAPI_API_KEY not found in environment variables');
  }

  // Build the system prompt with conversation context
  const systemPrompt = buildFutureSelfPrompt(session);
  
  // Determine which voice to use
  let voiceConfig: {
    provider: '11labs' | 'vapi';
    voiceId: string;
    stability?: number;
    similarityBoost?: number;
  };
  
  if (session.clonedVoiceId) {
    // Try to use the cloned ElevenLabs voice
    voiceConfig = {
      provider: '11labs',
      voiceId: session.clonedVoiceId,
      stability: 0.8,
      similarityBoost: 0.75
    };
    console.log('🎭 Attempting to use cloned ElevenLabs voice:', session.clonedVoiceId);
  } else {
    // Fallback to default Vapi voice
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
    firstMessage: "Hello... uh, I mean, me. This is strange for both of us, but I need you to listen...",
    endCallPhrases: ["goodbye", "talk to you later", "bye", "thank you"],
    recordingEnabled: true
  };

  console.log('🎭 Creating Future Self assistant with config:', {
    name: assistantConfig.name,
    voiceProvider: assistantConfig.voice.provider,
    voiceId: assistantConfig.voice.voiceId,
    transcriptLength: session.transcripts.length,
    promptLength: systemPrompt.length
  });

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
      
      // If ElevenLabs voice fails, try with default Vapi voice
      if (session.clonedVoiceId && errorText.includes('11labs Voice')) {
        console.log('🔄 ElevenLabs voice failed, retrying with default Vapi voice...');
        
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
        console.log('💡 To use cloned voice: Add ElevenLabs API key to Vapi Provider Keys section');
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