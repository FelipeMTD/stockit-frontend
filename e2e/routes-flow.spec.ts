import { expect, type Page, test } from '@playwright/test';

type RoleName =
  | 'SUPER_ADMIN'
  | 'ACTIVOS_FIJOS'
  | 'INVENTARIO'
  | 'ADMINISTRATIVO'
  | 'CONDUCTOR'
  | 'VIEWER';

type Credentials = {
  documentId: string;
  password: string;
};

type AuthSession = {
  token: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
    documentId?: string | null;
    role: RoleName;
    isActive?: boolean;
  };
};

const FRONTEND_URL = process.env.RBAC_FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.RBAC_BACKEND_URL || 'http://localhost:4000';

const USERS: Record<RoleName, Credentials> = {
  SUPER_ADMIN: {
    documentId: process.env.RBAC_SUPER_ADMIN_DOC || '',
    password: process.env.RBAC_SUPER_ADMIN_PASS || '',
  },
  ACTIVOS_FIJOS: {
    documentId: process.env.RBAC_ACTIVOS_FIJOS_DOC || '',
    password: process.env.RBAC_ACTIVOS_FIJOS_PASS || '',
  },
  INVENTARIO: {
    documentId: process.env.RBAC_INVENTARIO_DOC || '',
    password: process.env.RBAC_INVENTARIO_PASS || '',
  },
  ADMINISTRATIVO: {
    documentId: process.env.RBAC_ADMINISTRATIVO_DOC || '',
    password: process.env.RBAC_ADMINISTRATIVO_PASS || '',
  },
  CONDUCTOR: {
    documentId: process.env.RBAC_CONDUCTOR_DOC || '',
    password: process.env.RBAC_CONDUCTOR_PASS || '',
  },
  VIEWER: {
    documentId: process.env.RBAC_VIEWER_DOC || '',
    password: process.env.RBAC_VIEWER_PASS || '',
  },
};

