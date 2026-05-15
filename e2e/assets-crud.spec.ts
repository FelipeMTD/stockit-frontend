import { expect, type Locator, type Page, test } from '@playwright/test';

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

type AssetCatalog = {
  categoryId: string;
  categoryName: string;
  assetName: string;
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

function uniqueTag(prefix: string) {
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

async function loginAs(page: Page, role: RoleName) {
  const session = await loginByApi(page, role);

  await page.addInitScript(
    ({ injectedToken, injectedUser }) => {
      localStorage.clear();
      sessionStorage.clear();

      localStorage.setItem('access_token', injectedToken);
      localStorage.setItem('accessToken', injectedToken);
      localStorage.setItem('token', injectedToken);
      localStorage.setItem('auth_token', injectedToken);
      localStorage.setItem('jwt', injectedToken);

      localStorage.setItem('user_role', injectedUser.role);
      localStorage.setItem('user', JSON.stringify(injectedUser));
      localStorage.setItem('auth_user', JSON.stringify(injectedUser));
    },
    {
      injectedToken: session.token,
      injectedUser: session.user,
    },
  );

  return session;
}

async function apiGet(page: Page, token: string, path: string) {
  return page.request.get(`${BACKEND_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function apiPost(page: Page, token: string, path: string, data: unknown) {
  return page.request.post(`${BACKEND_URL}${path}`, {
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function apiPatch(page: Page, token: string, path: string, data: unknown) {
  return page.request.patch(`${BACKEND_URL}${path}`, {
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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

async function getPageDebug(page: Page) {
  const currentUrl = page.url();
  const currentPath = new URL(currentUrl).pathname;
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const navText = await page.locator('nav').innerText().catch(() => '');

  const storage = await page
    .evaluate(() => ({
      access_token: localStorage.getItem('access_token'),
      user_role: localStorage.getItem('user_role'),
      user: localStorage.getItem('user'),
      pathname: window.location.pathname,
    }))
    .catch(() => null);

  return {
    currentUrl,
    currentPath,
    bodyText,
    bodyPreview: bodyText.slice(0, 1_500),
    navText,
    navPreview: navText.slice(0, 1_000),
    storage,
  };
}

async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);

  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.innerText || '';
        const authLoading =
          /cargando sesión|verificando usuario|redirigiendo/i.test(bodyText);

        return !authLoading;
      },
      undefined,
      {
        timeout: 15_000,
        polling: 250,
      },
    );
  } catch (error) {
    const debug = await getPageDebug(page);

    const wrapped = new Error(
      [
        'La app no salió del estado de carga de sesión.',
        '',
        `URL actual: ${debug.currentUrl}`,
        `Path actual: ${debug.currentPath}`,
        '',
        'LOCAL STORAGE:',
        JSON.stringify(debug.storage, null, 2),
        '',
        'NAV:',
        debug.navPreview || '[nav vacío/no existe]',
        '',
        'BODY:',
        debug.bodyPreview || '[body vacío]',
      ].join('\n'),
    );

    (wrapped as any).cause = error;
    throw wrapped;
  }

  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function gotoApp(page: Page, route: string) {
  try {
    await page.goto(route, {
      waitUntil: 'domcontentloaded',
    });
  } catch (error: any) {
    const message = String(error?.message || error);

    if (!message.includes('ERR_ABORTED')) {
      throw error;
    }
  }

  await waitForAppReady(page);

  const debug = await getPageDebug(page);

  expect(
    debug.bodyText,
    [
      'La página terminó en Internal Server Error.',
      `path solicitado: ${route}`,
      `URL actual: ${debug.currentUrl}`,
      '',
      'NAV:',
      debug.navPreview || '[nav vacío/no existe]',
      '',
      'BODY:',
      debug.bodyPreview || '[body vacío]',
    ].join('\n'),
  ).not.toMatch(/internal server error/i);
}

async function expectVisible(page: Page, locator: Locator, message: string) {
  try {
    await expect(locator, message).toBeVisible({
      timeout: 15_000,
    });
  } catch (error) {
    const debug = await getPageDebug(page);

    const wrapped = new Error(
      [
        message,
        '',
        `URL actual: ${debug.currentUrl}`,
        `Path actual: ${debug.currentPath}`,
        '',
        'NAV:',
        debug.navPreview || '[nav vacío/no existe]',
        '',
        'BODY:',
        debug.bodyPreview || '[body vacío]',
      ].join('\n'),
    );

    (wrapped as any).cause = error;
    throw wrapped;
  }
}

async function expectAbsent(page: Page, locator: Locator, message: string) {
  try {
    await expect(locator, message).toHaveCount(0, {
      timeout: 5_000,
    });
  } catch (error) {
    const debug = await getPageDebug(page);

    const wrapped = new Error(
      [
        message,
        '',
        `URL actual: ${debug.currentUrl}`,
        `Path actual: ${debug.currentPath}`,
        '',
        'NAV:',
        debug.navPreview || '[nav vacío/no existe]',
        '',
        'BODY:',
        debug.bodyPreview || '[body vacío]',
      ].join('\n'),
    );

    (wrapped as any).cause = error;
    throw wrapped;
  }
}

async function ensureAssetCatalog(page: Page): Promise<AssetCatalog> {
  const superSession = await loginByApi(page, 'SUPER_ADMIN');

  const listRes = await apiGet(
    page,
    superSession.token,
    '/api/catalog/categories?pageSize=5000',
  );

  if (!listRes.ok()) {
    throw new Error(
      `No se pudieron listar categorías. HTTP ${listRes.status()}: ${await listRes.text()}`,
    );
  }

  const listData = await listRes.json();
  const categories = Array.isArray(listData?.items) ? listData.items : [];

  const existing = categories.find(
    (category: any) =>
      Array.isArray(category.allowedNames) && category.allowedNames.length > 0,
  );

  if (existing) {
    return {
      categoryId: existing.id,
      categoryName: existing.name,
      assetName: existing.allowedNames[0].name,
    };
  }

  const stamp = Date.now();
  const categoryName = `E2E Categoría ${stamp}`;
  const assetName = `E2E Activo ${stamp}`;

  const createCategoryRes = await apiPost(
    page,
    superSession.token,
    '/api/catalog/categories',
    {
      name: categoryName,
      code: `E2E-${stamp}`,
      description: 'Categoría creada automáticamente por pruebas E2E.',
    },
  );

  if (!createCategoryRes.ok()) {
    throw new Error(
      `No se pudo crear categoría E2E. HTTP ${createCategoryRes.status()}: ${await createCategoryRes.text()}`,
    );
  }

  const category = await createCategoryRes.json();

  const createNameRes = await apiPost(
    page,
    superSession.token,
    '/api/catalog/category-names',
    {
      categoryId: category.id,
      name: assetName,
    },
  );

  if (!createNameRes.ok()) {
    throw new Error(
      `No se pudo crear nombre permitido E2E. HTTP ${createNameRes.status()}: ${await createNameRes.text()}`,
    );
  }

  return {
    categoryId: category.id,
    categoryName,
    assetName,
  };
}

async function createAssetByApi(params: {
  page: Page;
  token: string;
  tag: string;
  name: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  serial?: string;
}) {
  const { page, token, tag, name, categoryId, brand, model, serial } = params;

  const res = await apiPost(page, token, '/api/assets', {
    tag,
    name,
    categoryId: categoryId || null,

    brand: brand || null,
    model: model || null,
    serial: serial || null,

    // Obligatorio para zAssetCreate del backend.
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

    siteId: null,
    assignedWarehouseId: null,
    locationId: null,
    custodianId: null,
    currentLocationId: null,
    currentCustodianId: null,

    photoUrl: null,
    notes: 'Activo creado automáticamente por prueba E2E.',
  });

  const text = await res.text();

  if (!res.ok()) {
    throw new Error(`No se pudo crear activo por API. HTTP ${res.status()}: ${text}`);
  }

  return JSON.parse(text);
}

async function cleanupAsset(page: Page, token: string, assetId?: string | null) {
  if (!assetId) return;

  await apiDelete(page, token, `/api/assets/${assetId}`).catch(() => undefined);
}

async function selectShadcnOptionByIndex(params: {
  page: Page;
  index: number;
  optionName: string;
}) {
  const { page, index, optionName } = params;

  const trigger = page.getByRole('combobox').nth(index);

  await expectVisible(
    page,
    trigger,
    `No se encontró combobox índice ${index} para seleccionar "${optionName}".`,
  );

  await trigger.click();

  const option = page.getByRole('option', {
    name: optionName,
    exact: true,
  });

  await expectVisible(
    page,
    option,
    `No se encontró la opción "${optionName}" en el combobox ${index}.`,
  );

  await option.click();
}

async function fillNewAssetForm(params: {
  page: Page;
  tag: string;
  categoryName: string;
  assetName: string;
  brand: string;
  model: string;
  serial: string;
}) {
  const { page, tag, categoryName, assetName, brand, model, serial } = params;

  await page.getByPlaceholder('ACT-0001').fill(tag);

  /**
   * Orden en asset-form.tsx:
   * 0 = Categoría
   * 1 = Nombre del activo
   * 2 = Sede
   * 3 = Bodega asignada
   * ...
   */
  await selectShadcnOptionByIndex({
    page,
    index: 0,
    optionName: categoryName,
  });

  await selectShadcnOptionByIndex({
    page,
    index: 1,
    optionName: assetName,
  });

  await page.getByPlaceholder('Dell / HP / Lenovo').fill(brand);
  await page.getByPlaceholder('Latitude 5420').fill(model);
  await page.getByPlaceholder('SN-ABC-123').fill(serial);
}

async function searchAssetInList(page: Page, tag: string) {
  await gotoApp(page, '/assets');

  const search = page.getByPlaceholder('Buscar por código, nombre o serial…');

  await expectVisible(
    page,
    search,
    'No se encontró el buscador de activos.',
  );

  await search.fill(tag);

  await expectVisible(
    page,
    page.getByText(tag, {
      exact: true,
    }).first(),
    `El activo ${tag} no apareció en el listado.`,
  );
}

test.describe('Assets CRUD real', () => {
  test.beforeAll(() => {
    assertEnv();
  });

  test('SUPER_ADMIN crea un activo desde UI y aparece en inventario', async ({
    page,
  }) => {
    const session = await loginAs(page, 'SUPER_ADMIN');
    const catalog = await ensureAssetCatalog(page);

    const tag = uniqueTag('E2E-SA');
    const brand = 'Marca E2E SA';
    const model = 'Modelo E2E SA';
    const serial = `SER-${tag}`;

    let createdId: string | null = null;

    await gotoApp(page, '/assets/new');

    await expectVisible(
      page,
      page.getByTestId('new-asset-page'),
      'SUPER_ADMIN debería entrar a la página de nuevo activo.',
    );

    await fillNewAssetForm({
      page,
      tag,
      categoryName: catalog.categoryName,
      assetName: catalog.assetName,
      brand,
      model,
      serial,
    });

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/api/assets') &&
          res.request().method() === 'POST',
        {
          timeout: 20_000,
        },
      ),
      page.getByRole('button', { name: /^Guardar$/i }).click(),
    ]);

    const createText = await createResponse.text();

    expect(
      createResponse.status(),
      `POST /api/assets falló: ${createText}`,
    ).toBeGreaterThanOrEqual(200);

    expect(
      createResponse.status(),
      `POST /api/assets falló: ${createText}`,
    ).toBeLessThan(300);

    const created = JSON.parse(createText);
    createdId = created.id;

    expect(created.tag).toBe(tag);
    expect(created.name).toBe(catalog.assetName);

    await page.waitForURL(/\/assets\/[^/]+$/, {
      timeout: 20_000,
    });

    await searchAssetInList(page, tag);

    await cleanupAsset(page, session.token, createdId);
  });

  test('INVENTARIO crea un activo desde UI y aparece en inventario', async ({
    page,
  }) => {
    const session = await loginAs(page, 'INVENTARIO');
    const catalog = await ensureAssetCatalog(page);

    const tag = uniqueTag('E2E-INV');
    const brand = 'Marca E2E INV';
    const model = 'Modelo E2E INV';
    const serial = `SER-${tag}`;

    let createdId: string | null = null;

    await gotoApp(page, '/assets/new');

    await expectVisible(
      page,
      page.getByTestId('new-asset-page'),
      'INVENTARIO debería entrar a la página de nuevo activo.',
    );

    await fillNewAssetForm({
      page,
      tag,
      categoryName: catalog.categoryName,
      assetName: catalog.assetName,
      brand,
      model,
      serial,
    });

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/api/assets') &&
          res.request().method() === 'POST',
        {
          timeout: 20_000,
        },
      ),
      page.getByRole('button', { name: /^Guardar$/i }).click(),
    ]);

    const createText = await createResponse.text();

    expect(
      createResponse.status(),
      `POST /api/assets falló: ${createText}`,
    ).toBeGreaterThanOrEqual(200);

    expect(
      createResponse.status(),
      `POST /api/assets falló: ${createText}`,
    ).toBeLessThan(300);

    const created = JSON.parse(createText);
    createdId = created.id;

    expect(created.tag).toBe(tag);
    expect(created.name).toBe(catalog.assetName);

    await page.waitForURL(/\/assets\/[^/]+$/, {
      timeout: 20_000,
    });

    await searchAssetInList(page, tag);

    await cleanupAsset(page, session.token, createdId);
  });

  test('SUPER_ADMIN edita un activo desde UI y el cambio queda persistido', async ({
    page,
  }) => {
    const session = await loginAs(page, 'SUPER_ADMIN');
    const catalog = await ensureAssetCatalog(page);

    const tag = uniqueTag('E2E-EDIT');
    const asset = await createAssetByApi({
      page,
      token: session.token,
      tag,
      name: catalog.assetName,
      categoryId: catalog.categoryId,
      brand: 'Marca inicial',
      model: 'Modelo inicial',
      serial: `SER-${tag}`,
    });

    const updatedBrand = `Marca editada ${Date.now()}`;
    const updatedModel = `Modelo editado ${Date.now()}`;

    await gotoApp(page, `/assets/${asset.id}/edit`);

    await expectVisible(
      page,
      page.getByRole('heading', {
        name: /editar activo/i,
      }),
      'SUPER_ADMIN debería entrar a Editar activo.',
    );

    await page.locator('input[placeholder="Dell"]').fill(updatedBrand);
    await page.locator('input[placeholder="Latitude 5440"]').fill(updatedModel);

    const [patchResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/assets/${asset.id}`) &&
          res.request().method() === 'PATCH',
        {
          timeout: 20_000,
        },
      ),
      page.getByRole('button', { name: /guardar cambios/i }).click(),
    ]);

    const patchText = await patchResponse.text();

    expect(
      patchResponse.status(),
      `PATCH /api/assets/${asset.id} falló: ${patchText}`,
    ).toBeGreaterThanOrEqual(200);

    expect(
      patchResponse.status(),
      `PATCH /api/assets/${asset.id} falló: ${patchText}`,
    ).toBeLessThan(300);

    const getRes = await apiGet(page, session.token, `/api/assets/${asset.id}`);
    const getText = await getRes.text();

    expect(
      getRes.status(),
      `GET /api/assets/${asset.id} falló: ${getText}`,
    ).toBe(200);

    const updated = JSON.parse(getText);

    expect(updated.brand).toBe(updatedBrand);
    expect(updated.model).toBe(updatedModel);

    await cleanupAsset(page, session.token, asset.id);
  });

  test('ADMINISTRATIVO no puede crear ni editar activos por API', async ({
    page,
  }) => {
    const adminSession = await loginByApi(page, 'ADMINISTRATIVO');
    const superSession = await loginByApi(page, 'SUPER_ADMIN');
    const catalog = await ensureAssetCatalog(page);

    const tag = uniqueTag('E2E-DENY-ADMIN');

    const createDenied = await apiPost(page, adminSession.token, '/api/assets', {
  tag,
  name: catalog.assetName,
  categoryId: catalog.categoryId,
  purchaseDate: new Date().toISOString(),
  maintenanceFrequency: 'NO_APLICA',
  lifeState: 'ACTIVE',
});

    expect(
      createDenied.status(),
      `ADMINISTRATIVO no debería crear activos. Respuesta: ${await createDenied.text()}`,
    ).toBe(403);

    const asset = await createAssetByApi({
      page,
      token: superSession.token,
      tag: uniqueTag('E2E-ADMIN-PATCH'),
      name: catalog.assetName,
      categoryId: catalog.categoryId,
    });

    const editDenied = await apiPatch(
      page,
      adminSession.token,
      `/api/assets/${asset.id}`,
      {
        brand: 'Marca no permitida',
      },
    );

    expect(
      editDenied.status(),
      `ADMINISTRATIVO no debería editar activos. Respuesta: ${await editDenied.text()}`,
    ).toBe(403);

    await cleanupAsset(page, superSession.token, asset.id);
  });

  test('VIEWER no puede crear ni editar activos por API', async ({ page }) => {
    const viewerSession = await loginByApi(page, 'VIEWER');
    const superSession = await loginByApi(page, 'SUPER_ADMIN');
    const catalog = await ensureAssetCatalog(page);

    const createDenied = await apiPost(page, viewerSession.token, '/api/assets', {
  tag: uniqueTag('E2E-DENY-VIEWER'),
  name: catalog.assetName,
  categoryId: catalog.categoryId,
  purchaseDate: new Date().toISOString(),
  maintenanceFrequency: 'NO_APLICA',
  lifeState: 'ACTIVE',
});

    expect(
      createDenied.status(),
      `VIEWER no debería crear activos. Respuesta: ${await createDenied.text()}`,
    ).toBe(403);

    const asset = await createAssetByApi({
      page,
      token: superSession.token,
      tag: uniqueTag('E2E-VIEWER-PATCH'),
      name: catalog.assetName,
      categoryId: catalog.categoryId,
    });

    const editDenied = await apiPatch(
      page,
      viewerSession.token,
      `/api/assets/${asset.id}`,
      {
        brand: 'Marca no permitida',
      },
    );

    expect(
      editDenied.status(),
      `VIEWER no debería editar activos. Respuesta: ${await editDenied.text()}`,
    ).toBe(403);

    await cleanupAsset(page, superSession.token, asset.id);
  });

  test('sanity: frontend responde para CRUD de activos', async ({ page }) => {
    await page.goto(FRONTEND_URL, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('body')).toBeVisible();
  });
});