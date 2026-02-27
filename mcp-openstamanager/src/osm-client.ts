import axios, { AxiosInstance } from 'axios';
import { config } from './config.js';

export interface Anagrafica {
  idanagrafica: number;
  ragione_sociale: string;
  piva?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  citta?: string;
  provincia?: string;
  id_nazione?: number;
  nazione?: string;
  telefono?: string;
  fax?: string;
  cellulare?: string;
  email?: string;
  nome?: string;
  cognome?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export interface ApiListResponse {
  status: string;
  results: Anagrafica[];
  'total-count': number;
  'total-pages': number;
  page: number;
}

export interface ApiSingleResponse {
  status: string;
  results: Anagrafica[];
}

export interface ApiCreateResponse {
  status: string;
  id: number;
  op: string;
}

export interface ApiUpdateResponse {
  status: string;
  id: number;
}

export interface ApiDeleteResponse {
  status: string;
  id: number;
}

export class OsmClient {
  private client: AxiosInstance;
  private token: string;

  constructor() {
    this.token = config.osmApiToken;
    this.client = axios.create({
      baseURL: config.osmBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * List anagrafiche with optional filters
   */
  async listAnagrafiche(params: {
    page?: number;
    filter_ragione_sociale?: string;
    filter_tipo?: string;
  } = {}): Promise<ApiListResponse> {
    const queryParams: Record<string, string | number> = {
      resource: 'anagrafiche',
      token: this.token,
    };

    if (params.page !== undefined) {
      queryParams['page'] = params.page;
    }
    if (params.filter_ragione_sociale) {
      queryParams['filter[ragione_sociale]'] = params.filter_ragione_sociale;
    }
    if (params.filter_tipo) {
      queryParams['filter[tipo]'] = params.filter_tipo;
    }

    const response = await this.client.get('/api/index.php', { params: queryParams });
    return response.data;
  }

  /**
   * Get a single anagrafica by ID
   */
  async getAnagrafica(id: number): Promise<ApiSingleResponse> {
    const response = await this.client.get('/api/index.php', {
      params: {
        resource: 'anagrafiche',
        token: this.token,
        id,
      },
    });
    return response.data;
  }

  /**
   * Create a new anagrafica
   */
  async createAnagrafica(data: {
    ragione_sociale: string;
    tipi: number[];
    nome?: string;
    cognome?: string;
    piva?: string;
    codice_fiscale?: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    id_nazione?: number;
    telefono?: string;
    cellulare?: string;
    email?: string;
  }): Promise<ApiCreateResponse> {
    const response = await this.client.post('/api/index.php', {
      token: this.token,
      resource: 'anagrafiche',
      data,
    });
    return response.data;
  }

  /**
   * Update an existing anagrafica
   */
  async updateAnagrafica(data: {
    id: number;
    ragione_sociale?: string;
    tipi?: number[];
    nome?: string;
    cognome?: string;
    piva?: string;
    codice_fiscale?: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    id_nazione?: number;
    telefono?: string;
    fax?: string;
    cellulare?: string;
    email?: string;
  }): Promise<ApiUpdateResponse> {
    const response = await this.client.put('/api/index.php', {
      token: this.token,
      resource: 'anagrafiche',
      data,
    });
    return response.data;
  }

  /**
   * Delete an anagrafica (soft delete)
   */
  async deleteAnagrafica(id: number): Promise<ApiDeleteResponse> {
    const response = await this.client.delete('/api/index.php', {
      data: {
        token: this.token,
        resource: 'anagrafiche',
        id,
      },
    });
    return response.data;
  }
}

export const osmClient = new OsmClient();
