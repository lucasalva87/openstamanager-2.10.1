#!/usr/bin/env node
/**
 * MCP Server Test Script
 *
 * This script tests the MCP server by spawning it as a child process
 * and communicating via the JSON-RPC 2.0 protocol over stdio.
 *
 * Usage:
 *   node test-mcp.js [tests...]
 *
 * Available tests (run all if none specified):
 *   list      - list_anagrafiche (page 0)
 *   filter    - list_anagrafiche with filter_tipo=Cliente
 *   get       - get_anagrafica (uses first ID from list)
 *   crud      - create + update + delete (full CRUD cycle)
 *   create    - create_anagrafica only
 *   update    - update_anagrafica only (requires --id=<ID>)
 *   delete    - delete_anagrafica only (requires --id=<ID>)
 *
 * Examples:
 *   node test-mcp.js                    # run all tests
 *   node test-mcp.js list               # only list_anagrafiche
 *   node test-mcp.js list filter        # list + filter
 *   node test-mcp.js get                # only get_anagrafica
 *   node test-mcp.js crud               # full CRUD cycle
 *   node test-mcp.js create             # only create
 *   node test-mcp.js update --id=42     # only update record 42
 *   node test-mcp.js delete --id=42     # only delete record 42
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

// ─── Load .env file ───────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ─── Configuration ────────────────────────────────────────────────────────────

const SERVER_PATH = path.join(__dirname, 'dist', 'index.js');
const OSM_BASE_URL = process.env.OSM_BASE_URL || 'http://localhost/openstamanager';
const OSM_API_TOKEN = process.env.OSM_API_TOKEN || '';

// ─── Parse CLI arguments ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
const testNames = [];

for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    flags[key] = value !== undefined ? value : true;
  } else {
    testNames.push(arg.toLowerCase());
  }
}

// If no test names given, run all
const runAll = testNames.length === 0;
const shouldRun = (name) => runAll || testNames.includes(name);

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

let requestId = 1;

function makeRequest(method, params = {}) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params,
  });
}

function makeNotification(method, params = {}) {
  return JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
  });
}

// ─── Test runner ──────────────────────────────────────────────────────────────

async function runTests() {
  console.log('=== MCP OpenSTAManager Server Test ===\n');
  console.log(`Server: ${SERVER_PATH}`);
  console.log(`OSM_BASE_URL: ${OSM_BASE_URL}`);
  console.log(`OSM_API_TOKEN: ${OSM_API_TOKEN ? '***' + OSM_API_TOKEN.slice(-4) : '(not set)'}`);
  if (testNames.length > 0) {
    console.log(`Running tests: ${testNames.join(', ')}`);
  } else {
    console.log('Running: all tests');
  }
  console.log('');

  // Spawn the MCP server
  const server = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      OSM_BASE_URL,
      OSM_API_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Collect stderr (server logs)
  server.stderr.on('data', (data) => {
    process.stderr.write(`[server] ${data}`);
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });

  server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\nServer exited with code ${code}`);
    }
  });

  // Set up line-by-line reading of server stdout
  const rl = readline.createInterface({ input: server.stdout });
  const pendingResponses = new Map();

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pendingResponses.has(msg.id)) {
        const { resolve, reject } = pendingResponses.get(msg.id);
        pendingResponses.delete(msg.id);
        if (msg.error) {
          reject(new Error(`RPC error ${msg.error.code}: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  });

  // Send a request and wait for response
  function sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = requestId;
      const msg = makeRequest(method, params);
      pendingResponses.set(id, { resolve, reject });
      server.stdin.write(msg + '\n');

      // Timeout after 10 seconds
      setTimeout(() => {
        if (pendingResponses.has(id)) {
          pendingResponses.delete(id);
          reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
        }
      }, 10000);
    });
  }

  // Send a notification (no response expected)
  function sendNotification(method, params = {}) {
    server.stdin.write(makeNotification(method, params) + '\n');
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function ok(msg) {
    console.log(`   ✓ ${msg}`);
    passed++;
  }

  function fail(msg) {
    console.log(`   ✗ ${msg}`);
    failed++;
  }

  function skip(msg) {
    console.log(`   - ${msg} (skipped)`);
    skipped++;
  }

  // Helper: call a tool and return parsed JSON result, or null on error
  async function callTool(name, args) {
    const result = await sendRequest('tools/call', { name, arguments: args });
    if (result.isError) {
      return { error: result.content?.[0]?.text };
    }
    try {
      return { data: JSON.parse(result.content?.[0]?.text || '{}') };
    } catch {
      return { error: `Could not parse response: ${result.content?.[0]?.text}` };
    }
  }

  try {
    // ── Initialize (always required) ────────────────────────────────────────
    console.log('Initializing MCP connection...');
    const initResult = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    ok(`Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}`);
    ok(`Protocol: ${initResult.protocolVersion}`);
    sendNotification('notifications/initialized');
    console.log('');

    // ── List tools (always) ─────────────────────────────────────────────────
    console.log('Listing available tools...');
    const toolsResult = await sendRequest('tools/list');
    const tools = toolsResult.tools || [];
    ok(`Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
    console.log('');

    // ── Test: list ──────────────────────────────────────────────────────────
    let firstId = null;
    if (shouldRun('list')) {
      console.log('TEST: list_anagrafiche (page 0)');
      const { data, error } = await callTool('list_anagrafiche', { page: 0 });
      if (error) {
        fail(`list_anagrafiche: ${error}`);
      } else {
        ok(`Total records: ${data.total_count}, pages: ${data.total_pages}`);
        ok(`Records on page: ${data.anagrafiche?.length || 0}`);
        if (data.anagrafiche?.length > 0) {
          firstId = data.anagrafiche[0].idanagrafica;
          ok(`First: ${data.anagrafiche[0].ragione_sociale} (ID: ${firstId})`);
        }
      }
      console.log('');
    }

    // ── Test: filter ────────────────────────────────────────────────────────
    if (shouldRun('filter')) {
      console.log('TEST: list_anagrafiche with filter_tipo=Cliente');
      const { data, error } = await callTool('list_anagrafiche', { page: 0, filter_tipo: 'Cliente' });
      if (error) {
        fail(`list_anagrafiche (filter): ${error}`);
      } else {
        ok(`Clienti found: ${data.total_count}`);
      }
      console.log('');
    }

    // ── Test: get ───────────────────────────────────────────────────────────
    if (shouldRun('get')) {
      const targetId = flags.id ? parseInt(flags.id) : firstId;
      if (targetId !== null && targetId !== undefined) {
        console.log(`TEST: get_anagrafica (id=${targetId})`);
        const { data, error } = await callTool('get_anagrafica', { id: targetId });
        if (error) {
          fail(`get_anagrafica: ${error}`);
        } else {
          ok(`Found: ${data.ragione_sociale} (ID: ${data.idanagrafica})`);
          ok(`City: ${data.citta || '(empty)'}, Email: ${data.email || '(empty)'}`);
        }
      } else {
        skip('get_anagrafica (no ID available — run "list" first or pass --id=<ID>)');
      }
      console.log('');
    }

    // ── Test: create ────────────────────────────────────────────────────────
    let createdId = null;
    if (shouldRun('create') || shouldRun('crud')) {
      console.log('TEST: create_anagrafica');
      const { data, error } = await callTool('create_anagrafica', {
        ragione_sociale: 'Test MCP Cliente',
        tipi: [1],
        email: 'test-mcp@example.com',
        telefono: '0123456789',
        citta: 'Milano',
        provincia: 'MI',
      });
      if (error) {
        fail(`create_anagrafica: ${error}`);
      } else {
        createdId = data.id;
        ok(`Created with ID: ${createdId}`);
      }
      console.log('');
    }

    // ── Test: update ────────────────────────────────────────────────────────
    if (shouldRun('update') || shouldRun('crud')) {
      const targetId = flags.id ? parseInt(flags.id) : createdId;
      if (targetId !== null && targetId !== undefined) {
        console.log(`TEST: update_anagrafica (id=${targetId})`);
        const { data, error } = await callTool('update_anagrafica', {
          id: targetId,
          telefono: '9876543210',
          citta: 'Roma',
          provincia: 'RM',
        });
        if (error) {
          fail(`update_anagrafica: ${error}`);
        } else {
          ok(`Updated ID: ${data.id}`);
        }
      } else {
        skip('update_anagrafica (no ID available — run "create" first or pass --id=<ID>)');
      }
      console.log('');
    }

    // ── Test: delete ────────────────────────────────────────────────────────
    if (shouldRun('delete') || shouldRun('crud')) {
      const targetId = flags.id ? parseInt(flags.id) : createdId;
      if (targetId !== null && targetId !== undefined) {
        console.log(`TEST: delete_anagrafica (id=${targetId})`);
        const { data, error } = await callTool('delete_anagrafica', { id: targetId });
        if (error) {
          fail(`delete_anagrafica: ${error}`);
        } else {
          ok(`Deleted ID: ${data.id}`);
        }
      } else {
        skip('delete_anagrafica (no ID available — run "create" first or pass --id=<ID>)');
      }
      console.log('');
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('=== Test Summary ===');
    console.log(`   ✓ Passed:  ${passed}`);
    console.log(`   ✗ Failed:  ${failed}`);
    if (skipped > 0) console.log(`   - Skipped: ${skipped}`);
    console.log('=== Done ===');

  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
  } finally {
    server.stdin.end();
    server.kill();
  }
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
