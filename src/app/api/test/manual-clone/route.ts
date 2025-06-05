import { NextRequest, NextResponse } from 'next/server';

// Import the sessions map and audioCaptures from the webhook route
// Note: In production, these should be in a shared state manager like Redis
export async function POST(req: NextRequest) {
  try {
    const { callId } = await req.json();

    if (!callId) {
      return NextResponse.json({ error: 'Call ID required' }, { status: 400 });
    }

    console.log(`🧪 Manual voice cloning test for call: ${callId}`);

    // This would normally access the shared audioCaptures map
    // For now, we'll return a test response
    return NextResponse.json({
      message: 'Manual voice cloning test endpoint',
      callId,
      note: 'In a real implementation, this would trigger voice cloning on the active audio capture',
      instructions: 'Use audioCapture.manualTriggerVoiceCloning() method during an active call'
    });

  } catch (error) {
    console.error('Manual clone test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Manual clone test failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Manual Voice Cloning Test Endpoint',
    usage: 'POST with { "callId": "your-call-id" } to trigger manual voice cloning',
    note: 'This is useful for testing voice cloning with calls shorter than 30 seconds'
  });
} 