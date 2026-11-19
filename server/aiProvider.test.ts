import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithAi, readAiConfig } from './aiProvider.ts';

test('readAiConfig menonaktifkan AI secara default', async () => {
  assert.equal(readAiConfig({}), null);
});

test('readAiConfig memilih OpenRouter dengan model gratis default', async () => {
  assert.deepEqual(readAiConfig({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key' }), {
    provider: 'openrouter',
    model: 'openrouter/free',
    apiKey: 'test-key',
    timeoutMs: 30_000,
  });
});

test('readAiConfig menolak model OpenRouter berbayar sebelum fetch', async () => {
  const env = { AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'vendor/paid' };
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    throw new Error('Jaringan tidak boleh dipanggil.');
  };
  assert.throws(() => readAiConfig(env), /gratis|:free/i);
  await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /gratis|:free/i);
  assert.equal(calls, 0);
});

test('readAiConfig mewajibkan kunci OpenRouter sebelum fetch', async () => {
  const env = { AI_PROVIDER: 'openrouter' };
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  assert.throws(() => readAiConfig(env), /OPENROUTER_API_KEY/);
  await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /OPENROUTER_API_KEY/);
  assert.equal(calls, 0);
});

test('OpenRouter mengirim satu permintaan gratis tanpa fitur berbiaya', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init?.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' });
    assert.deepEqual(JSON.parse(String(init?.body)), {
      model: 'openrouter/free',
      messages: [{ role: 'user', content: 'Audit situs' }],
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json({ choices: [{ message: { content: '```json\n{"score":80}\n```' }, finish_reason: 'stop' }] });
  };
  assert.deepEqual(await analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key',
  }, fetcher), { provider: 'openrouter', model: 'openrouter/free', parsed: { score: 80 } });
  assert.equal(calls, 1);
});

test('readAiConfig menolak provider tidak dikenal sebelum fetch', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  assert.throws(() => readAiConfig({ AI_PROVIDER: 'paid-vendor' }), /AI_PROVIDER/);
  await assert.rejects(analyzeWithAi('Audit situs', { AI_PROVIDER: 'paid-vendor' }, fetcher), /AI_PROVIDER/);
  assert.equal(calls, 0);
});

test('readAiConfig memilih Gemini hanya dengan model eksplisit', async () => {
  const env = Object.freeze({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model' });
  assert.deepEqual(readAiConfig(env), {
    provider: 'gemini', model: 'gemini-test-model', apiKey: 'test-gemini', timeoutMs: 30_000,
  });
  assert.equal(env.GEMINI_MODEL, 'gemini-test-model');
});

test('Gemini tanpa model eksplisit ditolak sebelum fetch', async () => {
  const env = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini' };
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  assert.throws(() => readAiConfig(env), /GEMINI_MODEL/);
  await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /GEMINI_MODEL/);
  assert.equal(calls, 0);
});

test('Gemini tanpa kunci ditolak sebelum fetch', async () => {
  const env = { AI_PROVIDER: 'gemini', GEMINI_MODEL: 'gemini-test-model' };
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  assert.throws(() => readAiConfig(env), /GEMINI_API_KEY/);
  await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /GEMINI_API_KEY/);
  assert.equal(calls, 0);
});

test('Gemini memakai generateContent tanpa search atau tools berbiaya', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init?.headers, { 'Content-Type': 'application/json', 'x-goog-api-key': 'test-gemini' });
    assert.deepEqual(JSON.parse(String(init?.body)), {
      contents: [{ role: 'user', parts: [{ text: 'Audit situs' }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 3000 },
    });
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"score":' }, { text: '90}' }] }, finishReason: 'STOP' }] });
  };
  assert.deepEqual(await analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
  }, fetcher), { provider: 'gemini', model: 'gemini-test-model', parsed: { score: 90 } });
  assert.equal(calls, 1);
});

test('OpenRouter menolak kegagalan HTTP tanpa retry atau fallback', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json({ choices: [{ message: { content: '{"score":99}' } }] }, { status: 429 });
  };
  await assert.rejects(analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-other', GEMINI_MODEL: 'other-model',
  }, fetcher), /OpenRouter.*HTTP 429/i);
  assert.equal(calls, 1);
});

