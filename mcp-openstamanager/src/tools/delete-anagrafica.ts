import { z } from 'zod';
import { osmClient } from '../osm-client.js';

export const deleteAnagraficaSchema = z.object({
  id: z.number().int().positive().describe('ID of the anagrafica to delete'),
});

export type DeleteAnagraficaInput = z.infer<typeof deleteAnagraficaSchema>;

export async function deleteAnagrafica(input: DeleteAnagraficaInput): Promise<string> {
  const result = await osmClient.deleteAnagrafica(input.id);

  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }

  return JSON.stringify({
    success: true,
    id: result.id,
    message: `Anagrafica with ID ${result.id} deleted successfully`,
  }, null, 2);
}
