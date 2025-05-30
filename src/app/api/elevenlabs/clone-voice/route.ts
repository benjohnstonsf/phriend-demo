import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, recordingUrl, name } = await req.json();

    if (!sessionId || !recordingUrl || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, recordingUrl, name' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    console.log('Starting voice cloning for session:', sessionId);

    // Step 1: Download the audio file from the recording URL
    console.log('Downloading audio file from:', recordingUrl);
    const audioResponse = await fetch(recordingUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

    // Step 2: Create voice clone using ElevenLabs instant voice cloning
    console.log('Creating voice clone with ElevenLabs...');
    
    const formData = new FormData();
    formData.append('name', `${name}_${sessionId}`);
    formData.append('description', `Voice clone for ${name} - Session ${sessionId}`);
    formData.append('files', audioBlob, 'recording.wav');

    const cloneResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    });

    if (!cloneResponse.ok) {
      const errorText = await cloneResponse.text();
      console.error('ElevenLabs error:', errorText);
      throw new Error(`Voice cloning failed: ${cloneResponse.statusText}`);
    }

    const cloneData = await cloneResponse.json();
    console.log('Voice clone created successfully:', cloneData.voice_id);

    return NextResponse.json({
      voice_id: cloneData.voice_id,
      name: cloneData.name,
      status: 'ready'
    });

  } catch (error) {
    console.error('Voice cloning error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Voice cloning failed' },
      { status: 500 }
    );
  }
}

// Helper function to delete voice clone (for privacy)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get('voiceId');

    if (!voiceId) {
      return NextResponse.json({ error: 'Voice ID required' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete voice: ${deleteResponse.statusText}`);
    }

    console.log('Voice clone deleted successfully:', voiceId);
    return NextResponse.json({ status: 'deleted' });

  } catch (error) {
    console.error('Voice deletion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Voice deletion failed' },
      { status: 500 }
    );
  }
} 