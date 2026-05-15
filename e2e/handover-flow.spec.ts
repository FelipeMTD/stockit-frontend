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

async function apiDelete(page: Page, token: string, path: string) {
  return page.request.delete(`${BACKEND_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function createPersonByApi(page: Page, token: string) {
  const stamp = Date.now();

  const payload = {
    documentId: unique('DOC-HANDOVER'),
    fullName: `E2E Persona Handover ${stamp}`,
    type: 'PACIENTE',
    eps: 'ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.',
    department: 'NORTE DE SANTANDER',
    municipality: 'CUCUTA',
    address: 'Dirección E2E Handover',
    area: null,
    finalStatus: 'ACTIVO',
    inactivityType: null,
    inactivityDate: null,
  };

  const res = await apiPostJson(page, token, '/api/people', payload);
  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudo crear persona E2E. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

async function createAssetByApi(page: Page, token: string) {
  const tag = unique('E2E-HANDOVER-ASSET');

  const payload = {
    tag,
    name: `Activo E2E Handover ${Date.now()}`,
    categoryId: null,

    brand: 'Marca Handover E2E',
    model: 'Modelo Handover E2E',
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
    notes: 'Activo creado automáticamente por prueba E2E Handover.',
  };

  const res = await apiPostJson(page, token, '/api/assets', payload);
  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudo crear activo E2E. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

function buildEntregaMultipart(params: {
  personId: string;
  assetId: string;
  reason?: string;
}) {
  const { personId, assetId, reason = 'INVENTARIO INICIAL' } = params;

  return {
    type: 'ENTREGA',
    personId,

    signerName: 'Firmante E2E Handover',
    signerId: '1234567890',
    relation: 'PACIENTE',
    email: 'e2e.handover@stockit.local',
    phone: '3001234567',

    notes: 'Entrega generada por prueba E2E.',
    signatureData:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    reason,

    homeDelivery: 'false',
    items: JSON.stringify([
      {
        assetId,
        quantity: 1,
      },
    ]),
  };
}

async function createEntregaByApi(params: {
  page: Page;
  token: string;
  personId: string;
  assetId: string;
}) {
  const { page, token, personId, assetId } = params;

  const res = await apiPostMultipart(
    page,
    token,
    '/api/handover',
    buildEntregaMultipart({
      personId,
      assetId,
    }),
  );

  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudo crear entrega. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

async function cleanupBestEffort(params: {
  page: Page;
  superToken: string;
  handoverId?: string | null;
  assetId?: string | null;
  personId?: string | null;
}) {
  const { page, superToken, handoverId, assetId, personId } = params;

  if (handoverId) {
    await apiDelete(page, superToken, `/api/handover/${handoverId}`).catch(
      () => undefined,
    );
  }

  if (assetId) {
    await apiDelete(page, superToken, `/api/assets/${assetId}`).catch(
      () => undefined,
    );
  }

  if (personId) {
    await apiDelete(page, superToken, `/api/people/${personId}`).catch(
      () => undefined,
    );
  }
}

async function assertAssetAssigned(params: {
  page: Page;
  token: string;
  assetId: string;
  personId: string;
}) {
  const { page, token, assetId, personId } = params;

  const res = await apiGet(page, token, `/api/assets/${assetId}`);
  const text = await res.text();

  expect(res.status(), `GET /api/assets/${assetId} falló: ${text}`).toBe(200);

  const asset = JSON.parse(text);

  expect(
    String(asset.status || '').toUpperCase(),
    'Después de la entrega, el activo debe quedar asignado.',
  ).toBe('ASSIGNED');

  const currentCustodianId =
    asset.currentCustodian?.id ||
    asset.assignedTo?.id ||
    asset.custodian?.id ||
    asset.currentCustodianId ||
    null;

  expect(
    currentCustodianId,
    [
      'Después de la entrega, el activo debe tener custodio actual.',
      '',
      `personId esperado: ${personId}`,
      `asset recibido: ${JSON.stringify(asset, null, 2)}`,
    ].join('\n'),
  ).toBe(personId);
}

async function assertHandoverDetail(params: {
  page: Page;
  token: string;
  handoverId: string;
  personId: string;
  assetId: string;
}) {
  const { page, token, handoverId, personId, assetId } = params;

  const res = await apiGet(page, token, `/api/handover/${handoverId}`);
  const text = await res.text();

  expect(res.status(), `GET /api/handover/${handoverId} falló: ${text}`).toBe(200);

  const handover = JSON.parse(text);

  expect(handover.id).toBe(handoverId);
  expect(handover.type).toBe('ENTREGA');
  expect(handover.person?.id || handover.personId).toBe(personId);

  const itemAssetIds = Array.isArray(handover.items)
    ? handover.items.map((item: any) => item.asset?.id || item.assetId)
    : [];

  expect(
    itemAssetIds,
    `La entrega ${handoverId} no contiene el activo ${assetId}`,
  ).toContain(assetId);
}

test.describe('Handover flow real', () => {
  test.beforeAll(() => {
    assertEnv();
  });

  for (const role of ['SUPER_ADMIN', 'ACTIVOS_FIJOS', 'INVENTARIO'] as RoleName[]) {
    test(`${role} crea una entrega real por API y asigna el activo`, async ({
      page,
    }) => {
      const superSession = await loginByApi(page, 'SUPER_ADMIN');
      const roleSession =
        role === 'SUPER_ADMIN' ? superSession : await loginByApi(page, role);

      const person = await createPersonByApi(page, superSession.token);
      const asset = await createAssetByApi(page, superSession.token);

      let handoverId: string | null = null;

      try {
        const handover = await createEntregaByApi({
          page,
          token: roleSession.token,
          personId: person.id,
          assetId: asset.id,
        });

      const createdHandoverId = String(handover.id);
handoverId = createdHandoverId;

expect(createdHandoverId).toBeTruthy();
expect(handover.type).toBe('ENTREGA');
expect(handover.person?.id || handover.personId).toBe(person.id);

await assertHandoverDetail({
  page,
  token: roleSession.token,
  handoverId: createdHandoverId,
  personId: person.id,
  assetId: asset.id,
});

        await assertAssetAssigned({
          page,
          token: superSession.token,
          assetId: asset.id,
          personId: person.id,
        });
      } finally {
        await cleanupBestEffort({
          page,
          superToken: superSession.token,
          handoverId,
          assetId: asset.id,
          personId: person.id,
        });
      }
    });
  }

  for (const role of ['ADMINISTRATIVO', 'VIEWER', 'CONDUCTOR'] as RoleName[]) {
    test(`${role} no puede crear entregas por API`, async ({ page }) => {
      const session = await loginByApi(page, role);

      const res = await apiPostMultipart(
        page,
        session.token,
        '/api/handover',
        buildEntregaMultipart({
          personId: 'fake-person-id',
          assetId: 'fake-asset-id',
        }),
      );

      const text = await res.text();

      expect(
        res.status(),
        `${role} no debería poder crear handover. Respuesta: ${text}`,
      ).toBe(403);
    });
  }

  test('SUPER_ADMIN puede listar entregas y recogidas', async ({ page }) => {
    const session = await loginByApi(page, 'SUPER_ADMIN');

    const res = await apiGet(page, session.token, '/api/handover?pageSize=10');
    const text = await res.text();

    expect(res.status(), `GET /api/handover falló: ${text}`).toBe(200);

    const data = JSON.parse(text);

    expect(Array.isArray(data.items), 'GET /api/handover debe devolver items[]').toBe(
      true,
    );
  });

  test('sanity: frontend responde para handover', async ({ page }) => {
    await page.goto(FRONTEND_URL, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('body')).toBeVisible();
  });

  
});