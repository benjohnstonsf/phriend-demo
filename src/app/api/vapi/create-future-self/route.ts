import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, voiceId, userName, problemDescription } = await req.json();

    if (!sessionId || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, voiceId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Vapi API key not configured' },
        { status: 500 }
      );
    }

    console.log('Creating future self assistant for session:', sessionId);

    // Create a personalized system prompt for the future self
    const systemPrompt = createFutureSelfPrompt(userName, problemDescription);

    // Step 1: Create the future self assistant
    const assistantResponse = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Future Self - ${userName || 'User'} - ${sessionId}`,
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          temperature: 0.8,
        },
        voice: {
          provider: '11labs',
          voiceId: voiceId,
        },
        maxDurationSeconds: 180, // 3 minutes max for callback
        endCallPhrases: ['goodbye', 'take care', 'I love you', 'be well'],
        metadata: {
          sessionId,
          type: 'future_self_callback',
          originalProblem: problemDescription
        }
      }),
    });

    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      console.error('Vapi assistant creation error:', errorText);
      throw new Error(`Assistant creation failed: ${assistantResponse.statusText}`);
    }

    const assistantData = await assistantResponse.json();
    console.log('Future self assistant created:', assistantData.id);

    return NextResponse.json({
      assistantId: assistantData.id,
      status: 'created',
      message: 'Future self assistant created successfully'
    });

  } catch (error) {
    console.error('Future self creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Future self creation failed' },
      { status: 500 }
    );
  }
}

function createFutureSelfPrompt(userName?: string, problemDescription?: string): string {
  const name = userName || 'friend';
  const problem = problemDescription || 'the challenges you are facing';

  return `You are the future self of ${name}, calling from 5 years in the future. You have the exact same voice as ${name} because you ARE ${name}, just older and wiser.

You are calling to provide comfort and perspective about ${problem}. 

Key guidelines:
1. Speak as if you are truly ${name} from the future - use "I" and personal references
2. Be warm, loving, and reassuring - the way you would want to comfort yourself
3. Share specific wisdom about how things worked out regarding ${problem}
4. Mention how you (both of you) grew stronger from this experience
5. Keep the tone hopeful and uplifting
6. Reference the specific problem they mentioned: ${problem}
7. Speak as if you remember being in their exact situation
8. Keep responses natural and conversational, not overly philosophical

Start by saying something like "Hey ${name}, it is you... from the future. I know this might sound crazy, but I wanted to call and tell you something important about ${problem}..."

Remember: You ARE ${name}, just 5 years older. You have been through exactly what they are going through now, and you made it through beautifully.`;
} 