test('Gemini menolak kegagalan HTTP tanpa retry atau fallback', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"score":99}' }] } }] }, { status: 403 });
  };
  await assert.rejects(analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model', OPENROUTER_API_KEY: 'test-other',
  }, fetcher), /Gemini.*HTTP 403/i);
  assert.equal(calls, 1);
});

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} menolak error provider dalam HTTP 200`, async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return Response.json({
        error: { message: 'Pesan eksternal tidak boleh dibocorkan: test-key', code: 402 },
        choices: [{ message: { content: '{"score":99}' } }],
        candidates: [{ content: { parts: [{ text: '{"score":99}' }] } }],
      });
    };
    await assert.rejects(analyzeWithAi('Audit situs', {
      AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
    }, fetcher), (error: Error) => {
      assert.match(error.message, /respons.*error/i);
      assert.equal(error.message.includes('test-key'), false);
      return true;
    });
    assert.equal(calls, 1);
  });
}

test('OpenRouter menolak keluaran terpotong meskipun mengandung JSON valid', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"score":99}' } }] });
  };
  await assert.rejects(analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key',
  }, fetcher), /OpenRouter.*tidak selesai/i);
  assert.equal(calls, 1);
});

test('Gemini menolak keluaran terpotong meskipun mengandung JSON valid', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"score":99}' }] } }] });
  };
  await assert.rejects(analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
  }, fetcher), /Gemini.*tidak selesai/i);
  assert.equal(calls, 1);
});

test('readAiConfig membatasi timeout kustom paling lama 40 detik', async () => {
  for (const provider of ['openrouter', 'gemini']) {
    const env = { AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model' };
    assert.equal(readAiConfig({ ...env, AI_TIMEOUT_MS: '1234' })?.timeoutMs, 1234);
    assert.equal(readAiConfig({ ...env, AI_TIMEOUT_MS: '90000' })?.timeoutMs, 40_000);
  }
});

test('readAiConfig menolak timeout tidak valid sebelum fetch', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  for (const value of ['0', '-1', 'NaN', 'Infinity', 'abc', '1.5']) {
    const env = { AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key', AI_TIMEOUT_MS: value };
    assert.throws(() => readAiConfig(env), /AI_TIMEOUT_MS/);
    await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /AI_TIMEOUT_MS/);
  }
  assert.equal(calls, 0);
});

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} menolak envelope respons tidak valid dengan pesan Indonesia`, async () => {
    for (const payload of [null, [], {}, { choices: [], candidates: [] }]) {
      let calls = 0;
      const fetcher: typeof fetch = async () => { calls += 1; return Response.json(payload); };
      await assert.rejects(analyzeWithAi('Audit situs', {
        AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
      }, fetcher), /respons.*tidak valid/i);
      assert.equal(calls, 1);
    }
  });
}

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} menolak konten respons tidak valid tanpa TypeError mentah`, async () => {
    for (const content of [null, {}, [], { parts: null }, { parts: [{ text: 42 }] }]) {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return Response.json({ choices: [{ message: { content } }], candidates: [{ content }] });
      };
      await assert.rejects(analyzeWithAi('Audit situs', {
        AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
      }, fetcher), /respons.*tidak valid/i);
      assert.equal(calls, 1);
    }
  });
}

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} menyamarkan kegagalan jaringan tanpa retry`, async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Rahasia test-key'); };
    await assert.rejects(analyzeWithAi('Audit situs', {
      AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
    }, fetcher), (error: Error) => {
      assert.match(error.message, /permintaan.*gagal/i);
      assert.equal(error.message.includes('test-key'), false);
      return true;
    });
    assert.equal(calls, 1);
  });
}

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} menolak JSON envelope rusak dengan pesan Indonesia`, async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls += 1; return new Response('Rahasia test-key bukan JSON'); };
    await assert.rejects(analyzeWithAi('Audit situs', {
      AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
    }, fetcher), (error: Error) => {
      assert.match(error.message, /respons.*JSON.*tidak valid/i);
      assert.equal(error.message.includes('test-key'), false);
      return true;
    });
    assert.equal(calls, 1);
  });
}

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} timeout membatalkan satu permintaan tanpa fallback`, async () => {
    let calls = 0;
    let signal: AbortSignal | null = null;
    const fetcher: typeof fetch = async (_url, init) => {
      calls += 1;
      signal = init?.signal ?? null;
      assert.ok(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
      });
    };
    const keepAlive = setTimeout(() => {}, 2000);
    try {
      await assert.rejects(analyzeWithAi('Audit situs', {
        AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model', AI_TIMEOUT_MS: '5',
      }, fetcher), /batas waktu/i);
      assert.equal((signal as AbortSignal | null)?.aborted, true);
      assert.equal(calls, 1);
    } finally {
      clearTimeout(keepAlive);
    }
  });
}

test('Gemini menolak prompt yang diblokir walaupun ada konten JSON', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [{ content: { parts: [{ text: '{"score":99}' }] } }] });
  };
  await assert.rejects(analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
  }, fetcher), /Gemini.*diblokir/i);
  assert.equal(calls, 1);
});

test('OpenRouter menolak error per-choice walaupun ada konten JSON', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json({ choices: [{ error: { code: 500 }, message: { content: '{"score":99}' } }] });
  };
  await assert.rejects(analyzeWithAi('Audit situs', {
    AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key',
  }, fetcher), /OpenRouter.*error/i);
  assert.equal(calls, 1);
});

