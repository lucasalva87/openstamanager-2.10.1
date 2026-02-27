# MCP Server for OpenSTAManager

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides tools for managing **anagrafiche** (customers, suppliers, technicians, etc.) in [OpenSTAManager](https://www.openstamanager.com/).

## Features

This MCP server exposes 5 tools for CRUD operations on OpenSTAManager anagrafiche:

| Tool | Description |
|------|-------------|
| `list_anagrafiche` | List anagrafiche with optional filters (pagination, name, type) |
| `get_anagrafica` | Get a single anagrafica by ID |
| `create_anagrafica` | Create a new anagrafica |
| `update_anagrafica` | Update an existing anagrafica |
| `delete_anagrafica` | Delete an anagrafica (soft delete) |

## Requirements

- Node.js >= 18
- An OpenSTAManager instance with API access
- An API token from OpenSTAManager (Settings > API or from `zz_tokens` table)

## Installation

```bash
cd mcp-openstamanager
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
OSM_BASE_URL=http://your-openstamanager-host/openstamanager
OSM_API_TOKEN=your_api_token_here
```

### Getting the API Token

1. Log in to OpenSTAManager
2. Go to **Impostazioni** (Settings) > **API**
3. Create or copy an existing token
4. Alternatively, query the `zz_tokens` table in the database

## Usage

### Running the server

```bash
npm start
```

### Development mode

```bash
npm run dev
```

### Integration with MCP clients

Add to your MCP client configuration (e.g., Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "openstamanager": {
      "command": "node",
      "args": ["/path/to/mcp-openstamanager/dist/index.js"],
      "env": {
        "OSM_BASE_URL": "http://your-openstamanager-host/openstamanager",
        "OSM_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

## Tool Reference

### `list_anagrafiche`

Retrieve a paginated list of anagrafiche.

**Parameters:**
- `page` (number, optional): Page number, 0-based (default: 0)
- `filter_ragione_sociale` (string, optional): Filter by name (supports `%` wildcard)
- `filter_tipo` (string, optional): Filter by type (e.g., `Cliente`, `Fornitore`, `Tecnico`)

**Returns:** Array of anagrafiche with total count and pagination info.

### `get_anagrafica`

Get a single anagrafica by ID.

**Parameters:**
- `id` (number, required): Anagrafica ID

**Returns:** Full anagrafica data.

### `create_anagrafica`

Create a new anagrafica.

**Parameters:**
- `ragione_sociale` (string, required): Business name or full name
- `tipi` (number[], required): Array of type IDs (e.g., `[1]` for Cliente)
- `nome` (string, optional): First name (for individuals)
- `cognome` (string, optional): Last name (for individuals)
- `piva` (string, optional): VAT number
- `codice_fiscale` (string, optional): Tax code
- `indirizzo` (string, optional): Street address
- `citta` (string, optional): City
- `provincia` (string, optional): Province code (2 letters)
- `id_nazione` (number, optional): Nation ID
- `telefono` (string, optional): Phone number
- `cellulare` (string, optional): Mobile phone
- `email` (string, optional): Email address

**Returns:** ID of the newly created anagrafica.

### `update_anagrafica`

Update an existing anagrafica.

**Parameters:**
- `id` (number, required): Anagrafica ID to update
- All fields from `create_anagrafica` as optional

**Returns:** ID of the updated anagrafica.

### `delete_anagrafica`

Delete an anagrafica (soft delete - sets `deleted_at` timestamp).

**Parameters:**
- `id` (number, required): Anagrafica ID to delete

**Returns:** Confirmation with the deleted ID.

## Architecture

```
mcp-openstamanager/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── config.ts         # Environment configuration
│   ├── osm-client.ts     # HTTP client for OpenSTAManager API
│   └── tools/
│       ├── list-anagrafiche.ts
│       ├── get-anagrafica.ts
│       ├── create-anagrafica.ts
│       ├── update-anagrafica.ts
│       └── delete-anagrafica.ts
├── dist/                 # Compiled JavaScript (after build)
├── .env.example          # Configuration template
├── package.json
└── tsconfig.json
```

## License

GPL-3.0 — same as OpenSTAManager.
