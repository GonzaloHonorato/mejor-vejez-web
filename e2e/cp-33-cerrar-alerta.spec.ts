import { expect, test } from '@playwright/test';

import { requerida, selloDeTiempo } from './apoyo/entorno';
import { Evidencia } from './apoyo/evidencia';
import { ingresar } from './apoyo/sesion';

/**
 * CP-33 (HU-09) — Cierre de alerta con observación obligatoria. Usa la
 * primera alerta abierta del grupo activo de la cuenta (debe ser su
 * coordinador); si no hay ninguna, la prueba se omite con el motivo.
 *
 * En pantalla, "Cerrar alerta" queda deshabilitado mientras la observación
 * esté vacía o tenga solo espacios. Que la API también rechace el cierre sin
 * observación lo prueba `ServicioCierreAlertasTest` del core.
 */
test.describe('CP-33 Cierre con observación obligatoria', () => {
  test('coordinadorCierraAlertaConObservacion', async ({ page }, info) => {
    const correo = requerida('MEJOR_VEJEZ_ADMIN_CORREO');
    const clave = requerida('MEJOR_VEJEZ_ADMIN_CLAVE');
    const observacion = `Revisada en la prueba automática CP-33 (${selloDeTiempo()}).`;
    const evidencia = new Evidencia('CP-33', info);

    await test.step('Ingresa y abre la bandeja de alertas abiertas', async () => {
      await ingresar(page, correo, clave);
      await page.goto('/alertas');
      await expect(page.getByRole('button', { name: /Abiertas/ })).toHaveAttribute('aria-pressed', 'true');
    });

    const filas = page.locator('tr.fila-alerta');
    await expect(filas.first().or(page.locator('.mv-vacio'))).toBeVisible();
    test.skip((await filas.count()) === 0, 'No hay alertas abiertas en el grupo activo.');
    await evidencia.capturar(page, 'alertas-abiertas');

    let idAlerta = '';
    await test.step('1. Consulta una alerta abierta', async () => {
      await filas.first().locator('a.mv-fila__enlace').click();
      await page.waitForURL(/\/alertas\/\d+$/);
      idAlerta = page.url().split('/').pop() ?? '';
      info.annotations.push({ type: 'alerta', description: idAlerta });
      await expect(page.locator('[data-prueba="estado-alerta"]')).toHaveText('Abierta');
    });

    const campo = page.getByLabel('Observación');
    const botonCerrar = page.getByRole('button', { name: 'Cerrar alerta' });

    await test.step('2-3. Sin observación (o solo espacios) no se puede cerrar', async () => {
      await expect(campo).toHaveValue('');
      await expect(botonCerrar).toBeDisabled();
      await campo.fill('   ');
      await expect(botonCerrar).toBeDisabled();
      await evidencia.capturar(page, 'cierre-sin-observacion-deshabilitado');
    });

    await test.step('4-5. Con observación se cierra y queda en estado Cerrada', async () => {
      await campo.fill(observacion);
      await expect(botonCerrar).toBeEnabled();
      await botonCerrar.click();
      await expect(page.getByRole('status').filter({ hasText: 'Alerta cerrada.' })).toBeVisible();
      await expect(page.locator('[data-prueba="estado-alerta"]')).toHaveText('Cerrada');
    });

    await test.step('6. Registra quién la cerró, cuándo y la observación', async () => {
      const revision = page.locator('section', { has: page.getByRole('heading', { name: 'Alerta cerrada' }) });
      await expect(revision).toContainText(observacion);
      // "Nombre · dd-mm-aaaa hh:mm": el actor y la fecha y hora del cierre.
      await expect(revision.locator('p.texto-libre').first()).toHaveText(/\S.*·.*\d{1,2}:\d{2}/);
      await evidencia.capturar(page, 'alerta-cerrada-con-revisor');
    });

    await test.step('La alerta queda disponible en el historial de cerradas', async () => {
      await page.goto('/alertas');
      await page.getByRole('button', { name: /Cerradas/ }).click();
      const fila = page.locator('tr.fila-alerta', { has: page.locator(`a[href="/alertas/${idAlerta}"]`) });
      await expect(fila).toHaveCount(1);
      await expect(fila).toContainText('Cerrada');
      await evidencia.capturar(page, 'historial-cerradas');
    });
  });
});
