#!/usr/bin/env node
// MCP server (stdio, newline-delimited JSON-RPC). Zero dependencies.
import { TOOLS, runTool } from './lib/tools.mjs';

const SERVER = { name: 'qiaomu-codex-imagegen', version: '0.3.0' };
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk; const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    if (method === 'initialize') send({ id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: SERVER } });
    else if (method === 'ping') send({ id, result: {} });
    else if (method === 'tools/list') send({ id, result: { tools: TOOLS } });
    else if (method === 'tools/call') {
      const token = params?._meta?.progressToken; let step = 0;
      const progress = token === undefined ? undefined : message => send({ method: 'notifications/progress', params: { progressToken: token, progress: ++step, message } });
      void runTool(params?.name, params?.arguments || {}, progress).then(result => send({ id, result }));
    } else if (id !== undefined) send({ id, error: { code: -32601, message: `method not found: ${method}` } });
  }
});
process.stdin.on('end', () => process.exit(0));
console.error('[qiaomu-codex-imagegen] ready');
