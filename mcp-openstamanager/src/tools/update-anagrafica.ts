import { z } from 'zod';
import { osmClient } from '../osm-client.js';

export const updateAnagraficaSchema = z.object({
  id: z.number().int().positive().describe('ID of the anagrafica to update (required)'),
  ragione_sociale: z.string().min(1).optional().describe('Business name or full name'),
  tipi: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      'Array of anagrafica type IDs. Default types: 1=Cliente, 2=Tecnico, 3=Azienda (reserved), 4=Fornitore, 5=Vettore, 6=Agente. Multiple types allowed.'
    ),
  nome: z.string().optional().describe('First name (for individuals)'),
  cognome: z.string().optional().describe('Last name (for individuals)'),
  piva: z.string().optional().describe('VAT number (Partita IVA)'),
  codice_fiscale: z.string().optional().describe('Tax code (Codice Fiscale)'),
  indirizzo: z.string().optional().describe('Street address'),
  citta: z.string().optional().describe('City'),
  provincia: z
    .string()
    .max(2)
    .optional()
    .describe('Province code (2 letters, e.g. MI, RM)'),
  id_nazione: z.number().int().positive().optional().describe('Nation ID'),
  telefono: z.string().optional().describe('Phone number'),
  fax: z.string().optional().describe('Fax number'),
  cellulare: z.string().optional().describe('Mobile phone number'),
  email: z.string().email().optional().describe('Email address'),
});

export type UpdateAnagraficaInput = z.infer<typeof updateAnagraficaSchema>;

export async function updateAnagrafica(input: UpdateAnagraficaInput): Promise<string> {
  const result = await osmClient.updateAnagrafica(input);

  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }

  return JSON.stringify({
    success: true,
    id: result.id,
    message: `Anagrafica with ID ${result.id} updated successfully`,
  }, null, 2);
}
