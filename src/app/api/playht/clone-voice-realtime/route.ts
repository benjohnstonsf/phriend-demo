import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PlayHTVoice {
  id: string;
  name: string;
  created_at: string;
  is_cloned: boolean;
  voice_engine: string;
  language: string;
  language_code: string;
  gender: string;
  age: string;
  accent: string;
  style: string;
  tempo: string;
  texture: string;
}

export async function POST(req: NextRequest) {
  try {
    console.log('🎭 Starting real-time voice cloning with PlayHT...');

    // Get form data
    const formData = await req.formData();
    const callId = formData.get('callId') as string;
    const userName = formData.get('userName') as string;
    const audioBlob = formData.get('audio') as File;

    if (!callId || !userName || !audioBlob) {
      console.error('❌ Missing required fields:', { callId: !!callId, userName: !!userName, audioBlob: !!audioBlob });
      return NextResponse.json(
        { error: 'Missing required fields: callId, userName, and audio file' },
        { status: 400 }
      );
    }

    // Validate environment
    const userId = process.env.PLAYHT_USER_ID;
    const secretKey = process.env.PLAYHT_SECRET_KEY;
    
    if (!userId || !secretKey) {
      console.error('❌ CRITICAL: PlayHT credentials not found in environment!');
      console.error('❌ Please set PLAYHT_USER_ID and PLAYHT_SECRET_KEY in your .env.local file');
      return NextResponse.json(
        { error: 'PlayHT credentials not configured' },
        { status: 500 }
      );
    }

    console.log('🔑 Environment check:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  - User ID exists: ${!!userId}`);
    console.log(`  - Secret key exists: ${!!secretKey}`);
    console.log(`  - User ID preview: ${userId.substring(0, 8)}...`);

    console.log(`🎭 Starting real-time voice cloning for call ${callId}...`);
    console.log(`📊 Audio blob size: ${audioBlob.size} bytes`);
    console.log(`📊 Audio blob type: ${audioBlob.type}`);

    // Validate audio size - PlayHT accepts 5KB to 50MB
    if (audioBlob.size < 5000) { // Less than 5KB
      console.warn('⚠️ Audio file seems small - PlayHT requires minimum 5KB');
      return NextResponse.json(
        { error: 'Audio file too small. PlayHT requires minimum 5KB audio file.' },
        { status: 400 }
      );
    }
    
    if (audioBlob.size > 50000000) { // More than 50MB
      console.warn('⚠️ Audio file too large - PlayHT maximum is 50MB');
      return NextResponse.json(
        { error: 'Audio file too large. PlayHT accepts maximum 50MB audio file.' },
        { status: 400 }
      );
    }

    // Save audio file locally as backup (for debugging)
    console.log('💾 Saving backup audio file locally...');
    
    const fileName = `voice_${callId}_${userName}_${Date.now()}.wav`;
    const filePath = path.join(process.cwd(), 'audio_exports', fileName);
    
    // Create directory if it doesn't exist
    const exportDir = path.join(process.cwd(), 'audio_exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
      console.log('📁 Created audio_exports directory');
    }
    
    // Convert blob to buffer and save
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`✅ Backup audio file saved to: ${filePath}`);

    console.log('📤 Sending audio to PlayHT for instant cloning...');

    // Create FormData for PlayHT API - using correct field names from working manual test
    const playhtFormData = new FormData();
    
    // Use callId as the voice name (this worked in manual test)
    const voiceName = callId;
    playhtFormData.append('voice_name', voiceName);
    // Fix: Explicitly set the MIME type to audio/wav to match PlayHT requirements
    const audioFile = new File([audioBlob], fileName, { type: 'audio/wav' });
    playhtFormData.append('sample_file', audioFile);

    console.log('🔧 FormData prepared with:', {
      voice_name: voiceName,
      fileName: fileName,
      audioSize: audioBlob.size,
      audioType: audioBlob.type
    });

    console.log('🌐 Making request to PlayHT...');
    console.log('🌐 URL: https://api.play.ht/api/v2/cloned-voices/instant');
    
    const startTime = Date.now();

    try {
      console.log('⏰ Setting 60-second timeout for fetch request...');
      
      // Log what we're about to send
      console.log('🔍 Request details:');
      console.log('  URL:', 'https://api.play.ht/api/v2/cloned-voices/instant');
      console.log('  Headers:', {
        'X-USER-ID': userId,
        'AUTHORIZATION': secretKey.substring(0, 10) + '...',
        'accept': 'application/json',
      });
      console.log('  FormData entries:', Array.from(playhtFormData.entries()).map(([k, v]) => [k, v instanceof File ? `File(${v.name}, ${v.size}b, ${v.type})` : v]));
      console.log('⏳ Sending request now...');
      
      try {
        // Both axios and fetch hang indefinitely - use curl subprocess since curl works perfectly
        console.log('🐚 Using curl subprocess (axios and fetch both hang indefinitely)...');
        
        const curlCommand = [
          'curl',
          '--request POST',
          '--url https://api.play.ht/api/v2/cloned-voices/instant',
          `--header 'AUTHORIZATION: ${secretKey}'`,
          `--header 'X-USER-ID: ${userId}'`,
          `--header 'accept: application/json'`,
          `--form 'sample_file=@${filePath};type=audio/wav'`,
          `--form 'voice_name=${voiceName}'`,
          '--max-time 60'  // 60 second timeout
        ].join(' ');
        
        console.log('🐚 Executing curl command...');
        console.log('📋 Command preview:', curlCommand.replace(secretKey, secretKey.substring(0, 10) + '...'));
        
        const { stdout, stderr } = await execAsync(curlCommand, {
          timeout: 65000, // 65 second timeout (slightly more than curl's 60s)
          cwd: process.cwd()
        });

        console.log('🎉 Curl subprocess completed successfully!');
        const responseTime = Date.now() - startTime;
        console.log(`⚡ PlayHT request completed in ${responseTime}ms (${Math.round(responseTime/1000)}s)`);
        
        if (stderr) {
          console.warn('⚠️ Curl stderr:', stderr);
        }
        
        console.log('🎉 Curl stdout:', stdout);

        // Parse the JSON response
        let cloneData;
        try {
          cloneData = JSON.parse(stdout.trim());
        } catch (parseError) {
          console.error('❌ Failed to parse PlayHT response as JSON:', stdout);
          console.error('❌ Parse error:', parseError);
          throw new Error(`Invalid JSON response from PlayHT: ${stdout}`);
        }

        console.log('🎉 PlayHT Response Data:', JSON.stringify(cloneData, null, 2));

        if (!cloneData.id) {
          console.error('❌ No voice ID in response - PlayHT may have rejected the audio');
          console.error('❌ Full response:', cloneData);
          throw new Error('Voice cloning failed: No voice ID returned from PlayHT');
        }

        console.log(`✅ Real-time voice clone created successfully: ${cloneData.id}`);

        return NextResponse.json({
          success: true,
          voice_id: cloneData.id,
          voice_name: cloneData.name,
          voice_type: cloneData.type,
          voice_engine: cloneData.voice_engine,
          call_id: callId,
          message: `Voice clone created successfully for ${userName}`,
          playht_response: cloneData,
          backup_file: filePath,
          processing_time_seconds: Math.round(responseTime/1000)
        });

      } catch (error) {
        console.error('❌ Real-time voice cloning error:', error);
        
        // Provide more detailed error information
        if (error instanceof Error) {
          console.error('❌ Error name:', error.name);
          console.error('❌ Error message:', error.message);
          console.error('❌ Error stack:', error.stack);
        }
        
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Real-time voice cloning failed' },
          { status: 500 }
        );
      }

    } catch (error) {
      console.error('❌ Real-time voice cloning error:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Real-time voice cloning failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Real-time voice cloning error:', error);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Real-time voice cloning failed' },
      { status: 500 }
    );
  }
}

