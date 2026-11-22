import { extractJsonFromGeminiText } from '../src/utils/auditLogic.ts';

export type AiAnalysis = {
  parsed: Record<string, unknown>;
  provider: 'gemini' | 'openrouter';
  model: string;
};

export type AiConfig = {
  provider: AiAnalysis['provider'];
  model: string;
  apiKey: string;
  timeoutMs: number;
};

/**
 * Membaca konfigurasi tanpa IO atau mutasi env. Jangan kirim AiConfig ke klien:
 * apiKey hanya untuk server. AI_PROVIDER=none (default) mengembalikan null.
 * AI_TIMEOUT_MS: default 30.000, maksimum 40.000, tanpa retry atau fallback.
 * Gemini memerlukan pilihan model dan kuota free-tier yang diverifikasi pemilik;
 * adapter tidak memeriksa status billing akun dan tidak mengaktifkan tools/search.
 */
export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig | null {
  const provider = env.AI_PROVIDER || 'none';
  if (provider === 'none') return null;
  const requestedTimeout = Number(env.AI_TIMEOUT_MS || 30_000);
  if (!Number.isSafeInteger(requestedTimeout) || requestedTimeout <= 0) {
    throw new Error('AI_TIMEOUT_MS harus bilangan bulat positif.');
  }
  const timeoutMs = Math.min(requestedTimeout, 40_000);
  if (provider !== 'openrouter' && provider !== 'gemini') {
    throw new Error('AI_PROVIDER harus none, openrouter, atau gemini.');
  }
  if (provider === 'openrouter') {
    const model = env.OPENROUTER_MODEL || 'openrouter/free';
    if (model !== 'openrouter/free' && !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*:free$/.test(model)) {
      throw new Error('OPENROUTER_MODEL wajib model gratis: openrouter/free atau akhiran :free.');
    }
    if (!env.OPENROUTER_API_KEY?.trim()) {
      throw new Error('OPENROUTER_API_KEY wajib diisi.');
    }
    return {
      provider: 'openrouter',
      model,
      apiKey: env.OPENROUTER_API_KEY || '',
      timeoutMs,
    };
  }
  if (!env.GEMINI_MODEL?.trim()) {
    throw new Error('GEMINI_MODEL wajib diisi secara eksplisit.');
  }
  if (!env.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY wajib diisi.');
  }
  return {
    provider: 'gemini',
    model: env.GEMINI_MODEL || '',
    apiKey: env.GEMINI_API_KEY || '',
    timeoutMs,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function fetchOnce(fetcher: typeof fetch, url: string, init: RequestInit, provider: string): Promise<Response> {
  try {
    return await fetcher(url, { ...init, redirect: 'error' });
  } catch {
    if (init.signal?.aborted) throw new Error(`Permintaan ${provider} melewati batas waktu.`);
    throw new Error(`Permintaan ${provider} gagal.`);
  }
}

async function readPayload(response: Response, provider: string, signal: AbortSignal): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (signal.aborted) throw new Error(`Permintaan ${provider} melewati batas waktu.`);
    throw new Error(`Respons ${provider} JSON tidak valid.`);
  }
}

function parseAnalysis(text: string): Record<string, unknown> {
  try {
    return extractJsonFromGeminiText(text);
  } catch {
    throw new Error('Hasil AI bukan objek JSON yang valid.');
  }
}

/** Hasil provider tetap data tidak tepercaya; validasi/sanitasi dilakukan pemanggil. */
export async function analyzeWithAi(
  prompt: string,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): Promise<AiAnalysis | null> {
  const config = readAiConfig(env);
  if (!config) return null;
  const signal = AbortSignal.timeout(config.timeoutMs);
  if (config.provider === 'gemini') {
    const response = await fetchOnce(fetcher, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 3000 },
      }),
      signal,
    }, 'Gemini');
    if (!response.ok) throw new Error(`Permintaan Gemini gagal (HTTP ${response.status}).`);
    const payload = await readPayload(response, 'Gemini', signal);
    if (!isRecord(payload)) throw new Error('Respons Gemini tidak valid.');
    if (payload.error) throw new Error('Respons Gemini berisi error provider.');
    if (isRecord(payload.promptFeedback) && payload.promptFeedback.blockReason) {
      throw new Error('Respons Gemini diblokir.');
    }
    if (!Array.isArray(payload.candidates) || !isRecord(payload.candidates[0])) {
      throw new Error('Respons Gemini tidak valid.');
    }
    if (payload.candidates[0].finishReason && payload.candidates[0].finishReason !== 'STOP') {
      throw new Error('Respons Gemini tidak selesai atau diblokir.');
    }
    const content = payload.candidates[0].content;
    if (!isRecord(content) || !Array.isArray(content.parts) ||
        !content.parts.every((part: unknown) => isRecord(part) && typeof part.text === 'string')) {
      throw new Error('Respons Gemini tidak valid.');
    }
    return {
      parsed: parseAnalysis(content.parts.map((part: { text: string }) => part.text).join('')),
      provider: config.provider,
      model: config.model,
    };
  }
  const response = await fetchOnce(fetcher, 'https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    }),
    signal,
  }, 'OpenRouter');
  if (!response.ok) throw new Error(`Permintaan OpenRouter gagal (HTTP ${response.status}).`);
  const payload = await readPayload(response, 'OpenRouter', signal);
  if (!isRecord(payload)) throw new Error('Respons OpenRouter tidak valid.');
  if (payload.error) throw new Error('Respons OpenRouter berisi error provider.');
  if (!Array.isArray(payload.choices) || !isRecord(payload.choices[0])) {
    throw new Error('Respons OpenRouter tidak valid.');
  }
  if (payload.choices[0].error) throw new Error('Respons OpenRouter berisi error provider.');
  if (payload.choices[0].finish_reason && payload.choices[0].finish_reason !== 'stop') {
    throw new Error('Respons OpenRouter tidak selesai atau diblokir.');
  }
  const message = payload.choices[0].message;
  if (!isRecord(message) || typeof message.content !== 'string') {
    throw new Error('Respons OpenRouter tidak valid.');
  }
  return {
    parsed: parseAnalysis(message.content),
    provider: config.provider,
    model: config.model,
  };
}
