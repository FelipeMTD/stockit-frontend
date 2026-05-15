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

type ReportCase = {
  key: 'inventory' | 'movements' | 'people';
  label: string;
  apiPath: string;
  buttonName: RegExp;
  expectedHeaders: string[];
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

const REPORTS: Record<ReportCase['key'], ReportCase> = {
  inventory: {
    key: 'inventory',
    label: 'inventario',
    apiPath: '/api/reports/inventory.csv',
    buttonName: /descargar inventario/i,
    expectedHeaders: [
      'ACTIVOFIJO',
      'NOMBRE',
      'MARCA',
      'MODELO',
      'SERIAL',
      'CATEGORIA',
      'TIPODEADQUISICION',
      'NIVEL DE RIESGO',
      'ESTADOACTIVO',
      'SEDE',
      'BODEGA ASIGNADA',
      'ESTADO',
      'DOCUMENTO CUSTODIO',
      'NOMBRE CUSTODIO',
      'DIRECCIONCUSTODIO',
      'EPSCUSTODIO',
      'FECHA ACTIVO',
      'VALORACTIVO',
    ],
  },

  movements: {
    key: 'movements',
    label: 'movimientos',
    apiPath: '/api/reports/movements.csv',
    buttonName: /descargar movimientos/i,
    expectedHeaders: [
      'FECHA',
      'TIPO_MOVIMIENTO',
      'CODIGO_ACTIVO',
      'NOMBRE_ACTIVO',
      'CANTIDAD',
      'BODEGA_ORIGEN',
      'BODEGA_DESTINO',
      'CUSTODIO_ORIGEN',
      'CUSTODIO_DESTINO',
      'REFERENCIA',
      'NOTAS',
      'ADMINISTRADOR',
    ],
  },

  people: {
    key: 'people',
    label: 'población',
    apiPath: '/api/reports/people.csv',
    buttonName: /descargar poblaci[oó]n/i,
    expectedHeaders: [
      'NOMBRE_COMPLETO',
      'DOCUMENTO',
      'TIPO_USUARIO',
      'AREA',
      'EPS',
      'DEPARTAMENTO',
      'MUNICIPIO',
      'DIRECCION',
      'EMAIL',
      'TELEFONO',
      'ESTADO_ACTUAL',
      'MOTIVO_INACTIVIDAD',
      'FECHA_INACTIVIDAD',
    ],
  },
};

const DOWNLOAD_MATRIX: Record<RoleName, ReportCase['key'][]> = {
  SUPER_ADMIN: ['inventory', 'movements', 'people'],
  ACTIVOS_FIJOS: ['inventory', 'movements', 'people'],
  INVENTARIO: ['inventory', 'movements', 'people'],
  ADMINISTRATIVO: ['inventory', 'movements'],
  CONDUCTOR: [],
  VIEWER: [],
};

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

function normalizeCsvText(value: string) {
  return value.replace(/^\uFEFF/, '');
}

function getCsvFirstLine(value: string) {
  return normalizeCsvText(value).split(/\r?\n/)[0] || '';
}

function assertCsvHeaders(params: {
  role: RoleName;
  report: ReportCase;
  csvText: string;
}) {
  const { role, report, csvText } = params;

  const firstLine = getCsvFirstLine(csvText);
  const actualHeaders = firstLine.split(',');

  const missingHeaders = report.expectedHeaders.filter(
    (header) => !actualHeaders.includes(header),
  );

  expect(
    missingHeaders,
    [
      `${role} recibió ${report.label}, pero faltan encabezados.`,
      `Faltan: ${missingHeaders.join(', ')}`,
      `Primera línea: ${firstLine}`,
    ].join('\n'),
  ).toEqual([]);
}

function isReportResponse(url: string, report: ReportCase) {
  return url.includes(report.apiPath);
}

async function clickAndCaptureCsvResponse(params: {
  page: Page;
  button: Locator;
  report: ReportCase;
  role: RoleName;
}) {
  const { page, button, report, role } = params;

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => isReportResponse(res.url(), report),
      {
        timeout: 30_000,
      },
    ),
    button.click(),
  ]);

  const status = response.status();
  const url = response.url();
  const contentType = response.headers()['content-type'] || '';

  expect(
    status,
    `${role} recibió HTTP ${status} al solicitar ${report.label}. URL=${url}`,
  ).toBe(200);

  expect(
    contentType.toLowerCase(),
    `${role} recibió content-type inválido en ${report.label}. URL=${url}`,
  ).toContain('text/csv');

  const csvText = await response.text();

  expect(
    csvText.length,
    `${role} recibió CSV vacío para ${report.label}. URL=${url}`,
  ).toBeGreaterThan(0);

  assertCsvHeaders({
    role,
    report,
    csvText,
  });

  return {
    status,
    url,
    contentType,
    csvText,
  };
}

