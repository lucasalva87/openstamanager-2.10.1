#!/usr/bin/env node
/**
 * MCP Server Test Script
 *
 * This script tests the MCP server by spawning it as a child process
 * and communicating via the JSON-RPC 2.0 protocol over stdio.
 *
 * Usage:
 *   1. Build the server first: npm run build
 *   2. Set environment variables (or create .env):
 *      OSM_BASE_URL=http://your-openstamanager-host/openstamanager
 *      OSM_API_TOKEN=your_api_token_here
 *   3. Run: node test-mcp.js
 *
 * The script will:
 *   - Initialize the MCP connection
 *   - List all available tools
 *   - Call list_anagrafiche (first page)
 *   - Call list_anagrafiche with filter_tipo=Cliente
 *   - Call get_anagrafica on the first record found
 *   - Full CRUD: create_anagrafica → update_anagrafica → delete_anagrafica
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// ─── Configuration ────────────────────────────────────────────────────────────

const SERVER_PATH = path.join(__dirname, 'dist', 'index.js');
const OSM_BASE_URL = process.env.OSM_BASE_URL || 'http://localhost/openstamanager';
const OSM_API_TOKEN = process.env.OSM_API_TOKEN || '';

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

  function ok(msg) {
    console.log(`   ✓ ${msg}`);
    passed++;
  }

  function fail(msg) {
    console.log(`   ✗ ${msg}`);
    failed++;
  }

  try {
    // ── Step 1: Initialize ──────────────────────────────────────────────────
    console.log('1. Initializing MCP connection...');
    const initResult = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    ok(`Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}`);
    ok(`Protocol: ${initResult.protocolVersion}`);

    // Send initialized notification
    sendNotification('notifications/initialized');
    console.log('');

    // ── Step 2: List tools ──────────────────────────────────────────────────
    console.log('2. Listing available tools...');
    const toolsResult = await sendRequest('tools/list');
    const tools = toolsResult.tools || [];
    ok(`Found ${tools.length} tools:`);
    for (const tool of tools) {
      console.log(`     - ${tool.name}: ${tool.description}`);
    }
    console.log('');

    // ── Step 3: list_anagrafiche (page 0) ───────────────────────────────────
    console.log('3. Calling list_anagrafiche (page 0)...');
    const listResult = await sendRequest('tools/call', {
      name: 'list_anagrafiche',
      arguments: { page: 0 },
    });

    let firstId = null;
    if (listResult.isError) {
      fail(`list_anagrafiche error: ${listResult.content?.[0]?.text}`);
    } else {
      const text = listResult.content?.[0]?.text || '{}';
      try {
        const data = JSON.parse(text);
        ok(`Total records: ${data.total_count}`);
        ok(`Total pages: ${data.total_pages}`);
        ok(`Records on this page: ${data.anagrafiche?.length || 0}`);
        if (data.anagrafiche?.length > 0) {
          firstId = data.anagrafiche[0].idanagrafica;
          ok(`First record: ${data.anagrafiche[0].ragione_sociale} (ID: ${firstId})`);
        }
      } catch {
        fail(`Could not parse response: ${text}`);
      }
    }
    console.log('');

    // ── Step 4: list_anagrafiche with filter_tipo ───────────────────────────
    console.log('4. Calling list_anagrafiche with filter_tipo=Cliente...');
    const listClientResult = await sendRequest('tools/call', {
      name: 'list_anagrafiche',
      arguments: { page: 0, filter_tipo: 'Cliente' },
    });

    if (listClientResult.isError) {
      fail(`list_anagrafiche (filter) error: ${listClientResult.content?.[0]?.text}`);
    } else {
      const text = listClientResult.content?.[0]?.text || '{}';
      try {
        const data = JSON.parse(text);
        ok(`Clienti found: ${data.total_count}`);
      } catch {
        fail(`Could not parse response: ${text}`);
      }
    }
    console.log('');

    // ── Step 5: get_anagrafica ──────────────────────────────────────────────
    if (firstId !== null) {
      console.log(`5. Calling get_anagrafica (id=${firstId})...`);
      const getResult = await sendRequest('tools/call', {
        name: 'get_anagrafica',
        arguments: { id: firstId },
      });

      if (getResult.isError) {
        fail(`get_anagrafica error: ${getResult.content?.[0]?.text}`);
      } else {
        try {
          const data = JSON.parse(getResult.content?.[0]?.text || '{}');
          ok(`Found: ${data.ragione_sociale} (ID: ${data.idanagrafica})`);
          ok(`City: ${data.citta || '(empty)'}, Email: ${data.email || '(empty)'}`);
        } catch {
          fail(`Could not parse get_anagrafica response`);
        }
      }
    } else {
      console.log('5. Skipping get_anagrafica (no records found in list)');
    }
    console.log('');

    // ── Step 6: CRUD — create_anagrafica ────────────────────────────────────
    console.log('6. Testing CRUD: create_anagrafica...');
    const createResult = await sendRequest('tools/call', {
      name: 'create_anagrafica',
      arguments: {
        ragione_sociale: 'Test MCP Cliente',
        tipi: [1],
        email: 'test-mcp@example.com',
        telefono: '0123456789',
        citta: 'Milano',
        provincia: 'MI',
      },
    });

    let newId = null;
    if (createResult.isError) {
      fail(`create_anagrafica error: ${createResult.content?.[0]?.text}`);
    } else {
      try {
        const data = JSON.parse(createResult.content?.[0]?.text || '{}');
        newId = data.id;
        ok(`Created with ID: ${newId}`);
      } catch {
        fail(`Could not parse create_anagrafica response`);
      }
    }
    console.log('');

    // ── Step 7: CRUD — update_anagrafica ────────────────────────────────────
    if (newId !== null) {
      console.log(`7. Testing CRUD: update_anagrafica (id=${newId})...`);
      const updateResult = await sendRequest('tools/call', {
        name: 'update_anagrafica',
        arguments: {
          id: newId,
          telefono: '9876543210',
          citta: 'Roma',
          provincia: 'RM',
        },
      });

      if (updateResult.isError) {
        fail(`update_anagrafica error: ${updateResult.content?.[0]?.text}`);
      } else {
        try {
          const data = JSON.parse(updateResult.content?.[0]?.text || '{}');
          ok(`Updated ID: ${data.id}`);
        } catch {
          fail(`Could not parse update_anagrafica response`);
        }
      }
      console.log('');

      // ── Step 8: CRUD — delete_anagrafica ──────────────────────────────────
      console.log(`8. Testing CRUD: delete_anagrafica (id=${newId})...`);
      const deleteResult = await sendRequest('tools/call', {
        name: 'delete_anagrafica',
        arguments: { id: newId },
      });

      if (deleteResult.isError) {
        fail(`delete_anagrafica error: ${deleteResult.content?.[0]?.text}`);
      } else {
        try {
          const data = JSON.parse(deleteResult.content?.[0]?.text || '{}');
          ok(`Deleted ID: ${data.id}`);
        } catch {
          fail(`Could not parse delete_anagrafica response`);
        }
      }
      console.log('');
    } else {
      console.log('7. Skipping update_anagrafica (create failed)');
      console.log('8. Skipping delete_anagrafica (create failed)');
      console.log('');
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('=== Test Summary ===');
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`=== All tests completed ===`);

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
