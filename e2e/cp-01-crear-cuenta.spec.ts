import { Browser, Page, expect, test } from '@playwright/test';

import { correoUnico, requerida, selloDeTiempo } from './apoyo/entorno';
import { Evidencia } from './apoyo/evidencia';
import { ingresar } from './apoyo/sesion';

/**
 * CP-01 (HU-01) — Crear cuenta con datos válidos. No hay registro público:
 * la cuenta la crea el administrador en "Administración de usuarios" y la
 * persona entra con la contraseña temporal (proveedor de identidad real,
 * Firebase). Que se conserve el UID y que no se guarde contraseña local lo
 * prueban `ServicioAltaCuentasTest` y `ServicioUsuarioActualTest` del core.
 *
 * Cada corrida usa un correo nuevo (alias "+" del buzón de pruebas) y al
 * final desactiva la cuenta creada.
 */
test.describe('CP-01 Crear cuenta con datos válidos', () => {
  test('administradorCreaCuentaYLaPersonaIngresa', async ({ browser }, info) => {
    const correoAdmin = requerida('MEJOR_VEJEZ_ADMIN_CORREO');
    const claveAdmin = requerida('MEJOR_VEJEZ_ADMIN_CLAVE');
    const buzon = requerida('MEJOR_VEJEZ_CORREO_PRUEBAS');

    const sello = selloDeTiempo();
    const nombre = `Prueba CP-01 ${sello}`;
    const correo = correoUnico(buzon, 'cp01', sello);
    const evidencia = new Evidencia('CP-01', info);
    info.annotations.push({ type: 'cuenta', description: correo });

    const admin = await nuevaPagina(browser);
    let cuentaCreada = false;
    try {
      await test.step('1. El administrador ingresa y abre Administración de usuarios', async () => {
        await ingresar(admin, correoAdmin, claveAdmin);
        await admin.goto('/administracion/usuarios');
        await expect(admin.getByRole('heading', { level: 1, name: 'Administración de usuarios' })).toBeVisible();
      });

      await test.step('2-3. Ingresa los campos obligatorios y un correo válido', async () => {
        await admin.getByRole('button', { name: 'Crear usuario' }).first().click();
        const formulario = admin.locator('#usuarios-crear form');
        await formulario.getByLabel('Nombre').fill(nombre);
        await formulario.getByLabel('Correo').fill(correo);
        await evidencia.capturar(admin, 'formulario-completo');
      });

      let claveTemporal = '';
      await test.step('5. Confirma el registro: la cuenta queda creada con contraseña temporal', async () => {
        await admin.locator('#usuarios-crear form').getByRole('button', { name: 'Crear usuario' }).click();
        const dialogo = admin.getByRole('dialog', { name: 'Cuenta creada' });
        await expect(dialogo).toBeVisible();
        cuentaCreada = true;
        const clave = dialogo.locator('.clave-temporal__clave');
        claveTemporal = (await clave.innerText()).trim();
        expect(claveTemporal.length).toBeGreaterThanOrEqual(8);
        // El correo con la contraseña salió: si no, el diálogo lo avisa.
        await expect(dialogo.getByText('No pudimos enviar el correo')).toHaveCount(0);
        await evidencia.capturar(admin, 'cuenta-creada-clave-tapada', [clave]);
        await dialogo.getByRole('button', { name: 'Cerrar' }).click();
      });

      await test.step('6. Consulta la cuenta creada: aparece activa y no es administradora', async () => {
        const fila = await buscarUsuario(admin, correo);
        await expect(fila.locator('.usuario__nombre')).toHaveText(nombre);
        await expect(fila.locator('.usuario__estado')).toHaveText('Activo');
        await expect(fila.locator('.usuario__rol')).toHaveText('Integrante');
        await evidencia.capturar(admin, 'cuenta-consultada-activa');
      });

      await test.step('4. La persona completa la autenticación con el proveedor (Firebase)', async () => {
        const persona = await nuevaPagina(browser);
        try {
          await ingresar(persona, correo, claveTemporal);
          await expect(persona.getByRole('heading', { level: 1, name: `Hola, ${nombre}` })).toBeVisible();
          await evidencia.capturar(persona, 'persona-ingresa');
        } finally {
          await persona.context().close();
        }
      });
    } finally {
      if (cuentaCreada) {
        await test.step('Limpieza: desactivar la cuenta de prueba', async () => {
          const fila = await buscarUsuario(admin, correo);
          await fila.getByRole('button', { name: `Más acciones para ${nombre}` }).click();
          await fila.getByRole('menuitem', { name: 'Desactivar' }).click();
          await expect((await buscarUsuario(admin, correo)).locator('.usuario__estado')).toHaveText('Inactivo');
          await evidencia.capturar(admin, 'limpieza-cuenta-desactivada');
        });
      }
      await admin.context().close();
    }
  });
});

/** Cada persona en su propio contexto: sesiones de Firebase separadas. */
async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  return contexto.newPage();
}

async function buscarUsuario(pagina: Page, correo: string) {
  await pagina.getByLabel('Buscar por nombre o correo').fill(correo);
  await pagina.getByRole('button', { name: 'Buscar', exact: true }).click();
  const fila = pagina.locator('tr.usuario', { has: pagina.locator('.usuario__correo', { hasText: correo }) });
  await expect(fila).toHaveCount(1);
  return fila;
}
