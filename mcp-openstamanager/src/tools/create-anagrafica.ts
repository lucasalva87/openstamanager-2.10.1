import { z } from 'zod';
import { osmClient } from '../osm-client.js';

export const createAnagraficaSchema = z.object({
  ragione_sociale: z
    .string()
    .min(1)
    .describe('Business name or full name (required)'),
  tipi: z
    .array(z.number().int().positive())
    .min(1)
    .describe(
      'Array of anagrafica type IDs (required). Default types: 1=Cliente, 2=Tecnico, 3=Azienda (reserved), 4=Fornitore, 5=Vettore, 6=Agente. Multiple types allowed, e.g. [1,4] for Cliente+Fornitore.'
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
  cellulare: z.string().optional().describe('Mobile phone number'),
  email: z.string().email().optional().describe('Email address'),
});

export type CreateAnagraficaInput = z.infer<typeof createAnagraficaSchema>;

export async function createAnagrafica(input: CreateAnagraficaInput): Promise<string> {
  const result = await osmClient.createAnagrafica(input);

  if (result.status !== 200) {
    throw new Error(`API error: ${JSON.stringify(result)}`);
  }

  const id = result.id;

  // The OpenSTAManager create API only saves ragione_sociale and tipi.
  // All other fields must be set via a subsequent update call.
  const updateFields: Record<string, unknown> = {};
  if (input.nome)           updateFields.nome           = input.nome;
  if (input.cognome)        updateFields.cognome        = input.cognome;
  if (input.piva)           updateFields.piva           = input.piva;
  if (input.codice_fiscale) updateFields.codice_fiscale = input.codice_fiscale;
  if (input.indirizzo)      updateFields.indirizzo      = input.indirizzo;
  if (input.citta)          updateFields.citta          = input.citta;
  if (input.provincia)      updateFields.provincia      = input.provincia;
  if (input.id_nazione)     updateFields.id_nazione     = input.id_nazione;
  if (input.telefono)       updateFields.telefono       = input.telefono;
  if (input.cellulare)      updateFields.cellulare      = input.cellulare;
  if (input.email)          updateFields.email          = input.email;

  if (Object.keys(updateFields).length > 0) {
    const updateResult = await osmClient.updateAnagrafica({ id, ...updateFields } as Parameters<typeof osmClient.updateAnagrafica>[0]);
    if (updateResult.status !== 200) {
      throw new Error(`Anagrafica created (ID ${id}) but update of extra fields failed: ${JSON.stringify(updateResult)}`);
    }
  }

  return JSON.stringify({
    success: true,
    id,
    message: `Anagrafica created successfully with ID ${id}`,
  }, null, 2);
}
