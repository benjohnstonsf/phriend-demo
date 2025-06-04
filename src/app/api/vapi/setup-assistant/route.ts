import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assistantId = searchParams.get('assistantId') || 'b98d351e-3589-4e46-98ca-e6f3b573a775';
  const webhookUrl = searchParams.get('webhookUrl');
  
  if (!process.env.VAPI_API_KEY) {
    return NextResponse.json(
      { error: 'VAPI_API_KEY environment variable is required' }, 
      { status: 500 }
    );
  }

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'webhookUrl query parameter is required. Example: ?webhookUrl=https://abc123.ngrok.io/api/vapi/webhook' }, 
      { status: 400 }
    );
  }

  try {
    console.log('🔧 Updating assistant configuration...');
    console.log('   📍 Assistant ID:', assistantId);
    console.log('   🔗 Webhook URL:', webhookUrl);

    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverUrl: webhookUrl,
        monitorPlan: {
          listenEnabled: true,
          controlEnabled: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Vapi API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Vapi API error: ${response.status} ${errorText}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Assistant updated successfully!');
    console.log('   🎧 Monitor plan enabled');
    console.log('   🔗 Webhook URL set to:', webhookUrl);

    return NextResponse.json({ 
      success: true, 
      assistant: data,
      message: 'Assistant updated with webhook URL and monitor plan enabled'
    });
    
  } catch (error) {
    console.error('❌ Failed to update assistant:', error);
    return NextResponse.json(
      { error: `Failed to update assistant: ${error}` }, 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { assistantId, webhookUrl } = body;
  
  if (!process.env.VAPI_API_KEY) {
    return NextResponse.json(
      { error: 'VAPI_API_KEY environment variable is required' }, 
      { status: 500 }
    );
  }

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'webhookUrl is required in request body' }, 
      { status: 400 }
    );
  }

  const finalAssistantId = assistantId || 'b98d351e-3589-4e46-98ca-e6f3b573a775';

  try {
    console.log('🔧 Updating assistant configuration...');
    console.log('   📍 Assistant ID:', finalAssistantId);
    console.log('   🔗 Webhook URL:', webhookUrl);

    const response = await fetch(`https://api.vapi.ai/assistant/${finalAssistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverUrl: webhookUrl,
        monitorPlan: {
          listenEnabled: true,
          controlEnabled: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Vapi API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Vapi API error: ${response.status} ${errorText}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Assistant updated successfully!');

    return NextResponse.json({ 
      success: true, 
      assistant: data,
      message: 'Assistant updated with webhook URL and monitor plan enabled'
    });
    
  } catch (error) {
    console.error('❌ Failed to update assistant:', error);
    return NextResponse.json(
      { error: `Failed to update assistant: ${error}` }, 
      { status: 500 }
    );
  }
} 