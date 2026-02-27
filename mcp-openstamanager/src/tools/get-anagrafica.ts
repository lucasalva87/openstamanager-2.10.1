import { z } from 'zod';
import { osmClient } from '../osm-client.js';

export const getAnagraficaSchema = z.object({
  id: z.number().int().positive().describe('ID of the anagrafica to retrieve'),
});

export type GetAnagraficaInput = z.infer<typeof getAnagraficaSchema>;

export async function getAnagrafica(input: GetAnagraficaInput): Promise<string> {
  const result = await osmClient.getAnagrafica(input.id);

  if (result.status !== '200') {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }

  if (!result.results || result.results.length === 0) {
    throw new Error(`Anagrafica with ID ${input.id} not found`);
  }

  return JSON.stringify(result.results[0], null, 2);
}
