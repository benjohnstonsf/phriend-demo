# Phriend Setup Guide

Follow these steps to get your Phriend voice counseling app up and running!

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Environment Variables
Create a `.env.local` file in the root directory with these variables:

```bash
# Copy and paste this into your .env.local file:

# Vapi Configuration
VAPI_API_KEY=your_vapi_api_key_here
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id_here

# PlayHT Configuration
PLAYHT_USER_ID=your_playht_user_id_here
PLAYHT_SECRET_KEY=your_playht_secret_key_here

# Application Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Get Your API Keys

#### Vapi API Keys
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai)
2. Create an account
3. Navigate to your dashboard
4. Copy your API key and Phone Number ID

#### PlayHT API Keys
1. Go to [PlayHT](https://play.ht)
2. Sign up for an account
3. Navigate to API Keys section
4. Copy your User ID (for `PLAYHT_USER_ID`)
5. Copy your Secret Key (for `PLAYHT_SECRET_KEY`)

### 4. Run the App
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

## Testing the Complete Flow

### For Local Development with Webhooks

Since Vapi needs to send webhooks to your app, you'll need to expose your local server:

1. **Install ngrok** (if you don't have it):
   ```bash
   npm install -g ngrok
   ```

2. **In a new terminal, expose your local server**:
   ```bash
   ngrok http 3000
   ```

3. **Configure Vapi webhook**:
   - Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
   - Go to your Vapi dashboard
   - Set webhook URL to: `https://abc123.ngrok.io/api/vapi/webhook`

### Testing Steps

1. **Start Voice Session**: Click "Start Voice Session"
2. **Talk to the Counselor**: 
   - Say your name when asked
   - Share a problem or concern (speak for at least 30-60 seconds)
   - Say "goodbye" or "thank you" to end the call
3. **Check Console Logs**: 
   - Open browser dev tools
   - Watch for webhook events and processing steps
4. **Voice Cloning**: The app will automatically clone your voice
5. **Future Self Creation**: A personalized assistant will be created

## Understanding the Code

### Key Files Created:

- **`src/app/components/VoiceCounselor.tsx`**: Main UI component with Vapi integration
- **`src/app/api/vapi/webhook/route.ts`**: Main webhook handler for Vapi events
- **`src/app/api/playht/clone-voice-realtime/route.ts`**: Voice cloning with PlayHT
- **`src/app/lib/audioCapture.ts`**: Real-time audio capture and processing
- **`src/app/lib/vapiHelpers.ts`**: Assistant creation and prompt building
- **`src/app/types/index.ts`**: TypeScript interfaces

### The Magic Flow:

1. **Initial Call**: User calls your Vapi phone number
2. **Counseling Session**: AI counselor asks about problems and provides guidance
3. **Voice Cloning**: Audio is sent to PlayHT for instant cloning
4. **Future Self**: Creates assistant with cloned voice and conversation context
5. **Callback**: Calls user back as their "future self" with personalized advice

## Troubleshooting

### Common Issues:

**"Failed to start call" Error**
- Check microphone permissions in browser
- Verify `NEXT_PUBLIC_VAPI_PUBLIC_KEY` is correct
- Ensure you're on HTTPS in production

**Webhook Not Receiving Events**
- Verify webhook URL is accessible from internet
- Check VAPI_WEBHOOK_SECRET is set correctly
- Ensure webhook endpoint returns 200 status

**Voice Cloning Fails**
- Verify PlayHT API keys are correct
- Ensure audio quality is sufficient (minimum 2 seconds, maximum 1 hour)
- Check audio format compatibility

**Future Self Not Calling Back**
- Check assistant creation logs
- Verify voice clone completed successfully
- Ensure phone number format is correct

**Environment Variables Not Loading**
- Make sure file is named `.env.local` exactly
- Restart the development server after adding env vars
- Check for typos in variable names

### Debug Mode

Add this to your `.env.local` for more detailed logging:
```bash
NODE_ENV=development
DEBUG=true
```

## Production Deployment

### Vercel Deployment:
1. Push your code to GitHub
2. Connect to Vercel
3. Add all environment variables in Vercel dashboard
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain
5. Update Vapi webhook URL to your production domain

### Additional Production Considerations:
- Set up Redis for session storage (currently using in-memory)
- Implement phone number collection for real callbacks
- Add error monitoring (Sentry, etc.)
- Set up voice clone cleanup scheduling
- Add rate limiting for API endpoints

## Need Help?

- Check the main README.md for detailed documentation
- Review Vapi documentation: [docs.vapi.ai](https://docs.vapi.ai)
- Review PlayHT documentation: [docs.play.ht](https://docs.play.ht)
- Open an issue on GitHub if you get stuck

---

You've built something truly magical! 🎭✨ 

Users can now talk to an AI counselor and receive wisdom from their future selves. The voice cloning technology makes this experience incredibly personal and moving. 