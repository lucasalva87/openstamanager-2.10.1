import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from the mcp-openstamanager directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const config = {
  osmBaseUrl: process.env.OSM_BASE_URL || 'http://localhost/openstamanager',
  osmApiToken: process.env.OSM_API_TOKEN || '',
};

if (!config.osmApiToken) {
  process.stderr.write('Warning: OSM_API_TOKEN is not set. API calls will fail.\n');
}
