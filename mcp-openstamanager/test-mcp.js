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
 *   - (Optional) Call get_anagrafica, create_anagrafica, etc.
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

  try {
    // ── Step 1: Initialize ──────────────────────────────────────────────────
    console.log('1. Initializing MCP connection...');
    const initResult = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    console.log(`   ✓ Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}`);
    console.log(`   ✓ Protocol: ${initResult.protocolVersion}`);

    // Send initialized notification
    sendNotification('notifications/initialized');
    console.log('');

    // ── Step 2: List tools ──────────────────────────────────────────────────
    console.log('2. Listing available tools...');
    const toolsResult = await sendRequest('tools/list');
    const tools = toolsResult.tools || [];
    console.log(`   ✓ Found ${tools.length} tools:`);
    for (const tool of tools) {
      console.log(`     - ${tool.name}: ${tool.description}`);
    }
    console.log('');

    // ── Step 3: Call list_anagrafiche ───────────────────────────────────────
    console.log('3. Calling list_anagrafiche (page 0)...');
    const listResult = await sendRequest('tools/call', {
      name: 'list_anagrafiche',
      arguments: { page: 0 },
    });

    if (listResult.isError) {
      console.log(`   ✗ Error: ${listResult.content?.[0]?.text}`);
    } else {
      const text = listResult.content?.[0]?.text || '{}';
      try {
        const data = JSON.parse(text);
        console.log(`   ✓ Total records: ${data.total_count}`);
        console.log(`   ✓ Total pages: ${data.total_pages}`);
        console.log(`   ✓ Records on this page: ${data.anagrafiche?.length || 0}`);
        if (data.anagrafiche?.length > 0) {
          console.log(`   ✓ First record: ${data.anagrafiche[0].ragione_sociale} (ID: ${data.anagrafiche[0].idanagrafica})`);
        }
      } catch {
        console.log(`   Response: ${text}`);
      }
    }
    console.log('');

    // ── Step 4: Call list_anagrafiche with filter ───────────────────────────
    console.log('4. Calling list_anagrafiche with filter_tipo=Cliente...');
    const listClientResult = await sendRequest('tools/call', {
      name: 'list_anagrafiche',
      arguments: { page: 0, filter_tipo: 'Cliente' },
    });

    if (listClientResult.isError) {
      console.log(`   ✗ Error: ${listClientResult.content?.[0]?.text}`);
    } else {
      const text = listClientResult.content?.[0]?.text || '{}';
      try {
        const data = JSON.parse(text);
        console.log(`   ✓ Clienti found: ${data.total_count}`);
      } catch {
        console.log(`   Response: ${text}`);
      }
    }
    console.log('');

    // ── Step 5: (Optional) Test get_anagrafica if we have an ID ────────────
    // Uncomment and set a real ID to test:
    /*
    const TEST_ID = 1;
    console.log(`5. Calling get_anagrafica (id=${TEST_ID})...`);
    const getResult = await sendRequest('tools/call', {
      name: 'get_anagrafica',
      arguments: { id: TEST_ID },
    });
    if (getResult.isError) {
      console.log(`   ✗ Error: ${getResult.content?.[0]?.text}`);
    } else {
      const data = JSON.parse(getResult.content?.[0]?.text || '{}');
      console.log(`   ✓ Found: ${data.ragione_sociale}`);
    }
    console.log('');
    */

    // ── Step 6: (Optional) Full CRUD test ──────────────────────────────────
    // Uncomment to test create/update/delete (will create a real record!):
    /*
    console.log('5. Testing CRUD: create_anagrafica...');
    const createResult = await sendRequest('tools/call', {
      name: 'create_anagrafica',
      arguments: {
        ragione_sociale: 'Test MCP Cliente',
        tipi: [1],  // 1 = Cliente (adjust to your OSM instance)
        email: 'test-mcp@example.com',
        telefono: '0123456789',
      },
    });
    if (createResult.isError) {
      console.log(`   ✗ Error: ${createResult.content?.[0]?.text}`);
    } else {
      const data = JSON.parse(createResult.content?.[0]?.text || '{}');
      const newId = data.id;
      console.log(`   ✓ Created with ID: ${newId}`);

      // Update it
      console.log('6. Testing CRUD: update_anagrafica...');
      const updateResult = await sendRequest('tools/call', {
        name: 'update_anagrafica',
        arguments: { id: newId, telefono: '9876543210' },
      });
      if (updateResult.isError) {
        console.log(`   ✗ Error: ${updateResult.content?.[0]?.text}`);
      } else {
        console.log(`   ✓ Updated ID: ${newId}`);
      }

      // Delete it
      console.log('7. Testing CRUD: delete_anagrafica...');
      const deleteResult = await sendRequest('tools/call', {
        name: 'delete_anagrafica',
        arguments: { id: newId },
      });
      if (deleteResult.isError) {
        console.log(`   ✗ Error: ${deleteResult.content?.[0]?.text}`);
      } else {
        console.log(`   ✓ Deleted ID: ${newId}`);
      }
    }
    console.log('');
    */

    console.log('=== All tests completed ===');

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
