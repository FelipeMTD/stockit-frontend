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

const FRONTEND_URL = process.env.RBAC_FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.RBAC_BACKEND_URL || 'http://localhost:4000';

const ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
  'ADMINISTRATIVO',
  'CONDUCTOR',
  'VIEWER',
];

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

const HOME_BY_ROLE: Record<RoleName, string> = {
  SUPER_ADMIN: '/assets',
  ACTIVOS_FIJOS: '/assets',
  INVENTARIO: '/assets',
  ADMINISTRATIVO: '/assets',
  CONDUCTOR: '/routes',
  VIEWER: '/assets',
};

const ALL_NAV_LABELS = [
  'Inventario',
  'Entregas y Recogidas',
  'Rutas',
  'Población',
  'Poblacion',
  'Reportes',
  'Configuraciones',
];

const EXPECTED_NAV_BY_ROLE: Record<RoleName, RegExp[]> = {
  SUPER_ADMIN: [
    /^Inventario$/i,
    /^Entregas y Recogidas$/i,
    /^Rutas$/i,
    /^Poblaci[oó]n$/i,
    /^Reportes$/i,
    /^Configuraciones$/i,
  ],

  ACTIVOS_FIJOS: [
    /^Inventario$/i,
    /^Entregas y Recogidas$/i,
    /^Rutas$/i,
    /^Poblaci[oó]n$/i,
    /^Reportes$/i,
    /^Configuraciones$/i,
  ],

  INVENTARIO: [
    /^Inventario$/i,
    /^Entregas y Recogidas$/i,
    /^Rutas$/i,
    /^Poblaci[oó]n$/i,
    /^Reportes$/i,
  ],

  ADMINISTRATIVO: [/^Inventario$/i, /^Reportes$/i],

  CONDUCTOR: [/^Rutas$/i],

  VIEWER: [/^Inventario$/i],
};

const ASSET_MANAGE_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
];

const ASSET_READONLY_ROLES: RoleName[] = ['ADMINISTRATIVO', 'VIEWER'];

const REPORT_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
  'ADMINISTRATIVO',
];

const PEOPLE_EXPORT_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
];

const PEOPLE_MANAGE_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
];

const HANDOVER_MANAGE_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
];

const SETTINGS_MANAGE_ROLES: RoleName[] = ['SUPER_ADMIN', 'ACTIVOS_FIJOS'];

function assertEnv() {
  const missing: string[] = [];

  for (const [role, credentials] of Object.entries(USERS)) {
    if (!credentials.documentId) {
      missing.push(`RBAC_${role}_DOC`);
    }

    if (!credentials.password) {
      missing.push(`RBAC_${role}_PASS`);
    }
  }

  if (missing.length) {
    throw new Error(`Faltan variables RBAC:\n${missing.join('\n')}`);
  }
}

async function installAuthMeMock(page: Page, user: any) {
  await page.route('**/*auth/me**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();

    const corsHeaders = {
      'access-control-allow-origin': FRONTEND_URL,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers':
        'authorization,content-type,x-requested-with',
      vary: 'Origin',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
        body: '',
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(user),
      });
      return;
    }

    await route.continue();
  });
}

