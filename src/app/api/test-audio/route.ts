import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    
    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }
    
    // Save the audio file for debugging
    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    const filename = `test_audio_${Date.now()}.wav`;
    const filepath = path.join(process.cwd(), 'public', filename);
    
    await fs.writeFile(filepath, buffer);
    
    return NextResponse.json({ 
      success: true, 
      filename,
      size: buffer.length,
      url: `/${filename}`
    });
  } catch (error) {
    console.error('Test audio error:', error);
    return NextResponse.json({ error: 'Failed to save audio' }, { status: 500 });
  }
} 