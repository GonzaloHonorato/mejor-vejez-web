import { FormControl, Validators } from '@angular/forms';

import {
  MENSAJE_FECHA_FUTURA,
  mensajeCampoFechaNacimiento,
  validadorFechaNoFutura,
} from './fecha-nacimiento';

describe('validadorFechaNoFutura', () => {
  const validador = validadorFechaNoFutura(() => '2026-11-02');

  it('aceptaVacioHoyYUnaFechaPasada', () => {
    expect(validador(new FormControl(''))).toBeNull();
    expect(validador(new FormControl('2026-11-02'))).toBeNull();
    expect(validador(new FormControl('1944-02-01'))).toBeNull();
  });

  it('rechazaUnaFechaFutura', () => {
    expect(validador(new FormControl('2026-11-03'))).toEqual({ fechaFutura: true });
  });
});

describe('mensajeCampoFechaNacimiento', () => {
  function control(valor: string): FormControl<string> {
    return new FormControl(valor, {
      nonNullable: true,
      validators: [Validators.required, validadorFechaNoFutura(() => '2026-11-02')],
    });
  }

  it('tocadaYVaciaPideLaFecha', () => {
    const campo = control('');
    campo.markAsTouched();
    expect(mensajeCampoFechaNacimiento(campo, {}, 'fechaNacimiento')).toBe(
      'Ingresa la fecha de nacimiento',
    );
  });

  it('tocadaYFuturaLoAvisa', () => {
    const campo = control('2030-01-01');
    campo.markAsTouched();
    expect(mensajeCampoFechaNacimiento(campo, {}, 'fechaNacimiento')).toBe(MENSAJE_FECHA_FUTURA);
  });

  it('elErrorDeLaApiTienePrioridad', () => {
    expect(
      mensajeCampoFechaNacimiento(
        control('1944-02-01'),
        { fechaNacimiento: 'Desde la API.' },
        'fechaNacimiento',
      ),
    ).toBe('Desde la API.');
  });

  it('sinTocarNoMuestraNada', () => {
    expect(mensajeCampoFechaNacimiento(control(''), {}, 'fechaNacimiento')).toBeNull();
  });
});
