"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");
var import_zod_to_json_schema = require("zod-to-json-schema");

// src/tools/list-anagrafiche.ts
var import_zod = require("zod");

// src/osm-client.ts
var import_axios = __toESM(require("axios"));

// src/config.ts
var dotenv = __toESM(require("dotenv"));
var path = __toESM(require("path"));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var config2 = {
  osmBaseUrl: process.env.OSM_BASE_URL || "http://localhost/openstamanager",
  osmApiToken: process.env.OSM_API_TOKEN || ""
};
if (!config2.osmApiToken) {
  process.stderr.write("Warning: OSM_API_TOKEN is not set. API calls will fail.\n");
}

// src/osm-client.ts
var OsmClient = class {
  constructor() {
    this.token = config2.osmApiToken;
    this.client = import_axios.default.create({
      baseURL: config2.osmBaseUrl,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: 3e4
    });
  }
  /**
   * List anagrafiche with optional filters
   */
  async listAnagrafiche(params = {}) {
    const queryParams = {
      resource: "anagrafiche",
      token: this.token
    };
    if (params.page !== void 0) {
      queryParams["page"] = params.page;
    }
    if (params.filter_ragione_sociale) {
      queryParams["filter[ragione_sociale]"] = params.filter_ragione_sociale;
    }
    if (params.filter_tipo) {
      queryParams["filter[tipo]"] = params.filter_tipo;
    }
    const response = await this.client.get("/api/index.php", { params: queryParams });
    return response.data;
  }
  /**
   * Get a single anagrafica by ID
   */
  async getAnagrafica(id) {
    const response = await this.client.get("/api/index.php", {
      params: {
        resource: "anagrafiche",
        token: this.token,
        id
      }
    });
    return response.data;
  }
  /**
   * Create a new anagrafica
   */
  async createAnagrafica(data) {
    const response = await this.client.post("/api/index.php", {
      token: this.token,
      resource: "anagrafica",
      data
    });
    return response.data;
  }
  /**
   * Update an existing anagrafica
   */
  async updateAnagrafica(data) {
    const response = await this.client.put("/api/index.php", {
      token: this.token,
      resource: "anagrafica",
      data
    });
    return response.data;
  }
  /**
   * Delete an anagrafica (soft delete)
   */
  async deleteAnagrafica(id) {
    const response = await this.client.delete("/api/index.php", {
      data: {
        token: this.token,
        resource: "anagrafica",
        id
      }
    });
    return response.data;
  }
};
var osmClient = new OsmClient();

// src/tools/list-anagrafiche.ts
var listAnagraficheSchema = import_zod.z.object({
  page: import_zod.z.number().int().min(0).optional().describe("Page number (0-based, default 0)"),
  filter_ragione_sociale: import_zod.z.string().optional().describe("Filter by ragione sociale (supports % wildcard)"),
  filter_tipo: import_zod.z.string().optional().describe("Filter by anagrafica type (e.g. Cliente, Fornitore, Tecnico)")
});
async function listAnagrafiche(input) {
  const result = await osmClient.listAnagrafiche({
    page: input.page,
    filter_ragione_sociale: input.filter_ragione_sociale,
    filter_tipo: input.filter_tipo
  });
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  const anagrafiche = Object.values(result.records || {});
  return JSON.stringify({
    anagrafiche,
    total_count: result["total-count"],
    total_pages: result.pages
  }, null, 2);
}

// src/tools/get-anagrafica.ts
var import_zod2 = require("zod");
var getAnagraficaSchema = import_zod2.z.object({
  id: import_zod2.z.number().int().positive().describe("ID of the anagrafica to retrieve")
});
async function getAnagrafica(input) {
  const result = await osmClient.getAnagrafica(input.id);
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  const records = Object.values(result.records || {});
  if (records.length === 0) {
    throw new Error(`Anagrafica with ID ${input.id} not found`);
  }
  return JSON.stringify(records[0], null, 2);
}

// src/tools/create-anagrafica.ts
var import_zod3 = require("zod");
var createAnagraficaSchema = import_zod3.z.object({
  ragione_sociale: import_zod3.z.string().min(1).describe("Business name or full name (required)"),
  tipi: import_zod3.z.array(import_zod3.z.number().int().positive()).min(1).describe(
    "Array of anagrafica type IDs (required). Default types: 1=Cliente, 2=Tecnico, 3=Azienda (reserved), 4=Fornitore, 5=Vettore, 6=Agente. Multiple types allowed, e.g. [1,4] for Cliente+Fornitore."
  ),
  nome: import_zod3.z.string().optional().describe("First name (for individuals)"),
  cognome: import_zod3.z.string().optional().describe("Last name (for individuals)"),
  piva: import_zod3.z.string().optional().describe("VAT number (Partita IVA)"),
  codice_fiscale: import_zod3.z.string().optional().describe("Tax code (Codice Fiscale)"),
  indirizzo: import_zod3.z.string().optional().describe("Street address"),
  citta: import_zod3.z.string().optional().describe("City"),
  provincia: import_zod3.z.string().max(2).optional().describe("Province code (2 letters, e.g. MI, RM)"),
  id_nazione: import_zod3.z.number().int().positive().optional().describe("Nation ID"),
  telefono: import_zod3.z.string().optional().describe("Phone number"),
  cellulare: import_zod3.z.string().optional().describe("Mobile phone number"),
  email: import_zod3.z.string().email().optional().describe("Email address")
});
async function createAnagrafica(input) {
  const result = await osmClient.createAnagrafica(input);
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  const id = result.id;
  const updateFields = {};
  if (input.nome) updateFields.nome = input.nome;
  if (input.cognome) updateFields.cognome = input.cognome;
  if (input.piva) updateFields.piva = input.piva;
  if (input.codice_fiscale) updateFields.codice_fiscale = input.codice_fiscale;
  if (input.indirizzo) updateFields.indirizzo = input.indirizzo;
  if (input.citta) updateFields.citta = input.citta;
  if (input.provincia) updateFields.provincia = input.provincia;
  if (input.id_nazione) updateFields.id_nazione = input.id_nazione;
  if (input.telefono) updateFields.telefono = input.telefono;
  if (input.cellulare) updateFields.cellulare = input.cellulare;
  if (input.email) updateFields.email = input.email;
  if (Object.keys(updateFields).length > 0) {
    const updateResult = await osmClient.updateAnagrafica({ id, ...updateFields });
    if (updateResult.status !== 200) {
      throw new Error(`Anagrafica created (ID ${id}) but update of extra fields failed: ${JSON.stringify(updateResult)}`);
    }
  }
  return JSON.stringify({
    success: true,
    id,
    message: `Anagrafica created successfully with ID ${id}`
  }, null, 2);
}

