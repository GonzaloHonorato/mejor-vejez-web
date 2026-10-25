import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { Ingreso } from './ingreso';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

function configurar(ingresarConCorreo: ReturnType<typeof vi.fn>, volver: string | null = null) {
  TestBed.configureTestingModule({
    imports: [Ingreso],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(volver ? { volver } : {}) } },
      },
      {
        provide: ServicioAutenticacion,
        useValue: {
          habilitado: true,
          usuario: signal(null),
          listo: signal(true),
          ingresarConCorreo,
          ingresarConGoogle: vi.fn(),
        },
      },
    ],
  });
}

async function enviarFormulario(correo: string, clave: string) {
  const fixture = TestBed.createComponent(Ingreso);
  await fixture.whenStable();
  const elemento = fixture.nativeElement as HTMLElement;
  const campoCorreo = elemento.querySelector<HTMLInputElement>('input[type="email"]')!;
  const campoClave = elemento.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')!;
  campoCorreo.value = correo;
  campoCorreo.dispatchEvent(new Event('input'));
  campoClave.value = clave;
  campoClave.dispatchEvent(new Event('input'));
  elemento.querySelector('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
  return fixture;
}

describe('Ingreso', () => {
  it('muestraMensajeConCredencialesInvalidas', async () => {
    configurar(vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' }));

    const fixture = await enviarFormulario('ana@correo.cl', 'clave-mala');

    const alerta = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Correo o contraseña incorrectos.');
  });

  it('redirigeAlVolverTrasIngresar', async () => {
    const ingresar = vi.fn().mockResolvedValue(undefined);
    configurar(ingresar, '/estado');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await enviarFormulario('ana@correo.cl', 'clave-buena');

    expect(ingresar).toHaveBeenCalledWith('ana@correo.cl', 'clave-buena');
    expect(navegar).toHaveBeenCalledWith('/estado');
  });
});