test.describe('Reportes - descarga real desde UI', () => {
  test.beforeAll(() => {
    assertEnv();
  });

  for (const role of ['SUPER_ADMIN', 'ACTIVOS_FIJOS', 'INVENTARIO'] as RoleName[]) {
    test(`${role} solicita inventario, movimientos y población desde UI`, async ({
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

      for (const reportKey of DOWNLOAD_MATRIX[role]) {
        const report = REPORTS[reportKey];

        await test.step(`${role} solicita ${report.label}`, async () => {
          const button = page.getByRole('button', {
            name: report.buttonName,
          });

          await expectVisible(
            page,
            button,
            `${role} debería ver botón de ${report.label}`,
          );

          await clickAndCaptureCsvResponse({
            page,
            button,
            report,
            role,
          });
        });
      }
    });
  }

  test('ADMINISTRATIVO solicita inventario y movimientos, pero no población', async ({
    page,
  }) => {
    const role: RoleName = 'ADMINISTRATIVO';

    await loginAs(page, role);
    await gotoApp(page, '/reportes');

    await expectVisible(
      page,
      page.getByRole('heading', {
        name: /^Reportes$/i,
      }),
      'ADMINISTRATIVO debería entrar a Reportes',
    );

    for (const reportKey of DOWNLOAD_MATRIX.ADMINISTRATIVO) {
      const report = REPORTS[reportKey];

      await test.step(`ADMINISTRATIVO solicita ${report.label}`, async () => {
        const button = page.getByRole('button', {
          name: report.buttonName,
        });

        await expectVisible(
          page,
          button,
          `ADMINISTRATIVO debería ver botón de ${report.label}`,
        );

        await clickAndCaptureCsvResponse({
          page,
          button,
          report,
          role,
        });
      });
    }

    await expectAbsent(
      page,
      page.getByRole('button', {
        name: REPORTS.people.buttonName,
      }),
      'ADMINISTRATIVO no debería ver Descargar población',
    );
  });

  test('VIEWER no puede entrar a reportes', async ({ page }) => {
    await loginAs(page, 'VIEWER');
    await gotoApp(page, '/reportes');

    const debug = await getPageDebug(page);

    const redirectedAway = debug.currentPath !== '/reportes';
    const deniedMessage =
      /no tienes permisos|acceso denegado|forbidden|unauthorized/i.test(
        debug.bodyText,
      );

    expect(
      redirectedAway || deniedMessage,
      [
        'VIEWER no debería poder usar Reportes.',
        `URL actual: ${debug.currentUrl}`,
        `Path actual: ${debug.currentPath}`,
        `BODY: ${debug.bodyPreview}`,
      ].join('\n'),
    ).toBeTruthy();
  });

  test('CONDUCTOR no puede entrar a reportes', async ({ page }) => {
    await loginAs(page, 'CONDUCTOR');
    await gotoApp(page, '/reportes');

    const debug = await getPageDebug(page);

    const redirectedAway = debug.currentPath !== '/reportes';
    const deniedMessage =
      /no tienes permisos|acceso denegado|forbidden|unauthorized/i.test(
        debug.bodyText,
      );

    expect(
      redirectedAway || deniedMessage,
      [
        'CONDUCTOR no debería poder usar Reportes.',
        `URL actual: ${debug.currentUrl}`,
        `Path actual: ${debug.currentPath}`,
        `BODY: ${debug.bodyPreview}`,
      ].join('\n'),
    ).toBeTruthy();
  });

  test('sanity: frontend responde para reportes', async ({ page }) => {
    await page.goto(FRONTEND_URL, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('body')).toBeVisible();
  });
});