// src/tools/update-anagrafica.ts
var import_zod4 = require("zod");
var updateAnagraficaSchema = import_zod4.z.object({
  id: import_zod4.z.number().int().positive().describe("ID of the anagrafica to update (required)"),
  ragione_sociale: import_zod4.z.string().min(1).optional().describe("Business name or full name"),
  tipi: import_zod4.z.array(import_zod4.z.number().int().positive()).optional().describe(
    "Array of anagrafica type IDs. Default types: 1=Cliente, 2=Tecnico, 3=Azienda (reserved), 4=Fornitore, 5=Vettore, 6=Agente. Multiple types allowed."
  ),
  nome: import_zod4.z.string().optional().describe("First name (for individuals)"),
  cognome: import_zod4.z.string().optional().describe("Last name (for individuals)"),
  piva: import_zod4.z.string().optional().describe("VAT number (Partita IVA)"),
  codice_fiscale: import_zod4.z.string().optional().describe("Tax code (Codice Fiscale)"),
  indirizzo: import_zod4.z.string().optional().describe("Street address"),
  citta: import_zod4.z.string().optional().describe("City"),
  provincia: import_zod4.z.string().max(2).optional().describe("Province code (2 letters, e.g. MI, RM)"),
  id_nazione: import_zod4.z.number().int().positive().optional().describe("Nation ID"),
  telefono: import_zod4.z.string().optional().describe("Phone number"),
  fax: import_zod4.z.string().optional().describe("Fax number"),
  cellulare: import_zod4.z.string().optional().describe("Mobile phone number"),
  email: import_zod4.z.string().email().optional().describe("Email address")
});
async function updateAnagrafica(input) {
  const result = await osmClient.updateAnagrafica(input);
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  return JSON.stringify({
    success: true,
    id: result.id,
    message: `Anagrafica with ID ${result.id} updated successfully`
  }, null, 2);
}

// src/tools/delete-anagrafica.ts
var import_zod5 = require("zod");
var deleteAnagraficaSchema = import_zod5.z.object({
  id: import_zod5.z.number().int().positive().describe("ID of the anagrafica to delete")
});
async function deleteAnagrafica(input) {
  const result = await osmClient.deleteAnagrafica(input.id);
  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }
  return JSON.stringify({
    success: true,
    id: result.id,
    message: `Anagrafica with ID ${result.id} deleted successfully`
  }, null, 2);
}

// src/index.ts
var server = new import_server.Server(
  {
    name: "mcp-openstamanager",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);
server.setRequestHandler(import_types.ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_anagrafiche",
        description: "Retrieve the list of anagrafiche (customers, suppliers, technicians, etc.) from OpenSTAManager with optional filters",
        inputSchema: (0, import_zod_to_json_schema.zodToJsonSchema)(listAnagraficheSchema)
      },
      {
        name: "get_anagrafica",
        description: "Retrieve a single anagrafica by its ID from OpenSTAManager",
        inputSchema: (0, import_zod_to_json_schema.zodToJsonSchema)(getAnagraficaSchema)
      },
      {
        name: "create_anagrafica",
        description: "Create a new anagrafica in OpenSTAManager",
        inputSchema: (0, import_zod_to_json_schema.zodToJsonSchema)(createAnagraficaSchema)
      },
      {
        name: "update_anagrafica",
        description: "Update an existing anagrafica in OpenSTAManager",
        inputSchema: (0, import_zod_to_json_schema.zodToJsonSchema)(updateAnagraficaSchema)
      },
      {
        name: "delete_anagrafica",
        description: "Delete an anagrafica from OpenSTAManager (soft delete)",
        inputSchema: (0, import_zod_to_json_schema.zodToJsonSchema)(deleteAnagraficaSchema)
      }
    ]
  };
});
server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "list_anagrafiche": {
        const input = listAnagraficheSchema.parse(args);
        result = await listAnagrafiche(input);
        break;
      }
      case "get_anagrafica": {
        const input = getAnagraficaSchema.parse(args);
        result = await getAnagrafica(input);
        break;
      }
      case "create_anagrafica": {
        const input = createAnagraficaSchema.parse(args);
        result = await createAnagrafica(input);
        break;
      }
      case "update_anagrafica": {
        const input = updateAnagraficaSchema.parse(args);
        result = await updateAnagrafica(input);
        break;
      }
      case "delete_anagrafica": {
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
          type: "text",
          text: result
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
});
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("MCP OpenSTAManager server started\n");
}
main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}
`);
  process.exit(1);
});