function assertEnv() {
  const missing: string[] = [];

  for (const [role, credentials] of Object.entries(USERS)) {
    if (!credentials.documentId) missing.push(`RBAC_${role}_DOC`);
    if (!credentials.password) missing.push(`RBAC_${role}_PASS`);
  }

  if (missing.length) {
    throw new Error(`Faltan variables RBAC:\n${missing.join('\n')}`);
  }
}

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`.toUpperCase();
}

async function loginByApi(page: Page, role: RoleName): Promise<AuthSession> {
  const credentials = USERS[role];

  const res = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
    data: {
      documentId: credentials.documentId,
      password: credentials.password,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`[${role}] Login API falló. HTTP ${res.status()}. ${text}`);
  }

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`[${role}] Login API no devolvió JSON válido: ${text}`);
  }

  const token = data.accessToken || data.token;
  const user = data.user;

  if (!token) throw new Error(`[${role}] Login API no devolvió token.`);
  if (!user?.role) throw new Error(`[${role}] Login API no devolvió user.role.`);

  if (user.role !== role) {
    throw new Error(`[${role}] Rol inesperado. Recibido=${user.role}`);
  }

  return {
    token,
    user,
  };
}

async function apiGet(page: Page, token: string, path: string) {
  return page.request.get(`${BACKEND_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function apiPostJson(page: Page, token: string, path: string, data: unknown) {
  return page.request.post(`${BACKEND_URL}${path}`, {
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function apiPostMultipart(
  page: Page,
  token: string,
  path: string,
  multipart: Record<string, string>,
) {
  return page.request.post(`${BACKEND_URL}${path}`, {
    multipart,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function apiPatchMultipart(
  page: Page,
  token: string,
  path: string,
  multipart: Record<string, string>,
) {
  return page.request.patch(`${BACKEND_URL}${path}`, {
    multipart,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function apiDelete(page: Page, token: string, path: string) {
  return page.request.delete(`${BACKEND_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function uniqueNumericDocument() {
  const tail = String(Date.now()).slice(-8);
  const rand = String(Math.floor(1000 + Math.random() * 9000));

  return `${tail}${rand}`;
}

async function createPersonByApi(page: Page, token: string) {
  const stamp = Date.now();
  const documentId = uniqueNumericDocument();

  const payload = {
    documentId,
    fullName: `E2E Persona Ruta ${documentId}`,
    type: 'PACIENTE',
    eps: 'ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.',
    department: 'NORTE DE SANTANDER',
    municipality: 'CUCUTA',
    address: `Dirección E2E Ruta ${stamp}`,
    phone: '3001234567',
    email: `e2e.ruta.${documentId}@stockit.local`,
    area: null,
    finalStatus: 'ACTIVO',
    inactivityType: null,
    inactivityDate: null,
  };

  const res = await apiPostJson(page, token, '/api/people', payload);
  const text = await res.text();

  if (res.status() === 409) {
    throw new Error(
      [
        'No se pudo crear persona E2E porque el backend reportó duplicado.',
        `documentId=${documentId}`,
        `payload=${JSON.stringify(payload, null, 2)}`,
        `respuesta=${text}`,
      ].join('\n'),
    );
  }

  if (!res.ok()) {
    throw new Error(`No se pudo crear persona E2E. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

async function createAssetByApi(page: Page, token: string) {
  const tag = unique('E2E-ROUTE-ASSET');

  const payload = {
    tag,
    name: `Activo E2E Ruta ${Date.now()}`,
    categoryId: null,

    brand: 'Marca Ruta E2E',
    model: 'Modelo Ruta E2E',
    serial: `SER-${tag}`,

    purchaseDate: new Date().toISOString(),
    purchaseCost: null,
    acquisitionType: null,
    supplierName: null,
    invoiceNumber: null,
    invimaCode: null,
    riskLevel: null,
    maintenanceFrequency: 'NO_APLICA',
    warrantyUntil: null,

    lifeState: 'ACTIVE',
    status: 'IN_STOCK',

    siteId: null,
    assignedWarehouseId: null,
    locationId: null,
    custodianId: null,
    currentLocationId: null,
    currentCustodianId: null,

    photoUrl: null,
    notes: 'Activo creado automáticamente por prueba E2E Routes.',
  };

  const res = await apiPostJson(page, token, '/api/assets', payload);
  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudo crear activo E2E. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

function buildHomeDeliveryMultipart(params: {
  personId: string;
  assetId: string;
  driverId: string;
  reason?: string;
}) {
  const { personId, assetId, driverId, reason = 'ENTREGA DOMICILIARIA E2E' } =
    params;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');

  return {
    type: 'ENTREGA',
    personId,
    reason,

    homeDelivery: 'true',
    driverId,
    scheduledDate: `${yyyy}-${mm}-${dd}`,

    phone: '3001234567',
    notes: 'Ruta generada por prueba E2E.',

    items: JSON.stringify([
      {
        assetId,
        quantity: 1,
      },
    ]),
  };
}

async function createHomeDeliveryRoute(params: {
  page: Page;
  superToken: string;
  driverId: string;
}) {
  const { page, superToken, driverId } = params;

  const person = await createPersonByApi(page, superToken);
  const asset = await createAssetByApi(page, superToken);

  const handoverRes = await apiPostMultipart(
    page,
    superToken,
    '/api/handover',
    buildHomeDeliveryMultipart({
      personId: person.id,
      assetId: asset.id,
      driverId,
    }),
  );

  const handoverText = await handoverRes.text();

  if (!handoverRes.ok()) {
    throw new Error(
      `No se pudo crear entrega domiciliaria. HTTP ${handoverRes.status()}: ${handoverText}`,
    );
  }

  const handover = JSON.parse(handoverText);

  const routeRes = await apiGet(
    page,
    superToken,
    `/api/routes?q=${encodeURIComponent(handover.id)}&pageSize=10`,
  );

  const routeText = await routeRes.text();

  if (!routeRes.ok()) {
    throw new Error(
      `No se pudo buscar ruta generada. HTTP ${routeRes.status()}: ${routeText}`,
    );
  }

  const routeData = JSON.parse(routeText);
  const route = Array.isArray(routeData.items) ? routeData.items[0] : null;

  if (!route?.id) {
    throw new Error(
      [
        'No se encontró ruta generada desde handover.',
        `handoverId=${handover.id}`,
        `Respuesta rutas=${routeText}`,
      ].join('\n'),
    );
  }

  return {
    person,
    asset,
    handover,
    route,
  };
}

async function createNovedad(params: {
  page: Page;
  token: string;
  routeId: string;
  description: string;
}) {
  const { page, token, routeId, description } = params;

  const res = await apiPostMultipart(page, token, `/api/routes/${routeId}/novedades`, {
    description,
  });

  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudo crear novedad. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

async function listNovedades(params: {
  page: Page;
  token: string;
  routeId: string;
}) {
  const { page, token, routeId } = params;

  const res = await apiGet(page, token, `/api/routes/${routeId}/novedades`);
  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudieron listar novedades. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

test.describe('Routes flow real', () => {
  test.beforeAll(() => {
    assertEnv();
  });

  test('SUPER_ADMIN genera ruta domiciliaria desde handover y la consulta', async ({
    page,
  }) => {
    const superSession = await loginByApi(page, 'SUPER_ADMIN');
    const driverSession = await loginByApi(page, 'CONDUCTOR');

    const created = await createHomeDeliveryRoute({
      page,
      superToken: superSession.token,
      driverId: driverSession.user.id,
    });

    expect(created.handover.id).toBeTruthy();
    expect(created.route.id).toBeTruthy();
    expect(String(created.route.code || '')).toMatch(/RUTA/i);
    expect(String(created.route.status || '')).toBeTruthy();

    const detailRes = await apiGet(
      page,
      superSession.token,
      `/api/routes/${created.route.id}`,
    );

    const detailText = await detailRes.text();

    expect(
      detailRes.status(),
      `SUPER_ADMIN no pudo consultar detalle de ruta: ${detailText}`,
    ).toBe(200);

    const detail = JSON.parse(detailText);

    expect(detail.id).toBe(created.route.id);
    expect(detail.stop?.items?.length || 0).toBeGreaterThan(0);
  });

  test('CONDUCTOR ve su ruta asignada y puede crear novedad', async ({ page }) => {
    const superSession = await loginByApi(page, 'SUPER_ADMIN');
    const driverSession = await loginByApi(page, 'CONDUCTOR');

    const created = await createHomeDeliveryRoute({
      page,
      superToken: superSession.token,
      driverId: driverSession.user.id,
    });

    const listRes = await apiGet(
      page,
      driverSession.token,
      `/api/routes?q=${encodeURIComponent(created.handover.id)}&pageSize=10`,
    );

    const listText = await listRes.text();

    expect(
      listRes.status(),
      `CONDUCTOR no pudo listar sus rutas: ${listText}`,
    ).toBe(200);

    const listData = JSON.parse(listText);
    const found = Array.isArray(listData.items)
      ? listData.items.find((item: any) => item.id === created.route.id)
      : null;

    expect(
      found?.id,
      `CONDUCTOR no vio la ruta asignada. Respuesta=${listText}`,
    ).toBe(created.route.id);

    const detailRes = await apiGet(
      page,
      driverSession.token,
      `/api/routes/${created.route.id}`,
    );

    const detailText = await detailRes.text();

    expect(
      detailRes.status(),
      `CONDUCTOR no pudo consultar detalle de ruta asignada: ${detailText}`,
    ).toBe(200);

    const description = unique('NOVEDAD-RUTA');

    const novedad = await createNovedad({
      page,
      token: driverSession.token,
      routeId: created.route.id,
      description,
    });

    expect(novedad.id).toBeTruthy();
    expect(novedad.description).toBe(description);

    const novedades = await listNovedades({
      page,
      token: driverSession.token,
      routeId: created.route.id,
    });

    const foundNovedad = Array.isArray(novedades.items)
      ? novedades.items.find((item: any) => item.id === novedad.id)
      : null;

    expect(foundNovedad?.description).toBe(description);

    const deleteAsDriver = await apiDelete(
      page,
      driverSession.token,
      `/api/routes/${created.route.id}/novedades/${novedad.id}`,
    );

    expect(
      deleteAsDriver.status(),
      'CONDUCTOR no debería eliminar novedades.',
    ).toBe(403);

    const deleteAsAdmin = await apiDelete(
      page,
      superSession.token,
      `/api/routes/${created.route.id}/novedades/${novedad.id}`,
    );

    expect(
      deleteAsAdmin.status(),
      `SUPER_ADMIN debería eliminar novedad. Respuesta=${await deleteAsAdmin.text()}`,
    ).toBe(204);
  });

  test('ACTIVOS_FIJOS e INVENTARIO pueden consultar rutas', async ({ page }) => {
    const superSession = await loginByApi(page, 'SUPER_ADMIN');

    const created = await createHomeDeliveryRoute({
      page,
      superToken: superSession.token,
      driverId: (await loginByApi(page, 'CONDUCTOR')).user.id,
    });

    for (const role of ['ACTIVOS_FIJOS', 'INVENTARIO'] as RoleName[]) {
      const session = await loginByApi(page, role);

      const listRes = await apiGet(page, session.token, '/api/routes?pageSize=5');
      const listText = await listRes.text();

      expect(
        listRes.status(),
        `${role} debería listar rutas. Respuesta=${listText}`,
      ).toBe(200);

      const detailRes = await apiGet(
        page,
        session.token,
        `/api/routes/${created.route.id}`,
      );

      const detailText = await detailRes.text();

      expect(
        detailRes.status(),
        `${role} debería ver detalle de ruta. Respuesta=${detailText}`,
      ).toBe(200);
    }
  });

  for (const role of ['ADMINISTRATIVO', 'VIEWER'] as RoleName[]) {
    test(`${role} no puede consultar rutas`, async ({ page }) => {
      const session = await loginByApi(page, role);

      const listRes = await apiGet(page, session.token, '/api/routes?pageSize=5');
      const listText = await listRes.text();

      expect(
        listRes.status(),
        `${role} no debería listar rutas. Respuesta=${listText}`,
      ).toBe(403);

      const novedadRes = await apiPostMultipart(
        page,
        session.token,
        '/api/routes/fake-route-id/novedades',
        {
          description: 'Novedad no permitida',
        },
      );

      const novedadText = await novedadRes.text();

      expect(
        novedadRes.status(),
        `${role} no debería crear novedades. Respuesta=${novedadText}`,
      ).toBe(403);
    });
  }

  test('sanity: frontend responde para routes flow', async ({ page }) => {
    await page.goto(FRONTEND_URL, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('body')).toBeVisible();
  });
});