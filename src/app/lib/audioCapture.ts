import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface VapiWebSocketMessage {
  type?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface AudioCaptureStats {
  callId: string;
  audioChunksReceived: number;
  totalAudioBytes: number;
  connectionStartTime: Date | null;
  connectionEndTime: Date | null;
  isConnected: boolean;
  voiceCloneTriggered: boolean;
}

export class VapiAudioCapture extends EventEmitter {
  private ws: WebSocket | null = null;
  private audioChunksReceived = 0;
  private totalAudioBytes = 0;
  private callId: string;
  private connectionStartTime: Date | null = null;
  private connectionEndTime: Date | null = null;
  private audioBuffer: Buffer[] = [];
  private maxBufferSize: number = 1000; // Maximum number of chunks to buffer
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  
  // Real-time voice cloning properties
  private voiceCloneTriggered = false;
  private audioStartTime: Date | null = null;
  private minSecondsForCloning = 30; // Minimum seconds before triggering voice cloning
  private sessionId: string;
  private userName: string;
  
  constructor(callId: string, sessionId: string, userName: string = 'User', maxBufferSize = 1000) {
    super();
    this.callId = callId;
    this.sessionId = sessionId;
    this.userName = userName;
    this.maxBufferSize = maxBufferSize;
  }
  
  async connect(listenUrl: string, timeoutMs = 10000) {
    console.log(`🎧 Connecting to WebSocket for call ${this.callId}...`);
    
    try {
      this.ws = new WebSocket(listenUrl);
      this.connectionStartTime = new Date();
      
      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          console.error('❌ WebSocket connection timeout');
          this.ws?.terminate();
          this.emit('error', new Error('Connection timeout'));
        }
      }, timeoutMs);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected!');
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.reconnectAttempts = 0;
        this.emit('connected');
      });
      
      this.ws.on('message', (data: Buffer | string) => {
        this.handleMessage(data);
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.emit('error', error);
      });
      
      this.ws.on('close', (code, reason) => {
        this.connectionEndTime = new Date();
        console.log(`🔴 WebSocket closed. Code: ${code}, Reason: ${reason?.toString()}`);
        console.log(`📊 Final stats: ${this.audioChunksReceived} chunks, ${this.totalAudioBytes} bytes`);
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        this.emit('closed', this.getStats());
        
        // Attempt reconnection if it was an unexpected closure
        if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect(listenUrl, timeoutMs);
        }
      });
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.emit('error', error);
    }
  }
  
  private async attemptReconnect(listenUrl: string, timeoutMs: number) {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // Exponential backoff
    
    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    
    setTimeout(() => {
      this.connect(listenUrl, timeoutMs);
    }, delay);
  }
  
  private handleMessage(data: Buffer | string) {
    if (data instanceof Buffer) {
      // This is audio data!
      this.analyzeAudioFormat(data); // Add audio format debugging
      this.audioChunksReceived++;
      this.totalAudioBytes += data.length;
      
      // Set audio start time on first chunk
      if (!this.audioStartTime) {
        this.audioStartTime = new Date();
        console.log('🎤 Audio recording started for real-time voice cloning');
      }
      
      // Add to buffer (with size limit)
      if (this.audioBuffer.length < this.maxBufferSize) {
        this.audioBuffer.push(data);
      } else {
        // Remove oldest chunk to make room
        this.audioBuffer.shift();
        this.audioBuffer.push(data);
      }
      
      // Log every 100th chunk so we don't spam console
      if (this.audioChunksReceived % 100 === 0) {
        console.log(`🎵 Received ${this.audioChunksReceived} audio chunks, latest size: ${data.length} bytes, total: ${this.totalAudioBytes} bytes`);
      }
      
      // 🎭 TIME-BASED REAL-TIME VOICE CLONING CHECK
      if (!this.voiceCloneTriggered && this.audioStartTime) {
        const secondsElapsed = (Date.now() - this.audioStartTime.getTime()) / 1000;
        
        if (secondsElapsed >= this.minSecondsForCloning) {
          this.voiceCloneTriggered = true;
          console.log(`🎭 15 seconds of audio captured! Triggering real-time voice cloning...`);
          this.triggerRealTimeVoiceCloning();
        }
      }
      
      // Emit the audio chunk for further processing
      this.emit('audioChunk', data);
    } else {
      // This is JSON metadata
      try {
        const message: VapiWebSocketMessage = JSON.parse(data.toString());
        
        // Look for audio format information in metadata
        if (message.type === 'audio-format' || message.format) {
          console.log('📊 Audio format detected:', message);
          this.emit('audioFormat', message);
        }
        
        console.log('📊 WebSocket metadata:', message);
        this.emit('metadata', message);
      } catch {
        console.log('📦 Non-JSON message:', data.toString());
      }
    }
  }
  
  // Add this debug method to analyze audio format
  private analyzeAudioFormat(data: Buffer) {
    // Log first few audio chunks in detail
    if (this.audioChunksReceived <= 5) {
      console.log(`\n🔍 Audio Chunk Analysis #${this.audioChunksReceived}:`);
      console.log(`- Size: ${data.length} bytes`);
      console.log(`- First 20 bytes (hex):`, data.slice(0, 20).toString('hex'));
      console.log(`- First 10 samples (16-bit LE):`, Array.from(new Int16Array(data.slice(0, 20).buffer)));
      
      // Check if it's stereo by looking at pattern
      const samples = new Int16Array(data.buffer);
      let possibleStereo = true;
      for (let i = 0; i < Math.min(samples.length - 2, 100); i += 2) {
        if (samples[i] !== 0 && samples[i + 1] !== 0) {
          possibleStereo = true;
          break;
        }
      }
      console.log(`- Possible stereo: ${possibleStereo}`);
    }
  }
  
  private async triggerRealTimeVoiceCloning() {
    try {
      console.log('🎙️ Starting real-time voice cloning...');
      
      const audioForCloning = this.getBufferedAudio();
      if (audioForCloning.length === 0) {
        throw new Error('No audio data available for cloning');
      }
      
      // Extract only user audio (channel 0) from stereo PCM
      const userAudio = this.extractUserChannel(audioForCloning);
      console.log(`📦 Extracted user audio: ${userAudio.length} bytes from ${audioForCloning.length} chunks`);
      
      // Create WAV file with correct sample rate
      const wavFile = this.createWAVFile(userAudio, 16000); // Keep at 16kHz for now
      
      // Convert to blob
      const audioBlob = new Blob([wavFile], { type: 'audio/wav' });
      
      // Emit event for processing
      this.emit('voiceCloneReady', {
        sessionId: this.sessionId,
        callId: this.callId,
        userName: this.userName,
        audioBlob: audioBlob,
        stats: {
          chunks: audioForCloning.length,
          bytes: userAudio.length,
          duration: Math.round((Date.now() - this.audioStartTime!.getTime()) / 1000)
        }
      });
      
    } catch (error) {
      console.error('❌ Voice cloning trigger failed:', error);
      this.emit('voiceCloneError', error);
    }
  }
  
  // New method to extract user channel from stereo PCM
  private extractUserChannel(audioChunks: Buffer[]): Buffer {
    const extractedChunks: Buffer[] = [];
    
    for (const chunk of audioChunks) {
      const samples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
      const userSamples = new Int16Array(samples.length / 2);
      
      // Extract every other sample (channel 0)
      for (let i = 0; i < samples.length; i += 2) {
        userSamples[i / 2] = samples[i];
      }
      
      extractedChunks.push(Buffer.from(userSamples.buffer));
    }
    
    return Buffer.concat(extractedChunks);
  }
  
  // Simplified WAV creation without upsampling
  private createWAVFile(audioData: Buffer, sampleRate: number): Buffer {
    const channels = 1;
    const bitsPerSample = 16;
    const dataSize = audioData.length;
    
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, audioData]);
  }
  
  disconnect() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }
  
  getBufferedAudio(): Buffer[] {
    return [...this.audioBuffer]; // Return a copy to prevent mutation
  }
  
  clearBuffer() {
    this.audioBuffer = [];
    console.log('🧹 Audio buffer cleared');
  }
  
  // Method to manually trigger voice cloning (for testing when < 30 seconds)
  manualTriggerVoiceCloning() {
    if (!this.voiceCloneTriggered && this.audioBuffer.length > 0) {
      console.log('🧪 Manually triggering voice cloning...');
      this.triggerRealTimeVoiceCloning();
      this.voiceCloneTriggered = true;
    } else {
      console.log('⚠️ Voice cloning already triggered or no audio available');
    }
  }
  
  getStats(): AudioCaptureStats {
    return {
      callId: this.callId,
      audioChunksReceived: this.audioChunksReceived,
      totalAudioBytes: this.totalAudioBytes,
      connectionStartTime: this.connectionStartTime,
      connectionEndTime: this.connectionEndTime,
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      voiceCloneTriggered: this.voiceCloneTriggered
    };
  }
} 