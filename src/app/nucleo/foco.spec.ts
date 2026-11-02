import { Component, ElementRef, Injector, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { dentroDe, enfocarPrimerCampoInvalido } from './foco';

@Component({
  template: `
    <form id="otro"><input id="fuera" aria-invalid="true" /></form>
    <form id="principal">
      <input id="valido" />
      <input id="primero" [attr.aria-invalid]="invalido() ? true : null" />
      <input id="segundo" aria-invalid="true" />
    </form>
  `,
})
class Prueba {
  readonly invalido = signal(false);
  readonly host = inject(ElementRef<HTMLElement>);
  readonly injector = inject(Injector);

  enviar(): void {
    this.invalido.set(true);
    enfocarPrimerCampoInvalido(dentroDe(this.host, '#principal'), this.injector);
  }
}

describe('enfocarPrimerCampoInvalido', () => {
  it('enfocaElPrimerCampoInvalidoDelContenedorTrasElRender', async () => {
    const fixture = TestBed.createComponent(Prueba);
    await fixture.whenStable();

    fixture.componentInstance.enviar();
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('primero');
  });

  it('sinCamposInvalidosNoMueveElFoco', async () => {
    const fixture = TestBed.createComponent(Prueba);
    await fixture.whenStable();
    const valido = fixture.nativeElement.querySelector('#valido') as HTMLInputElement;
    valido.focus();

    enfocarPrimerCampoInvalido(
      dentroDe(fixture.componentInstance.host, '#nada'),
      fixture.componentInstance.injector,
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(valido);
  });
});
