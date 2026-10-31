import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Icono, NOMBRES_ICONO, NombreIcono } from './icono';

@Component({
  imports: [Icono],
  template: `<app-icono [nombre]="nombre()" />`,
})
class Anfitrion {
  readonly nombre = signal<NombreIcono>('panel');
}

describe('Icono', () => {
  it('iconoRenderizaSvgAriaHidden', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    for (const nombre of NOMBRES_ICONO) {
      fixture.componentInstance.nombre.set(nombre);
      await fixture.whenStable();

      const svg = elemento.querySelector('svg');
      expect(svg, nombre).toBeTruthy();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
      expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg!.getAttribute('fill')).toBe('none');
      expect(svg!.getAttribute('stroke')).toBe('currentColor');
      expect(svg!.getAttribute('stroke-width')).toBe('2');
      expect(svg!.getAttribute('stroke-linecap')).toBe('round');
      expect(svg!.getAttribute('stroke-linejoin')).toBe('round');
      // Cada ícono dibuja algo (no un cuadro vacío).
      expect(svg!.children.length, nombre).toBeGreaterThan(0);
    }
  });

  it('incluyeLasFlechasDelNavegadorDeFecha', () => {
    expect(NOMBRES_ICONO).toContain('flecha-izquierda');
    expect(NOMBRES_ICONO).toContain('flecha-derecha');
  });
});
