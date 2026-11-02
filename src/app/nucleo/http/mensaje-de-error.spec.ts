import { HttpErrorResponse } from '@angular/common/http';

import { describirCon, erroresDeCampos, mensajeDeError } from './mensaje-de-error';

function errorHttp(status: number, cuerpo: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, url: 'https://api.x.cl/api/grupos' });
}

describe('mensajeDeError', () => {
  it('usaElDetailDelProblemDetail', () => {
    const error = errorHttp(422, {
      title: 'Regla de negocio',
      detail: 'El grupo debe conservar al menos un coordinador activo.',
    });

    expect(mensajeDeError(error)).toBe('El grupo debe conservar al menos un coordinador activo.');
  });

  it('avisaSinConexionConStatus0', () => {
    const error = errorHttp(0, null);

    expect(mensajeDeError(error)).toBe('No pudimos conectar con el servidor.');
  });

  it('usaElMensajePorDefecto', () => {
    const error = errorHttp(500, {});

    expect(mensajeDeError(error)).toBe('Ocurrió un error inesperado.');
    expect(mensajeDeError(error, 'No se pudo completar la operación.')).toBe(
      'No se pudo completar la operación.',
    );
  });

  it('usaElMensajePorDefectoAnteUnErrorQueNoEsHttp', () => {
    expect(mensajeDeError(new Error('otra cosa'))).toBe('Ocurrió un error inesperado.');
  });
});

describe('erroresDeCampos', () => {
  it('extraeLosErroresDeCampoDelProblemDetail', () => {
    const error = errorHttp(400, {
      errores: [
        { campo: 'nombre', mensaje: 'El nombre no puede estar vacío.' },
        { campo: 'telefono', mensaje: 'El teléfono no es válido.' },
      ],
    });

    expect(erroresDeCampos(error)).toEqual({
      nombre: 'El nombre no puede estar vacío.',
      telefono: 'El teléfono no es válido.',
    });
  });

  it('devuelveVacioSinErroresDeCampo', () => {
    expect(erroresDeCampos(errorHttp(500, {}))).toEqual({});
  });
});

describe('describirCon', () => {
  it('uneLosIdsPresentesEnOrden', () => {
    expect(describirCon('campo-ayuda', 'campo-error')).toBe('campo-ayuda campo-error');
    expect(describirCon('campo-ayuda', null)).toBe('campo-ayuda');
    expect(describirCon(false, 'campo-error')).toBe('campo-error');
  });

  it('sinNingunIdDevuelveNull', () => {
    expect(describirCon(null, undefined, false, '')).toBeNull();
  });
});
