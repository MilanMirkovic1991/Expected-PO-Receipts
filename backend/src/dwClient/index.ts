import { createHttp } from './http.js';
import { makeAuthApi } from './auth.js';
import { makeEPlantsApi } from './eplants.js';
import { makeInventoryApi } from './inventory.js';
import { makePOReleasesApi } from './poReleases.js';
import { makePOReceiptsApi } from './poReceipts.js';
import { makeLabelsApi } from './labels.js';
import { makeEmployeesApi } from './employees.js';
import { makeLocationsApi } from './locations.js';
import { makeVendorsApi } from './vendors.js';
import { DwClientConfig } from './types.js';

export function createDwClient(cfg: DwClientConfig) {
  const http = createHttp(cfg.baseUrl);
  const authToken: { value: string | null } = { value: null };
  http.interceptors.request.use(req => {
    if (authToken.value) req.headers.set('AuthToken', authToken.value);
    return req;
  });
  const inventory = makeInventoryApi(http);
  const vendors = makeVendorsApi(http);
  return {
    setAuthToken(token: string) { authToken.value = token; },
    auth: makeAuthApi(http),
    eplants: makeEPlantsApi(http),
    inventory,
    vendors,
    poReleases: makePOReleasesApi(http, inventory, vendors),
    poReceipts: makePOReceiptsApi(http),
    labels: makeLabelsApi(http),
    employees: makeEmployeesApi(http),
    locations: makeLocationsApi(http),
    http,
  };
}

export type DwClient = ReturnType<typeof createDwClient>;
