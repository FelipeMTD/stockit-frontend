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

const ACCESS_MATRIX: Record<
  RoleName,
  {
    allow: string[];
    deny: string[];
  }
> = {
  SUPER_ADMIN: {
    allow: [
      '/assets',
      '/assets/new',
      '/assets/import',
      '/people',
      '/entregas',
      '/routes',
      '/reportes',
      '/settings',
    ],
    deny: [],
  },

  ACTIVOS_FIJOS: {
    allow: [
      '/assets',
      '/assets/new',
      '/assets/import',
      '/people',
      '/entregas',
      '/routes',
      '/reportes',
      '/settings',
    ],
    deny: [],
  },

  INVENTARIO: {
    allow: [
      '/assets',
      '/assets/new',
      '/assets/import',
      '/people',
      '/entregas',
      '/routes',
      '/reportes',
    ],
    deny: ['/settings'],
  },

  ADMINISTRATIVO: {
    allow: ['/assets', '/reportes'],
    deny: [
      '/assets/new',
      '/assets/import',
      '/people',
      '/entregas',
      '/routes',
      '/settings',
    ],
  },

  CONDUCTOR: {
    allow: ['/routes'],
    deny: [
      '/assets',
      '/assets/new',
      '/assets/import',
      '/people',
      '/entregas',
      '/reportes',
      '/settings',
    ],
  },

  VIEWER: {
    allow: ['/assets'],
    deny: [
      '/assets/new',
      '/assets/import',
      '/people',
      '/entregas',
      '/routes',
      '/reportes',
      '/settings',
    ],
  },
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

/**
 * Login estable para pruebas RBAC:
 * - NO usa formulario.
 * - Hace login directo contra backend.
 * - Guarda token y usuario en localStorage con varias claves compatibles.
 * - Deja cookie httpOnly si backend la retorna.
 */
async function loginAs(page: Page, role: RoleName) {
  const credentials = USERS[role];

  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
  });

  await page.evaluate(
    async ({ backendUrl, documentId, password, expectedRole }) => {
      localStorage.clear();
      sessionStorage.clear();

      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          documentId,
          password,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(`Login API falló. HTTP ${res.status}. ${text}`);
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

      if (user.role !== expectedRole) {
        throw new Error(
          `Rol inesperado. Esperado=${expectedRole}, recibido=${user.role}`,
        );
      }

      /**
       * Se guardan varias claves para cubrir interceptores/guards existentes.
       * Luego, si decides limpiar deuda técnica, deja una sola clave oficial.
       */
      localStorage.setItem('user_role', user.role);
      localStorage.setItem('accessToken', token);
      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('jwt', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('auth_user', JSON.stringify(user));
    },
    {
      backendUrl: BACKEND_URL,
      documentId: credentials.documentId,
      password: credentials.password,
      expectedRole: role,
    },
  );

  await page.waitForFunction(
    (expectedRole) => localStorage.getItem('user_role') === expectedRole,
    role,
    {
      timeout: 5_000,
    },
  );

  const storedRole = await page.evaluate(() => localStorage.getItem('user_role'));
  expect(storedRole).toBe(role);
}

async function waitForSettledRoute(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(1_200);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function getPageDiagnostics(page: Page) {
  const currentUrl = page.url();
  const currentPath = new URL(currentUrl).pathname;
  const bodyText = await page.locator('body').innerText().catch(() => '');

  return {
    currentUrl,
    currentPath,
    bodyText,
    bodyPreview: bodyText.slice(0, 1_000),
  };
}

async function assertAllowed(page: Page, path: string) {
  await page.goto(path, {
    waitUntil: 'domcontentloaded',
  });

  await waitForSettledRoute(page);

  const diag = await getPageDiagnostics(page);

  expect(
    diag.currentPath,
    [
      'Ruta permitida terminó en una URL inválida.',
      `path solicitado: ${path}`,
      `url actual: ${diag.currentUrl}`,
      `body: ${diag.bodyPreview}`,
    ].join('\n'),
  ).not.toBe('/login');

  expect(
    diag.bodyText,
    [
      'Ruta permitida mostró mensaje de permisos.',
      `path solicitado: ${path}`,
      `url actual: ${diag.currentUrl}`,
      `body: ${diag.bodyPreview}`,
    ].join('\n'),
  ).not.toMatch(/no tienes permisos|acceso denegado|unauthorized|forbidden/i);
}

async function assertDenied(page: Page, path: string) {
  await page.goto(path, {
    waitUntil: 'domcontentloaded',
  });

  /**
   * Esperamos hasta que ocurra una de estas cosas:
   * 1. La ruta cambió: hubo redirect.
   * 2. Apareció mensaje de denegación.
   * 3. La pantalla dejó de estar en "Cargando sesión…" y aun así sigue en la ruta prohibida.
   *
   * Ojo: waitForFunction debe retornar boolean, no objeto.
   */
  await page
    .waitForFunction(
      (requestedPath) => {
        const currentPath = window.location.pathname;
        const bodyText = document.body?.innerText || '';

        const redirectedAway = currentPath !== requestedPath;

        const showedDeniedMessage =
          /no tienes permisos|acceso denegado|unauthorized|forbidden/i.test(
            bodyText,
          );

        const stillLoading = /cargando sesión|cargando/i.test(bodyText);

        if (redirectedAway || showedDeniedMessage) {
          return true;
        }

        if (!stillLoading && currentPath === requestedPath) {
          return true;
        }

        return false;
      },
      path,
      {
        timeout: 12_000,
        polling: 250,
      },
    )
    .catch(() => undefined);

  const diag = await getPageDiagnostics(page);

  const redirectedAway = diag.currentPath !== path;

  const showedDeniedMessage =
    /no tienes permisos|acceso denegado|unauthorized|forbidden/i.test(
      diag.bodyText,
    );

  const stillLoading = /cargando sesión|cargando/i.test(diag.bodyText);

  expect(
    redirectedAway || showedDeniedMessage,
    [
      'Ruta denegada NO fue bloqueada.',
      `path solicitado: ${path}`,
      `url actual: ${diag.currentUrl}`,
      `currentPath: ${diag.currentPath}`,
      `redirectedAway: ${redirectedAway}`,
      `showedDeniedMessage: ${showedDeniedMessage}`,
      `stillLoading: ${stillLoading}`,
      `body: ${diag.bodyPreview}`,
    ].join('\n'),
  ).toBeTruthy();
}

test.describe('RBAC UI por rol', () => {
  test.beforeAll(() => {
    assertEnv();
  });

  for (const role of Object.keys(ACCESS_MATRIX) as RoleName[]) {
    test.describe(role, () => {
      test.beforeEach(async ({ page }) => {
        await loginAs(page, role);
      });

      for (const path of ACCESS_MATRIX[role].allow) {
        test(`permite navegar a ${path}`, async ({ page }) => {
          await assertAllowed(page, path);
        });
      }

      for (const path of ACCESS_MATRIX[role].deny) {
        test(`bloquea navegación directa a ${path}`, async ({ page }) => {
          await assertDenied(page, path);
        });
      }
    });
  }
});

test('sanity: frontend responde', async ({ page }) => {
  await page.goto(FRONTEND_URL, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.locator('body')).toBeVisible();
});