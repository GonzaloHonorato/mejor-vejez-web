import { Page, expect } from '@playwright/test';

/** Ingresa con correo y contraseña (Firebase) y espera el inicio ("Hola, …"). */
export async function ingresar(pagina: Page, correo: string, clave: string): Promise<void> {
  await pagina.goto('/ingreso');
  await pagina.getByLabel('Correo electrónico').fill(correo);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(clave);
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await expect(pagina.getByRole('heading', { level: 1, name: /^Hola/ })).toBeVisible();
}
