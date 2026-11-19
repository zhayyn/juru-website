# Juru Website — restricted HTTPS pilot

Server-measured website audit for prakom; React, TypeScript and Express. This deployment branch contains application source and tests only. Private evidence, local paths and credentials are excluded.

Deploy the `render.yaml` Blueprint as one Free Node Web Service. Keep workspace build/bandwidth spend limits at zero and do not add payment details or paid resources. Render generates the pilot invitation; browser username is `prakom`. Retrieve the password only in Render Environment and distribute privately. Do not place it in source, a URL, a screenshot or logs.

The service requires its Render-assigned hostname before startup. Only example.com, pa-semarang.go.id and www.pa-semarang.go.id are initially accepted audit targets. Add other domains only with operator approval. HTTPS is provided by Render; external HTTP must redirect to HTTPS.

AI and cloud ranking writes remain disabled. Ranking and history are session-only. Missing PageSpeed metrics stay null; the service does not invent scores. A Google PageSpeed key may be added as the server-only `PAGESPEED_API_KEY` after its project and API restrictions are approved. A key does not guarantee quota.

For local development: `npm ci`, `npm run dev`; use Node 22.23.5 or another Vite-compatible runtime. Never expose the development server. Run `npm run lint`, `npm test`, `node --test scripts/pilot-deployment.test.mjs`, `npm run build` and `npm run test:build` before a manual deployment. Build dependencies are pruned only on the disposable hosting copy.

Free hosting can sleep and has ephemeral storage. This is a limited pilot, not an SLA, official ranking, compliance certification or a security audit.
