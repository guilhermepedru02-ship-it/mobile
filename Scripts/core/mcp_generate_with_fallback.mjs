import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

function parseAvailableMemMb(freeOutput) {
  // free -m output: header then line like: Mem:  3770  2900  49  ...  available
  const lines = freeOutput.split('\n').map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    if (l.startsWith('Mem:') || l.startsWith('Mem')) {
      const parts = l.split(/\s+/);
      // try last column as available
      const availableStr = parts[parts.length - 1];
      const v = parseInt(availableStr.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(v)) return v; // MB
    }
  }
  return null;
}

async function main() {
  const transport = new SSEClientTransport(new URL('http://127.0.0.1:3001/sse'));
  const client = new Client({ name: 'vscode-mcp-gen-fallback', version: '0.1.0' });
  try {
    await client.connect(transport);

    // 1) check memory
    const memRes = await client.request({
      method: 'tools/call',
      params: {
        name: 'execute_workspace_action',
        arguments: { payload: { actions: [{ type: 'run_command', command: 'free -m' }] } }
      }
    }, (await import('@modelcontextprotocol/sdk/types.js')).CallToolResultSchema);

    const memRaw = (memRes && memRes.content && memRes.content[0] && (memRes.content[0].text || memRes.content[0].stdout)) ? (memRes.content[0].text || memRes.content[0].stdout) : '';
    let memJson = [];
    try { memJson = JSON.parse(memRaw); } catch (e) { /* not JSON, treat raw as stdout */ }
    const memOut = (memJson[0] && (memJson[0].stdout || memJson[0].content)) ? (memJson[0].stdout || memJson[0].content) : memRaw;
    const availMb = parseAvailableMemMb(memOut);

    const safeThresholdMb = 700; // if available < 700 MB, reduce tokens
    const maxTokens = (availMb === null || availMb < safeThresholdMb) ? 256 : 1024;

    // 2) try local Ollama generate
    const localCurl = `curl -s -S --max-time 55 -H "Content-Type: application/json" -X POST http://127.0.0.1:11434/v1/chat/completions -d '{"model":"qwen2.5-0.5b","messages":[{"role":"user","content":"[MCP TEST] Responda uma frase curta em portugues."}],"max_tokens":${maxTokens},"stream":false}' 2>&1 || true`;

    const genRes = await client.request({
      method: 'tools/call',
      params: {
        name: 'execute_workspace_action',
        arguments: { payload: { actions: [{ type: 'run_command', command: localCurl }] } }
      }
    }, (await import('@modelcontextprotocol/sdk/types.js')).CallToolResultSchema);

    const genRaw = (genRes && genRes.content && genRes.content[0] && (genRes.content[0].text || genRes.content[0].stdout)) ? (genRes.content[0].text || genRes.content[0].stdout) : '';
    let genJson = [];
    try { genJson = JSON.parse(genRaw); } catch (e) {}
    const genOut = (genJson[0] && genJson[0].stdout) ? genJson[0].stdout : genRaw;
    const genErr = (genJson[0] && genJson[0].stderr) ? genJson[0].stderr : '';

    // If output contains HTTP/1.1 200 or NDJSON tokens, consider success
    const successLocal = /"choices"|"content"/.test(genOut) || (genOut.length > 20 && genErr.length === 0);

    if (successLocal) {
      console.log(JSON.stringify({ ok: true, source: 'local', maxTokens, availableMb: availMb, output: genOut.substring(0, 2000) }));
      return;
    }

    // 3) Attempt CLAUDE fallback if env present on device
    const envCheck = await client.request({
      method: 'tools/call',
      params: {
        name: 'execute_workspace_action',
        arguments: { payload: { actions: [
          { type: 'run_command', command: 'echo $CLAUDE_API_URL || true' },
          { type: 'run_command', command: 'echo $CLAUDE_API_KEY || true' }
        ] } }
      }
    }, (await import('@modelcontextprotocol/sdk/types.js')).CallToolResultSchema);
    const envRaw = (envCheck && envCheck.content && envCheck.content[0] && envCheck.content[0].text) ? envCheck.content[0].text : '';
    let envJson = [];
    try { envJson = JSON.parse(envRaw); } catch (e) {}
    const claudeUrl = (envJson[0] && envJson[0].stdout) ? envJson[0].stdout.trim() : '';
    const claudeKey = (envJson[1] && envJson[1].stdout) ? envJson[1].stdout.trim() : '';

    if (claudeUrl && claudeKey) {
      // call Claude (simple POST JSON); caller must ensure endpoint format
      const claudeCmd = `curl -s -S --max-time 60 -H "Content-Type: application/json" -H "Authorization: Bearer ${claudeKey}" -X POST ${claudeUrl} -d '{"prompt":"[MCP TEST] Responda uma frase curta.","max_tokens":${maxTokens}}' 2>&1 || true`;
      const claudeRes = await client.request({
        method: 'tools/call',
        params: { name: 'execute_workspace_action', arguments: { payload: { actions: [{ type: 'run_command', command: claudeCmd }] } } }
      }, (await import('@modelcontextprotocol/sdk/types.js')).CallToolResultSchema);
      const claudeRaw = (claudeRes && claudeRes.content && claudeRes.content[0] && (claudeRes.content[0].text || claudeRes.content[0].stdout)) ? (claudeRes.content[0].text || claudeRes.content[0].stdout) : '';
      let claudeJson = [];
      try { claudeJson = JSON.parse(claudeRaw); } catch (e) {}
      const cOut = (claudeJson[0] && claudeJson[0].stdout) ? claudeJson[0].stdout : claudeRaw;
      console.log(JSON.stringify({ ok: true, source: 'claude', maxTokens, availableMb: availMb, output: cOut.substring(0,2000) }));
      return;
    }

    console.log(JSON.stringify({ ok: false, reason: 'local_failed_and_no_claude', maxTokens, availableMb, genOutSnippet: genOut.substring(0,500) }));

  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  } finally {
    await client.close();
    await transport.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