test('OpenRouter menerima slug berakhiran :free tanpa fallback model', async () => {
  const env = Object.freeze({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'vendor/model:free' });
  const snapshot = { ...env };
  assert.equal(readAiConfig(env)?.model, 'vendor/model:free');
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'vendor/model:free');
    assert.equal(body.models, undefined);
    assert.equal(body.plugins, undefined);
    assert.equal(body.tools, undefined);
    return Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] });
  };
  assert.deepEqual(await analyzeWithAi('Audit situs', env, fetcher), {
    provider: 'openrouter', model: 'vendor/model:free', parsed: { ok: true },
  });
  assert.equal(calls, 1);
  assert.deepEqual(env, snapshot);
});

test('OpenRouter menolak slug yang menyamarkan model berbayar', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  for (const model of ['vendor/paid', 'openrouter/auto', 'vendor/model:free:online', 'vendor/model:FREE', 'vendor/model:free,other/paid', 'vendor/model:free?model=paid', 'vendor/model:free\n']) {
    const env = { AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: model };
    assert.throws(() => readAiConfig(env), /gratis|:free/i);
    await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /gratis|:free/i);
  }
  assert.equal(calls, 0);
});

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} menolak keluaran bukan objek JSON tanpa membocorkan teks`, async () => {
    for (const text of ['', 'tidak ada JSON', '[]', 'null', '{"rahasia":"test-key", invalid}']) {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        return Response.json({ choices: [{ message: { content: text } }], candidates: [{ content: { parts: [{ text }] } }] });
      };
      await assert.rejects(analyzeWithAi('Audit situs', {
        AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
      }, fetcher), (error: Error) => {
        assert.match(error.message, /hasil.*objek JSON.*valid/i);
        assert.equal(error.message.includes('test-key'), false);
        return true;
      });
      assert.equal(calls, 1);
    }
  });
}

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} timeout tetap aktif saat membaca body respons`, async () => {
    let calls = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      calls += 1;
      const signal = init!.signal!;
      return new Response(new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
      }));
    };
    const keepAlive = setTimeout(() => {}, 2000);
    try {
      await assert.rejects(analyzeWithAi('Audit situs', {
        AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model', AI_TIMEOUT_MS: '5',
      }, fetcher), /batas waktu/i);
      assert.equal(calls, 1);
    } finally {
      clearTimeout(keepAlive);
    }
  });
}

for (const provider of ['openrouter', 'gemini'] as const) {
  test(`${provider} melarang redirect agar tidak ada permintaan lanjutan`, async () => {
    let calls = 0;
    let redirect: RequestRedirect | undefined;
    const fetcher: typeof fetch = async (_url, init) => {
      calls += 1;
      redirect = init?.redirect;
      return Response.json({ choices: [{ message: { content: '{"ok":true}' } }], candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    };
    await analyzeWithAi('Audit situs', {
      AI_PROVIDER: provider, OPENROUTER_API_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'gemini-test-model',
    }, fetcher);
    assert.equal(redirect, 'error');
    assert.equal(calls, 1);
  });
}

test('readAiConfig bersifat murni terhadap env beku', () => {
  const env = Object.freeze({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key' });
  const first = readAiConfig(env)!;
  first.model = 'mutasi-pemanggil';
  const second = readAiConfig(env)!;
  assert.equal(second.model, 'openrouter/free');
  assert.notEqual(first, second);
  assert.deepEqual(env, { AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-key' });
});

test('konfigurasi none mengabaikan kunci dan model provider lain', async () => {
  const env = { AI_PROVIDER: 'none', OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'vendor/paid', GEMINI_API_KEY: 'test-gemini', AI_TIMEOUT_MS: 'invalid' };
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  assert.equal(readAiConfig(env), null);
  assert.equal(await analyzeWithAi('Audit situs', env, fetcher), null);
  assert.equal(calls, 0);
});

test('kunci kosong ditolak untuk setiap provider', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; throw new Error('Tidak boleh fetch.'); };
  for (const provider of ['openrouter', 'gemini']) {
    const env = { AI_PROVIDER: provider, OPENROUTER_API_KEY: '   ', GEMINI_API_KEY: '   ', GEMINI_MODEL: 'gemini-test-model' };
    assert.throws(() => readAiConfig(env), /API_KEY/);
    await assert.rejects(analyzeWithAi('Audit situs', env, fetcher), /API_KEY/);
  }
  assert.equal(calls, 0);
});

test('analyzeWithAi mode none tidak mengirim permintaan', async () => {
  assert.equal(typeof analyzeWithAi, 'function', 'analyzeWithAi belum tersedia.');
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    throw new Error('Jaringan tidak boleh dipanggil.');
  };
  assert.equal(await analyzeWithAi('Audit situs', {}, fetcher), null);
  assert.equal(await analyzeWithAi('Audit situs', { AI_PROVIDER: 'none' }, fetcher), null);
  assert.equal(calls, 0);
});
