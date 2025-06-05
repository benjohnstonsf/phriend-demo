import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';

export async function POST(req: NextRequest) {
  try {
    console.log('🎭 Starting real-time voice cloning...');

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
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('❌ CRITICAL: ElevenLabs API key not found in environment!');
      console.error('❌ Please set ELEVENLABS_API_KEY in your .env.local file');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    console.log('🔑 Environment check:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  - API key exists: ${!!apiKey}`);
    console.log(`  - API key length: ${apiKey.length}`);
    console.log(`  - API key preview: ${apiKey.substring(0, 8)}...`);

    console.log(`🎭 Starting real-time voice cloning for call ${callId}...`);
    console.log(`📊 Audio blob size: ${audioBlob.size} bytes`);
    console.log(`📊 Audio blob type: ${audioBlob.type}`);

    // Validate audio size - ElevenLabs requires minimum audio for cloning
    if (audioBlob.size < 50000) { // Less than ~50KB seems too small
      console.warn('⚠️ Audio file seems small - this might cause ElevenLabs to reject it');
    }
    
    if (audioBlob.size > 50000000) { // More than ~50MB might timeout
      console.warn('⚠️ Audio file seems large - this might cause ElevenLabs timeout');
    }

    console.log('📤 Sending audio to ElevenLabs for instant cloning...');

    // Convert File to Buffer for axios
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    // Create FormData for axios using Node.js form-data
    const axiosFormData = new FormData();
    axiosFormData.append('name', `${userName}_voice_${callId.substring(0, 8)}`);
    axiosFormData.append('description', `Real-time voice clone for ${userName} from call ${callId}`);
    axiosFormData.append('files', audioBuffer, {
      filename: 'realtime_audio.wav',
      contentType: 'audio/wav',
    });
    axiosFormData.append('remove_background_noise', 'true');

    console.log('🔧 FormData prepared with:', {
      name: `${userName}_voice_${callId.substring(0, 8)}`,
      description: `Real-time voice clone for ${userName} from call ${callId}`,
      audioSize: audioBlob.size,
      audioType: audioBlob.type
    });

    console.log('🌐 Making axios request to ElevenLabs...');
    console.log('🌐 URL: https://api.elevenlabs.io/v1/voices/add');
    
    const startTime = Date.now();

    try {
      const cloneResponse = await axios.post('https://api.elevenlabs.io/v1/voices/add', axiosFormData, {
        headers: {
          'xi-api-key': apiKey,
          ...axiosFormData.getHeaders(),
        },
        timeout: 120000, // 2 minute timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const responseTime = Date.now() - startTime;
      console.log(`⚡ Axios request completed in ${responseTime}ms`);
      
      console.log('🎉 ElevenLabs Response Status:', cloneResponse.status);
      console.log('🎉 ElevenLabs Response Headers:', cloneResponse.headers);
      console.log('🎉 ElevenLabs Response Data:', JSON.stringify(cloneResponse.data, null, 2));

      const cloneData = cloneResponse.data;

      if (!cloneData.voice_id) {
        console.error('❌ No voice_id in response - ElevenLabs may have rejected the audio');
        console.error('❌ Full response:', cloneData);
        throw new Error('Voice cloning failed: No voice_id returned from ElevenLabs');
      }

      console.log(`✅ Real-time voice clone created successfully: ${cloneData.voice_id}`);

      return NextResponse.json({
        success: true,
        voice_id: cloneData.voice_id,
        call_id: callId,
        message: `Voice clone created successfully for ${userName}`,
        elevenlabs_response: cloneData
      });

    } catch (axiosError) {
      const responseTime = Date.now() - startTime;
      console.log(`💥 Axios request failed after ${responseTime}ms`);
      
      if (axios.isAxiosError(axiosError)) {
        console.error('💥 Axios error details:');
        console.error('💥 Status:', axiosError.response?.status);
        console.error('💥 Status text:', axiosError.response?.statusText);
        console.error('💥 Response data:', axiosError.response?.data);
        console.error('💥 Request config:', {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          timeout: axiosError.config?.timeout,
        });
        
        if (axiosError.code === 'ECONNABORTED') {
          console.error('❌ Request timed out after 2 minutes');
          throw new Error('Voice cloning request timed out after 2 minutes');
        }
        
        if (axiosError.response) {
          // Server responded with error status
          throw new Error(`ElevenLabs API error: ${axiosError.response.status} ${axiosError.response.statusText}`);
        } else if (axiosError.request) {
          // Request was made but no response received
          console.error('❌ No response received from ElevenLabs');
          throw new Error('No response received from ElevenLabs API');
        } else {
          // Error in setting up the request
          console.error('❌ Error setting up request:', axiosError.message);
          throw new Error(`Request setup error: ${axiosError.message}`);
        }
      }
      
      throw axiosError;
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

// Helper endpoint to get voice details using axios
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get('voiceId');

    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId parameter required' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    const response = await axios.get(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: {
        'xi-api-key': apiKey,
      },
      timeout: 30000, // 30 second timeout
    });

    const voiceData = response.data;

    return NextResponse.json({
      success: true,
      voice_id: voiceData.voice_id,
      name: voiceData.name,
      category: voiceData.category,
      description: voiceData.description,
      preview_url: voiceData.preview_url,
      available_for_tiers: voiceData.available_for_tiers,
      settings: voiceData.settings,
      sharing: voiceData.sharing,
      high_quality_base_model_ids: voiceData.high_quality_base_model_ids,
      safety_control: voiceData.safety_control,
      voice_verification: voiceData.voice_verification
    });

  } catch (error) {
    console.error('❌ Error getting voice details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get voice details' },
      { status: 500 }
    );
  }
} 