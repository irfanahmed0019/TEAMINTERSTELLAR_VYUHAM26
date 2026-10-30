import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

const here = path.dirname(fileURLToPath(import.meta.url));
const modelPath = process.argv[2] || path.resolve(here, '../models/smollm2-135m-instruct.gguf');

await access(modelPath);
const llama = await getLlama({ gpu: false });
try {
  const model = await llama.loadModel({ modelPath });
  const context = await model.createContext({ contextSize: 512 });
  const session = new LlamaChatSession({ contextSequence: context.getSequence() });
  const response = await session.prompt('Reply with exactly: LOCAL_OK', { maxTokens: 16, temperature: 0 });
  if (!response.trim()) throw new Error('The model loaded but returned an empty response.');
  console.log(`Local inference succeeded: ${JSON.stringify(response)}`);
  session.dispose();
  await context.dispose();
  await model.dispose();
} finally {
  await llama.dispose();
}
