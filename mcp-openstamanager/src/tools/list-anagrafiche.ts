import { z } from 'zod';
import { osmClient } from '../osm-client.js';

export const listAnagraficheSchema = z.object({
  page: z.number().int().min(0).optional().describe('Page number (0-based, default 0)'),
  filter_ragione_sociale: z
    .string()
    .optional()
    .describe('Filter by ragione sociale (supports % wildcard)'),
  filter_tipo: z
    .string()
    .optional()
    .describe('Filter by anagrafica type (e.g. Cliente, Fornitore, Tecnico)'),
});

export type ListAnagraficheInput = z.infer<typeof listAnagraficheSchema>;

export async function listAnagrafiche(input: ListAnagraficheInput): Promise<string> {
  const result = await osmClient.listAnagrafiche({
    page: input.page,
    filter_ragione_sociale: input.filter_ragione_sociale,
    filter_tipo: input.filter_tipo,
  });

  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }

  const anagrafiche = Object.values(result.records || {});

  return JSON.stringify({
    anagrafiche,
    total_count: result['total-count'],
    total_pages: result.pages,
  }, null, 2);
}
