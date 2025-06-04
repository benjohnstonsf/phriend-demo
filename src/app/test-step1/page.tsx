'use client';

import { useState } from 'react';

export default function TestStep1() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const updateAssistant = async () => {
    if (!webhookUrl) {
      alert('Please enter your ngrok webhook URL');
      return;
    }

    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const response = await fetch('/api/vapi/setup-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });

      const result = await response.json();
      
      if (response.ok) {
        setUpdateResult('✅ Assistant updated successfully! Monitor plan enabled.');
      } else {
        setUpdateResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setUpdateResult(`❌ Network error: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🎯 Step 1 Test: Webhook Setup</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">📋 Setup Options</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Development Setup */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold text-blue-600 mb-3">🛠️ Development (Recommended)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                <span><code className="bg-gray-100 px-1 rounded">npm run dev</code></span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span><code className="bg-gray-100 px-1 rounded">npx ngrok http 3000</code></span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Use ngrok URL below</span>
              </div>
            </div>
          </div>

          {/* Production Setup */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold text-green-600 mb-3">🚀 Production</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                <span>Deploy to Vercel/Netlify</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span>Use: <code className="bg-gray-100 px-1 rounded">https://yourapp.vercel.app/api/vapi/webhook</code></span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Set VAPI_API_KEY in env vars</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm">
            <strong>💡 Tip:</strong> If you don&apos;t have ngrok, try alternatives like 
            <a href="https://localtunnel.github.io/www/" className="text-blue-600 hover:underline ml-1">LocalTunnel</a> or 
            <a href="https://github.com/webhookrelay/webhookrelay-cli" className="text-blue-600 hover:underline ml-1">Webhook Relay</a>
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">🔧 Assistant Configuration</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Ngrok Webhook URL
          </label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://abc123.ngrok.io/api/vapi/webhook"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-600 mt-1">
            Enter your ngrok URL + /api/vapi/webhook
          </p>
        </div>

        <button
          onClick={updateAssistant}
          disabled={isUpdating || !webhookUrl}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isUpdating ? '⏳ Updating...' : '🚀 Update Assistant'}
        </button>

        {updateResult && (
          <div className={`mt-4 p-3 rounded-lg ${
            updateResult.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {updateResult}
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">🧪 Testing Instructions</h2>
        <div className="space-y-3">
          <p><strong>1. Watch Your Console:</strong> Open your terminal where Next.js is running</p>
          <p><strong>2. Make a Test Call:</strong> Use your React Native app to start a call</p>
          <p><strong>3. Look for These Logs:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
            <li><code>🎯 Vapi Webhook Event: &#123; type: &apos;call-started&apos; &#125;</code></li>
            <li><code>🟢 Call started!</code></li>
            <li><code>🎧 Monitor URLs available: &#123; listenUrl: &apos;wss://...&apos;, controlUrl: &apos;https://...&apos; &#125;</code></li>
            <li><code>📝 Transcript event: &#123; role: &apos;user&apos;, text: &apos;...&apos; &#125;</code></li>
            <li><code>🎤 Speech update: &#123; role: &apos;user&apos;, status: &apos;started&apos; &#125;</code></li>
          </ul>
          <p><strong>4. Most Important:</strong> Verify you see the Monitor URLs in the call-started event!</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">⚠️ Troubleshooting</h2>
        <div className="space-y-2 text-sm">
          <p><strong>No webhooks received?</strong> Check that your ngrok URL is correct and accessible</p>
          <p><strong>No monitor URLs?</strong> Ensure monitorPlan is enabled (this tool does it automatically)</p>
          <p><strong>404 errors?</strong> Make sure the webhook URL ends with <code>/api/vapi/webhook</code></p>
          <p><strong>500 errors?</strong> Check that VAPI_API_KEY is set in your environment variables</p>
        </div>
      </div>
    </div>
  );
} 