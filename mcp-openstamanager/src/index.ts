import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { listAnagraficheSchema, listAnagrafiche } from './tools/list-anagrafiche.js';
import { getAnagraficaSchema, getAnagrafica } from './tools/get-anagrafica.js';
import { createAnagraficaSchema, createAnagrafica } from './tools/create-anagrafica.js';
import { updateAnagraficaSchema, updateAnagrafica } from './tools/update-anagrafica.js';
import { deleteAnagraficaSchema, deleteAnagrafica } from './tools/delete-anagrafica.js';

const server = new Server(
  {
    name: 'mcp-openstamanager',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_anagrafiche',
        description:
          'Retrieve the list of anagrafiche (customers, suppliers, technicians, etc.) from OpenSTAManager with optional filters',
        inputSchema: zodToJsonSchema(listAnagraficheSchema),
      },
      {
        name: 'get_anagrafica',
        description: 'Retrieve a single anagrafica by its ID from OpenSTAManager',
        inputSchema: zodToJsonSchema(getAnagraficaSchema),
      },
      {
        name: 'create_anagrafica',
        description: 'Create a new anagrafica in OpenSTAManager',
        inputSchema: zodToJsonSchema(createAnagraficaSchema),
      },
      {
        name: 'update_anagrafica',
        description: 'Update an existing anagrafica in OpenSTAManager',
        inputSchema: zodToJsonSchema(updateAnagraficaSchema),
      },
      {
        name: 'delete_anagrafica',
        description: 'Delete an anagrafica from OpenSTAManager (soft delete)',
        inputSchema: zodToJsonSchema(deleteAnagraficaSchema),
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'list_anagrafiche': {
        const input = listAnagraficheSchema.parse(args);
        result = await listAnagrafiche(input);
        break;
      }
      case 'get_anagrafica': {
        const input = getAnagraficaSchema.parse(args);
        result = await getAnagrafica(input);
        break;
      }
      case 'create_anagrafica': {
        const input = createAnagraficaSchema.parse(args);
        result = await createAnagrafica(input);
        break;
      }
      case 'update_anagrafica': {
        const input = updateAnagraficaSchema.parse(args);
        result = await updateAnagrafica(input);
        break;
      }
      case 'delete_anagrafica': {
        const input = deleteAnagraficaSchema.parse(args);
        result = await deleteAnagrafica(input);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('MCP OpenSTAManager server started\n');
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
