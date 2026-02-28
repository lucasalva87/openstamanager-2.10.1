import { z } from 'zod';
import { osmClient } from '../osm-client.js';

export const deleteAnagraficaSchema = z.object({
  id: z.number().int().positive().describe('ID of the anagrafica to delete'),
});

export type DeleteAnagraficaInput = z.infer<typeof deleteAnagraficaSchema>;

export async function deleteAnagrafica(input: DeleteAnagraficaInput): Promise<string> {
  // Guard: block deletion of the Azienda anagrafica (the company's own record)
  const isAzienda = await osmClient.isAzienda(input.id);
  if (isAzienda) {
    throw new Error(
      `Cannot delete anagrafica ID ${input.id}: this is the Azienda record (the company's own record) ` +
      'and cannot be deleted. Use update_anagrafica to modify it instead.'
    );
  }

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
