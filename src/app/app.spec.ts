import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';

@Component({ template: '<p class="pagina-ficticia">Página</p>' })
class PaginaFicticia {}

async function crearApp() {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([
        { path: '', component: PaginaFicticia },
        { path: 'bloqueada', component: PaginaFicticia, canActivate: [() => false] },
        { path: 'rota', loadComponent: () => Promise.reject(new Error('sin red')) },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return {
    fixture,
    elemento: fixture.nativeElement as HTMLElement,
    router: TestBed.inject(Router),
  };
}

describe('App', () => {
  it('muestraElEsqueletoAntesDeLaPrimeraNavegacionYLoQuitaDespues', async () => {
    const { fixture, elemento, router } = await crearApp();

    const esqueleto = elemento.querySelector('.esqueleto-marco');
    expect(esqueleto).toBeTruthy();
    expect(esqueleto!.getAttribute('role')).toBe('status');
    expect(esqueleto!.textContent).toContain('Cargando Cuida+');
    expect(esqueleto!.querySelectorAll('.mv-esqueleto').length).toBeGreaterThan(0);
    expect(elemento.querySelector('router-outlet')).toBeTruthy();

    await router.navigateByUrl('/');
    await fixture.whenStable();

    expect(elemento.querySelector('.esqueleto-marco')).toBeNull();
    expect(elemento.querySelector('.pagina-ficticia')).toBeTruthy();
  });

  it('quitaElEsqueletoSiLaPrimeraNavegacionSeCancela', async () => {
    const { fixture, elemento, router } = await crearApp();

    await router.navigateByUrl('/bloqueada');
    await fixture.whenStable();

    expect(elemento.querySelector('.esqueleto-marco')).toBeNull();
  });

  it('quitaElEsqueletoSiLaPrimeraNavegacionFalla', async () => {
    const { fixture, elemento, router } = await crearApp();

    await router.navigateByUrl('/rota').catch(() => undefined);
    await fixture.whenStable();

    expect(elemento.querySelector('.esqueleto-marco')).toBeNull();
  });
});