// Helper endpoint to get voice details
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get('voiceId');

    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId parameter required' }, { status: 400 });
    }

    const userId = process.env.PLAYHT_USER_ID;
    const secretKey = process.env.PLAYHT_SECRET_KEY;
    
    if (!userId || !secretKey) {
      return NextResponse.json({ error: 'PlayHT credentials not configured' }, { status: 500 });
    }

    // Get list of cloned voices and find the specific one
    const response = await fetch('https://api.play.ht/api/v2/cloned-voices', {
      headers: {
        'X-USER-ID': userId,
        'AUTHORIZATION': `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`PlayHT API error: ${response.status} ${response.statusText}`);
    }

    const voicesData = await response.json() as PlayHTVoice[];
    const voice = voicesData.find((v: PlayHTVoice) => v.id === voiceId);

    if (!voice) {
      return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      voice_id: voice.id,
      name: voice.name,
      created_at: voice.created_at,
      is_cloned: voice.is_cloned,
      voice_engine: voice.voice_engine,
      language: voice.language,
      language_code: voice.language_code,
      gender: voice.gender,
      age: voice.age,
      accent: voice.accent,
      style: voice.style,
      tempo: voice.tempo,
      texture: voice.texture
    });

  } catch (error) {
    console.error('❌ Error getting voice details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get voice details' },
      { status: 500 }
    );
  }
}

// Helper endpoint to delete a cloned voice
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get('voiceId');

    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId parameter required' }, { status: 400 });
    }

    const userId = process.env.PLAYHT_USER_ID;
    const secretKey = process.env.PLAYHT_SECRET_KEY;
    
    if (!userId || !secretKey) {
      return NextResponse.json({ error: 'PlayHT credentials not configured' }, { status: 500 });
    }

    const deleteResponse = await fetch(`https://api.play.ht/api/v2/cloned-voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'X-USER-ID': userId,
        'AUTHORIZATION': `Bearer ${secretKey}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('PlayHT delete error:', errorText);
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