import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { Locator, Page, TestInfo } from '@playwright/test';

/**
 * Capturas numeradas de un caso: `CP-01_01_descripcion.png`, en la carpeta
 * que indique la CLI (`MEJOR_VEJEZ_E2E_EVIDENCIA`) y adjuntas al informe de
 * Playwright. `tapar` cubre elementos sensibles (la contraseña temporal).
 */
export class Evidencia {
  private numero = 0;
  private readonly carpeta: string;

  constructor(
    private readonly cp: string,
    private readonly info: TestInfo,
  ) {
    this.carpeta = process.env['MEJOR_VEJEZ_E2E_EVIDENCIA'] ?? join('e2e', 'resultados', 'evidencia');
    mkdirSync(this.carpeta, { recursive: true });
  }

  async capturar(pagina: Page, descripcion: string, tapar: Locator[] = []): Promise<void> {
    this.numero += 1;
    const nombre = `${this.cp}_${String(this.numero).padStart(2, '0')}_${descripcion}.png`;
    const ruta = join(this.carpeta, nombre);
    // Arriba antes de la captura completa: si no, la barra lateral fija sale corrida.
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.screenshot({ path: ruta, fullPage: true, mask: tapar, maskColor: '#0B2545' });
    await this.info.attach(nombre, { path: ruta, contentType: 'image/png' });
  }
}
