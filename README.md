# Phriend - Your Future Self Counselor

A magical web application where users can talk to an AI counselor about their problems, and then receive a phone call from their "future self" using their cloned voice to provide comfort and wisdom.

## Features

- 🎯 **AI Counseling**: Initial therapeutic conversation with AI assistant
- 🎧 **Real-time Audio Capture**: Captures live audio during the conversation
- 🔊 **Voice Cloning**: Captures and clones your voice during the conversation using PlayHT
- 🎭 **Future Self Creation**: Creates an AI assistant using your cloned voice
- 📞 **Callback System**: Calls you back as your future self
- 🧠 **Contextual Memory**: Future self remembers your conversation and provides personalized advice

## Technology Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS  
- **Voice AI**: Vapi.ai for conversational AI
- **Voice Cloning**: PlayHT instant voice cloning
- **Real-time Audio**: WebSocket audio capture and processing
- **Deployment**: Vercel-ready with proper environment configuration

## Environment Variables

Create a `.env.local` file with the following:

```bash
# Vapi Configuration  
VAPI_API_KEY=your_vapi_api_key_here
VAPI_PHONE_NUMBER_ID=your_phone_number_id_here

# PlayHT Configuration
PLAYHT_USER_ID=your_playht_user_id_here
PLAYHT_SECRET_KEY=your_playht_secret_key_here

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Setup Instructions

### Required API Keys

#### PlayHT Setup
1. Go to [PlayHT](https://play.ht)
2. Sign up for an account
3. Navigate to API Keys section
4. Copy your User ID (for `PLAYHT_USER_ID`)
5. Copy your Secret Key (for `PLAYHT_SECRET_KEY`)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd phriend-demo
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Vapi Configuration
VAPI_API_KEY=your_vapi_api_key_here
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key_here
VAPI_WEBHOOK_SECRET=your_vapi_webhook_secret_here

# PlayHT Configuration
PLAYHT_USER_ID=your_playht_user_id_here
PLAYHT_SECRET_KEY=your_playht_secret_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## How It Works

### User Flow
1. User opens the app and clicks "Start Voice Session"
2. AI counselor greets them and asks about their problems
3. During the conversation (2-3 minutes), audio is recorded
4. When the call ends, the system:
   - Clones the user's voice using PlayHT
   - Creates a "future self" assistant with the cloned voice
   - Generates a personalized prompt based on their problem
   - Initiates a callback (in production, would call their phone)

### Technical Flow
1. **Frontend**: React component using Vapi Web SDK
2. **Webhook Handler**: Processes Vapi events (call start/end, transcripts, recordings)
3. **Voice Cloning**: Downloads recording and creates voice clone
4. **Future Self Creation**: Creates personalized assistant with cloned voice
5. **Callback**: Initiates outbound call with future self persona

## Development

### Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── vapi/
│   │   │   ├── webhook/          # Vapi webhook handler
│   │   │   └── create-future-self/ # Future self assistant creation
│   │   └── elevenlabs/
│   │       └── clone-voice/      # Voice cloning endpoint
│   ├── components/
│   │   └── VoiceCounselor.tsx    # Main voice interface
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── layout.tsx
│   └── page.tsx
```

### Key Components

#### VoiceCounselor Component
- Handles Vapi Web SDK integration
- Manages call states and UI
- Beautiful, calming interface design

#### Webhook Handler
- Processes Vapi events
- Extracts user information from transcripts
- Orchestrates voice cloning workflow

#### Voice Cloning API
- Downloads audio from Vapi recordings
- Creates instant voice clone with PlayHT
- Returns voice ID for future use

#### Future Self API
- Creates personalized assistant prompt
- Sets up Vapi assistant with cloned voice
- Manages callback initiation

## Testing

### Local Testing with ngrok
For webhook testing during development:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL for Vapi webhook configuration
# e.g., https://abc123.ngrok.io/api/vapi/webhook
```

### Testing Checklist
- [ ] Voice call connects successfully
- [ ] Transcript capture works
- [ ] Recording URL is received
- [ ] Voice cloning completes
- [ ] Future self assistant is created
- [ ] Webhook events are processed correctly

## Production Deployment

### Environment Setup
1. Deploy to Vercel, Netlify, or similar platform
2. Set all environment variables in production
3. Update `NEXT_PUBLIC_APP_URL` to your domain
4. Configure Vapi webhook URL to your production domain

### Considerations
- **Phone Numbers**: Add phone number collection for actual callbacks
- **Session Storage**: Replace in-memory storage with Redis
- **Error Handling**: Add comprehensive error recovery
- **Rate Limiting**: Implement API rate limiting
- **Voice Cleanup**: Schedule voice clone deletion
- **Analytics**: Add usage tracking and monitoring

## Privacy & Ethics

- Voice recordings are temporary and deleted after cloning
- Voice clones are deleted after the callback session
- Clear user consent for voice recording and cloning
- Transparent about AI nature of the counselor
- No storage of personal problem descriptions beyond session

## Troubleshooting

### Common Issues

**Microphone Not Working**
- Check browser permissions
- Ensure HTTPS in production

**Voice Cloning Fails**
- Verify PlayHT API key and credits
- Ensure recording quality is sufficient (30+ seconds)
- Check audio format compatibility

**Webhook Not Receiving Events**
- Verify ngrok/production URL is correct
- Check Vapi dashboard webhook configuration
- Review server logs for errors

**Assistant Creation Fails**
- Verify Vapi API key permissions
- Check voice ID is valid
- Review assistant configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review API documentation for Vapi and PlayHT
- Open an issue on GitHub
