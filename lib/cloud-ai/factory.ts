// lib/cloud-ai/factory.ts
import { STTProvider, AIProviderType } from './types';
import { HuggingFaceProvider } from './huggingface';
import { AssemblyAIProvider } from './assemblyai';
import { DeepgramProvider } from './deepgram';
import { OpenAIProvider } from './openai';

// Checks if a token is a real value or a placeholder
function isPlaceholder(token: string | undefined, prefix = ''): boolean {
  if (!token) return true;
  const t = token.trim().toLowerCase();
  if (t === '' || t.startsWith('xxx') || t.startsWith('your_') || t.startsWith('your-') || t.includes('_here') || t.includes('placeholder')) return true;
  if (token === `${prefix}xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) return true;
  if (token === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx') return true;
  return false;
}

export type ProviderStatus = {
  id: AIProviderType;
  name: string;
  configured: boolean;
  description: string;
  freeInfo: string;
  signupUrl: string;
  envKey: string;
};

/** Returns status of all providers without throwing */
export function getProviderStatuses(): ProviderStatus[] {
  return [
    {
      id: 'huggingface',
      name: 'Hugging Face (Whisper)',
      configured: !isPlaceholder(process.env.HUGGINGFACE_TOKEN),
      description: 'OpenAI Whisper via Hugging Face API. Best for Bengali & multilingual.',
      freeInfo: '100% Free',
      signupUrl: 'https://huggingface.co/settings/tokens',
      envKey: 'HUGGINGFACE_TOKEN',
    },
    {
      id: 'assemblyai',
      name: 'AssemblyAI',
      configured: !isPlaceholder(process.env.ASSEMBLYAI_KEY),
      description: 'High accuracy, speaker detection. Great for English/Hindi content.',
      freeInfo: '$5 Free credit',
      signupUrl: 'https://www.assemblyai.com/dashboard/signup',
      envKey: 'ASSEMBLYAI_KEY',
    },
    {
      id: 'deepgram',
      name: 'Deepgram Nova',
      configured: !isPlaceholder(process.env.DEEPGRAM_KEY),
      description: 'Real-time speed, $200 free credit. Best for long files.',
      freeInfo: '$200 Free credit',
      signupUrl: 'https://console.deepgram.com/signup',
      envKey: 'DEEPGRAM_KEY',
    },
    {
      id: 'openai',
      name: 'OpenAI Whisper-1',
      configured: !isPlaceholder(process.env.OPENAI_KEY),
      description: 'Official OpenAI Whisper API. Pay-per-use, very accurate.',
      freeInfo: 'Pay-as-you-go',
      signupUrl: 'https://platform.openai.com/api-keys',
      envKey: 'OPENAI_KEY',
    },
  ];
}

export function createSTTProvider(type: AIProviderType): STTProvider {
  const statuses = getProviderStatuses();
  const status = statuses.find((s) => s.id === type);

  if (!status) {
    throw new Error(`Unknown AI provider: "${type}". Choose from: huggingface, assemblyai, deepgram, openai`);
  }

  if (!status.configured) {
    throw new Error(
      `TOKEN_NOT_CONFIGURED:${type}:${status.name} API key is not set. Add your ${status.envKey} to the .env.local file. Get one free at ${status.signupUrl}`
    );
  }

  switch (type) {
    case 'huggingface':
      return new HuggingFaceProvider(process.env.HUGGINGFACE_TOKEN!);
    case 'assemblyai':
      return new AssemblyAIProvider(process.env.ASSEMBLYAI_KEY!);
    case 'deepgram':
      return new DeepgramProvider(process.env.DEEPGRAM_KEY!);
    case 'openai':
      return new OpenAIProvider(process.env.OPENAI_KEY!);
    default:
      throw new Error(`Unsupported provider: ${type}`);
  }
}

export function getDefaultProvider(): STTProvider {
  const provider = (process.env.AI_PROVIDER || 'huggingface') as AIProviderType;
  return createSTTProvider(provider);
}

export function getFallbackProvider(): STTProvider | null {
  try {
    const fallback = process.env.FALLBACK_PROVIDER as AIProviderType;
    if (fallback && fallback !== process.env.AI_PROVIDER) {
      return createSTTProvider(fallback);
    }
  } catch {
    // Fallback not available — silently skip
  }
  return null;
}