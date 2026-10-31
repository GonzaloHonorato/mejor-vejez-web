import { Route } from '@angular/router';

import { routes } from './app.routes';

function titulos(rutas: readonly Route[]): unknown[] {
  return rutas.flatMap((ruta) => [
    ...(ruta.title === undefined ? [] : [ruta.title]),
    ...titulos(ruta.children ?? []),
  ]);
}

describe('rutas', () => {
  it('cadaTituloDeRutaTerminaEnLaMarca', () => {
    const lista = titulos(routes);

    expect(lista.length).toBeGreaterThanOrEqual(19);
    for (const titulo of lista) {
      expect(typeof titulo).toBe('string');
      expect(titulo as string).toMatch(/^\S.* · Cuida\+$/);
      expect(titulo as string).not.toContain('Mejor Vejez');
    }
  });
});
