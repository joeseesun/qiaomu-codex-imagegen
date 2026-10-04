#!/usr/bin/env node
// Stand-in for `codex app-server`: answers the JSON-RPC calls and "generates" a 2×1 PNG.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const out = o => process.stdout.write(JSON.stringify(o) + '\n');
let n = 0, buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk; const lines = buffer.split('\n'); buffer = lines.pop();
  for (const line of lines.filter(Boolean)) {
    const m = JSON.parse(line);
    if (m.method === 'initialize') out({ id: m.id, result: {} });
    else if (m.method === 'thread/start') out({ id: m.id, result: { thread: { id: 't1' } } });
    else if (m.method === 'turn/start') {
      out({ id: m.id, result: { turn: { id: 'u1' } } });
      if (process.env.FAKE_CODEX_MODE === 'noimage') { out({ method: 'item/completed', params: { item: { type: 'agentMessage', text: 'I cannot draw that.' } } }); out({ method: 'turn/completed', params: { turn: { status: 'completed' } } }); return; }
      const saved = join(tmpdir(), `fake-codex-${process.pid}-${++n}.png`); writeFileSync(saved, PNG);
      const input = JSON.stringify(m.params.input);
      out({ method: 'item/started', params: { item: { type: 'imageGeneration', id: 'i1' } } });
      out({ method: 'item/completed', params: { item: { type: 'imageGeneration', id: 'i1', status: 'completed', result: '', savedPath: saved, revisedPrompt: 'REVISED:' + input.length } } });
      out({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
    }
  }
});