async function loginAs(page: Page, role: RoleName) {
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
    throw new Error(`Login API falló. HTTP ${res.status()}. ${text}`);
  }

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Login API no devolvió JSON válido: ${text}`);
  }

  const token = data.accessToken || data.token;
  const user = data.user;

  if (!token) {
    throw new Error('Login API no devolvió accessToken/token.');
  }

  if (!user?.role) {
    throw new Error('Login API no devolvió user.role.');
  }

  if (user.role !== role) {
    throw new Error(`Rol inesperado. Esperado=${role}, recibido=${user.role}`);
  }

  /**
   * No mockeamos /api/auth/me.
   * AppShell debe validar contra el backend real, igual que la suite rbac-ui.
   */
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
      injectedToken: token,
      injectedUser: user,
    },
  );
}

async function getPageDebug(page: Page) {
  const currentUrl = page.url();
  const currentPath = new URL(currentUrl).pathname;
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const navText = await page.locator('nav').innerText().catch(() => '');

  return {
    currentUrl,
    currentPath,
    bodyText,
    bodyPreview: bodyText.slice(0, 1_500),
    navText,
    navPreview: navText.slice(0, 1_000),
  };
}

async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);

  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.innerText || '';
        const accessToken = localStorage.getItem('access_token');
        const userRole = localStorage.getItem('user_role');

        const authLoading =
          /cargando sesión|verificando usuario|redirigiendo/i.test(bodyText);

        return Boolean(accessToken && userRole && !authLoading);
      },
      undefined,
      {
        timeout: 15_000,
        polling: 250,
      },
    );
  } catch (error) {
    const debug = await getPageDebug(page);

    const storage = await page.evaluate(() => ({
      access_token: localStorage.getItem('access_token'),
      user_role: localStorage.getItem('user_role'),
      user: localStorage.getItem('user'),
      pathname: window.location.pathname,
    }));

    const wrapped = new Error(
      [
        'La app no salió del estado de carga de sesión.',
        '',
        `URL actual: ${debug.currentUrl}`,
        `Path actual: ${debug.currentPath}`,
        '',
        'LOCAL STORAGE:',
        JSON.stringify(storage, null, 2),
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

async function gotoApp(page: Page, path: string) {
  try {
    await page.goto(path, {
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
      `path solicitado: ${path}`,
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
      timeout: 10_000,
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

function nav(page: Page) {
  return page.locator('nav');
}

function navLink(page: Page, name: RegExp) {
  return nav(page).getByRole('link', {
    name,
  });
}

test.describe('RBAC actions', () => {
  test.beforeAll(() => {
    assertEnv();
  });

  test.describe.skip('Menú por rol', () => {
  for (const role of ROLES) {
    test(`${role} ve solo las opciones de navegación permitidas`, async ({
      page,
    }) => {
      await loginAs(page, role);
      await gotoApp(page, HOME_BY_ROLE[role]);

      const expected = EXPECTED_NAV_BY_ROLE[role];

      for (const expectedLabel of expected) {
        await expectVisible(
          page,
          navLink(page, expectedLabel),
          `${role} debería ver el menú ${expectedLabel}`,
        );
      }

      for (const label of ALL_NAV_LABELS) {
        const labelRegex = new RegExp(`^${label}$`, 'i');

        const shouldExist = expected.some((expectedRegex) =>
          expectedRegex.test(label),
        );

        if (!shouldExist) {
          await expectAbsent(
            page,
            navLink(page, labelRegex),
            `${role} NO debería ver el menú ${label}`,
          );
        }
      }
    });
  }
});

  test.describe('Inventario - acciones de gestión', () => {
    for (const role of ASSET_MANAGE_ROLES) {
      test(`${role} ve acciones de crear, importar y trasladar activos`, async ({
        page,
      }) => {
        await loginAs(page, role);
        await gotoApp(page, '/assets');

        await expectVisible(
          page,
          page.getByRole('link', {
            name: /^Crear activo$/i,
          }),
          `${role} debería ver Crear activo`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /^Importar CSV$/i,
          }),
          `${role} debería ver Importar CSV`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /^Traslados$/i,
          }),
          `${role} debería ver Traslados`,
        );
      });

      test(`${role} puede abrir la página de nuevo activo`, async ({ page }) => {
        await loginAs(page, role);
        await gotoApp(page, '/assets/new');

        await expectVisible(
          page,
          page.getByRole('heading', {
            name: /nuevo activo/i,
          }),
          `${role} debería entrar a Nuevo Activo`,
        );
      });

      test(`${role} puede abrir la página de importación de activos`, async ({
        page,
      }) => {
        await loginAs(page, role);
        await gotoApp(page, '/assets/import');

        await expectVisible(
  page,
  page.getByTestId('import-assets-page'),
  `${role} debería entrar a Importar activos`,
);

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /subir archivo/i,
          }),
          `${role} debería ver Subir archivo`,
        );
      });
    }

    for (const role of ASSET_READONLY_ROLES) {
      test(`${role} NO ve acciones de gestión de activos`, async ({ page }) => {
        await loginAs(page, role);
        await gotoApp(page, '/assets');

        await expectAbsent(
          page,
          page.getByRole('link', {
            name: /^Crear activo$/i,
          }),
          `${role} NO debería ver Crear activo`,
        );

        await expectAbsent(
          page,
          page.getByRole('button', {
            name: /^Importar CSV$/i,
          }),
          `${role} NO debería ver Importar CSV`,
        );

        await expectAbsent(
          page,
          page.getByRole('button', {
            name: /^Traslados$/i,
          }),
          `${role} NO debería ver Traslados`,
        );
      });
    }
  });

  test.describe('Reportes - acciones de exportación', () => {
    for (const role of REPORT_ROLES) {
      test(`${role} ve exportaciones básicas de inventario y movimientos`, async ({
        page,
      }) => {
        await loginAs(page, role);
        await gotoApp(page, '/reportes');

        await expectVisible(
          page,
          page.getByRole('heading', {
            name: /^Reportes$/i,
          }),
          `${role} debería entrar a Reportes`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /descargar inventario/i,
          }),
          `${role} debería ver Descargar inventario`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /descargar movimientos/i,
          }),
          `${role} debería ver Descargar movimientos`,
        );
      });
    }

    for (const role of PEOPLE_EXPORT_ROLES) {
      test(`${role} ve exportación de población`, async ({ page }) => {
        await loginAs(page, role);
        await gotoApp(page, '/reportes');

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /descargar poblaci[oó]n/i,
          }),
          `${role} debería ver Descargar población`,
        );
      });
    }

    test('ADMINISTRATIVO NO ve exportación de población', async ({ page }) => {
      await loginAs(page, 'ADMINISTRATIVO');
      await gotoApp(page, '/reportes');

      await expectAbsent(
        page,
        page.getByRole('button', {
          name: /descargar poblaci[oó]n/i,
        }),
        'ADMINISTRATIVO NO debería ver Descargar población',
      );
    });
  });

  test.describe('Población - acciones de gestión', () => {
    for (const role of PEOPLE_MANAGE_ROLES) {
      test(`${role} ve acciones de población`, async ({ page }) => {
        await loginAs(page, role);
        await gotoApp(page, '/people');

        await expectVisible(
          page,
          page.getByRole('heading', {
            name: /poblaci[oó]n/i,
          }),
          `${role} debería entrar a Población`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /^Importar$/i,
          }),
          `${role} debería ver Importar población`,
        );

        await expectVisible(
          page,
          page.getByRole('heading', {
            name: /nuevo usuario/i,
          }),
          `${role} debería ver formulario de Nuevo usuario en población`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /crear usuario/i,
          }),
          `${role} debería ver Crear usuario`,
        );
      });
    }
  });

  test.describe('Entregas y Recogidas - acciones de gestión', () => {
    for (const role of HANDOVER_MANAGE_ROLES) {
      test(`${role} ve acción de nuevo registro`, async ({ page }) => {
        await loginAs(page, role);
        await gotoApp(page, '/entregas');

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /nuevo registro/i,
          }),
          `${role} debería ver Nuevo Registro`,
        );
      });
    }
  });

  test.describe('Configuraciones - acciones administrativas', () => {
    for (const role of SETTINGS_MANAGE_ROLES) {
      test(`${role} puede gestionar configuraciones`, async ({ page }) => {
        await loginAs(page, role);
        await gotoApp(page, '/settings');

        await expectVisible(
          page,
          page.getByRole('heading', {
            name: /configuraciones/i,
          }),
          `${role} debería entrar a Configuraciones`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /categor[ií]as y activos/i,
          }),
          `${role} debería ver Categorías y Activos`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /ubicaciones y sedes/i,
          }),
          `${role} debería ver Ubicaciones y Sedes`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /usuarios del sistema/i,
          }),
          `${role} debería ver Usuarios del sistema`,
        );

        await page
          .getByRole('button', {
            name: /usuarios del sistema/i,
          })
          .click();

        await expectVisible(
          page,
          page.getByRole('heading', {
            name: /nuevo usuario/i,
          }),
          `${role} debería ver formulario Nuevo usuario en Configuraciones`,
        );

        await expectVisible(
          page,
          page.getByRole('button', {
            name: /^Guardar$/i,
          }).first(),
          `${role} debería ver botón Guardar en Configuraciones`,
        );
      });
    }
  });

  test('sanity: frontend responde para acciones RBAC', async ({ page }) => {
    await page.goto(FRONTEND_URL, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('body')).toBeVisible();
  });
});