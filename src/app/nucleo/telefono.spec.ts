import { FormControl, Validators } from '@angular/forms';

import {
  AYUDA_TELEFONO,
  MENSAJE_TELEFONO_CHILENO,
  enlaceTelefono,
  esTelefonoChileno,
  formatearControlTelefono,
  formatearTelefono,
  mensajeCampoTelefono,
  mismoTelefono,
  normalizarTelefono,
  validadorTelefonoChileno,
  validadorTelefonoChilenoSalvo,
} from './telefono';

describe('normalizarTelefono', () => {
  const validos: [string, string][] = [
    ['+56 9 1234 5678', '+56912345678'],
    ['912345678', '+56912345678'],
    ['+56912345678', '+56912345678'],
    ['9 1234 5678', '+56912345678'],
    ['9-1234-5678', '+56912345678'],
    ['+56-9-1234-5678', '+56912345678'],
    ['56912345678', '+56912345678'],
    ['  +56 2 2345 6789 ', '+56223456789'],
  ];

  for (const [entrada, esperado] of validos) {
    it(`normaliza "${entrada}"`, () => {
      expect(normalizarTelefono(entrada)).toBe(esperado);
      expect(esTelefonoChileno(entrada)).toBe(true);
    });
  }

  const invalidos = [
    '12345678',
    '1234567890',
    '+5691234567',
    '+569123456789',
    '+54 9 11 2345 6789',
    '+1 555 123 4567',
    'abc',
    '9123a5678',
    '+56 (9) 1234 5678',
    '9.1234.5678',
    '++56912345678',
    '',
    '   ',
  ];

  for (const entrada of invalidos) {
    it(`rechaza "${entrada}"`, () => {
      expect(normalizarTelefono(entrada)).toBeNull();
      expect(esTelefonoChileno(entrada)).toBe(false);
    });
  }

  it('nuloONoDefinidoDevuelveNull', () => {
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
  });

  it('usaElMismoMensajeYAyudaQueElCore', () => {
    expect(MENSAJE_TELEFONO_CHILENO).toBe('Ingresa un teléfono chileno: +56 y 9 dígitos.');
    expect(AYUDA_TELEFONO).toBe('Ej.: +56 9 1234 5678');
  });
});

describe('formatearTelefono', () => {
  it('formateaUnNumeroChilenoComoMas56Espaciado', () => {
    expect(formatearTelefono('+56912345678')).toBe('+56 9 1234 5678');
    expect(formatearTelefono('912345678')).toBe('+56 9 1234 5678');
    expect(formatearTelefono('+56223456789')).toBe('+56 2 2345 6789');
  });

  it('dejaTalCualUnTelefonoAntiguoQueNoCumpleLaRegla', () => {
    expect(formatearTelefono('+54 11 2345 6789')).toBe('+54 11 2345 6789');
    expect(formatearTelefono('')).toBe('');
    expect(formatearTelefono(null)).toBe('');
  });
});

describe('enlaceTelefono', () => {
  it('usaElNumeroNormalizado', () => {
    expect(enlaceTelefono('+56 9 1234 5678')).toBe('tel:+56912345678');
    expect(enlaceTelefono('+56912345678')).toBe('tel:+56912345678');
  });

  it('enUnTelefonoAntiguoQuitaLosEspacios', () => {
    expect(enlaceTelefono('+54 11 2345 6789')).toBe('tel:+541123456789');
  });
});

describe('validadorTelefonoChileno', () => {
  it('aceptaVacioYUnNumeroValido', () => {
    expect(validadorTelefonoChileno(new FormControl(''))).toBeNull();
    expect(validadorTelefonoChileno(new FormControl(null))).toBeNull();
    expect(validadorTelefonoChileno(new FormControl('9 1234 5678'))).toBeNull();
  });

  it('marcaElErrorTelefonoChilenoSiNoCumple', () => {
    expect(validadorTelefonoChileno(new FormControl('12345'))).toEqual({ telefonoChileno: true });
  });
});

describe('mensajeCampoTelefono', () => {
  function control(valor: string, obligatorio: boolean): FormControl<string> {
    const validadores = obligatorio
      ? [Validators.required, validadorTelefonoChileno]
      : [validadorTelefonoChileno];
    return new FormControl(valor, { nonNullable: true, validators: validadores });
  }

  it('sinTocarNoMuestraNada', () => {
    expect(
      mensajeCampoTelefono(control('123', true), {}, 'telefono', 'Ingresa un teléfono'),
    ).toBeNull();
  });

  it('tocadoYVacioMuestraElRequerido', () => {
    const campo = control('', true);
    campo.markAsTouched();
    expect(mensajeCampoTelefono(campo, {}, 'telefono', 'Ingresa un teléfono')).toBe(
      'Ingresa un teléfono',
    );
  });

  it('tocadoEInvalidoMuestraLaRegla', () => {
    const campo = control('123', false);
    campo.markAsTouched();
    expect(mensajeCampoTelefono(campo, {}, 'telefono')).toBe(MENSAJE_TELEFONO_CHILENO);
  });

  it('elErrorDelServidorTienePrioridad', () => {
    const campo = control('+56912345678', true);
    expect(
      mensajeCampoTelefono(campo, { telefono: 'Desde la API.' }, 'telefono', 'Ingresa un teléfono'),
    ).toBe('Desde la API.');
  });

  it('opcionalTocadoYVacioNoMuestraNada', () => {
    const campo = control('', false);
    campo.markAsTouched();
    expect(mensajeCampoTelefono(campo, {}, 'telefono')).toBeNull();
  });
});

describe('formatearControlTelefono', () => {
  it('alSalirDejaElNumeroValidoFormateado', () => {
    const campo = new FormControl('912345678', { nonNullable: true });
    formatearControlTelefono(campo);
    expect(campo.value).toBe('+56 9 1234 5678');
  });

  it('noTocaUnValorInvalidoNiVacio', () => {
    const invalido = new FormControl('12-34', { nonNullable: true });
    formatearControlTelefono(invalido);
    expect(invalido.value).toBe('12-34');

    const vacio = new FormControl('', { nonNullable: true });
    formatearControlTelefono(vacio);
    expect(vacio.value).toBe('');
  });
});

describe('telefonoGuardado', () => {
  it('mismoTelefonoComparaEnCrudoYNormalizado', () => {
    expect(mismoTelefono('+1 555 123 4567', ' +1 555 123 4567 ')).toBe(true);
    expect(mismoTelefono('9 1234 5678', '+56912345678')).toBe(true);
    expect(mismoTelefono('+56912345679', '+56912345678')).toBe(false);
    expect(mismoTelefono('+1 555', null)).toBe(false);
  });

  it('elValidadorSalvoDejaPasarElTelefonoGuardadoYValidaUnoNuevo', () => {
    const validador = validadorTelefonoChilenoSalvo(() => '+1 555 123 4567');
    expect(validador(new FormControl('+1 555 123 4567'))).toBeNull();
    expect(validador(new FormControl('+1 555 123 4568'))).toEqual({ telefonoChileno: true });
    expect(validador(new FormControl('912345678'))).toBeNull();
  });

  it('elEspacioDuroSeTrataComoUnEspacio', () => {
    expect(normalizarTelefono('+56\u00A09\u00A01234\u00A05678')).toBe('+56912345678');
  });
});
