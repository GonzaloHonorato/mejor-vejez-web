import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { RespuestaPagina } from '../usuarios/modelos-usuarios';
import { CodigoResultadoAuditoria, RespuestaEventoAuditoria } from './modelos-auditoria';

/**
 * Filtros opcionales de la consulta de auditoría (regla 9 del plan).
 * `idGrupo` solo lo usa `consultarGlobal` (en `consultarGrupo` el grupo lo
 * fija la ruta); los filtros vacíos, `null` o `''` no se envían.
 */
export interface FiltroAuditoria {
  idGrupo?: number | null;
  tipoEntidad?: string | null;
  idEntidad?: string | null;
  codigoAccion?: string | null;
  codigoResultado?: CodigoResultadoAuditoria | null;
  desde?: string | null;
  hasta?: string | null;
}

/**
 * Acceso a la consulta de auditoría, de solo lectura (HU-12, TSA-52):
 * `consultarGrupo` para el coordinador/administrador de un grupo
 * (`/api/grupos/{idGrupo}/auditoria`) y `consultarGlobal` para el
 * administrador (`/api/auditoria`, incluye eventos sin grupo).
 */
@Injectable({ providedIn: 'root' })
export class ServicioAuditoria {
  private readonly http = inject(HttpClient);
  private readonly urlApi = configuracionEjecucion.urlApi;

  consultarGrupo(
    idGrupo: number,
    filtro: FiltroAuditoria,
    pagina: number,
    tamano: number,
  ): Observable<RespuestaPagina<RespuestaEventoAuditoria>> {
    return this.http.get<RespuestaPagina<RespuestaEventoAuditoria>>(
      `${this.urlApi}/api/grupos/${idGrupo}/auditoria`,
      { params: this.parametros(filtro, pagina, tamano) },
    );
  }

  consultarGlobal(
    filtro: FiltroAuditoria,
    pagina: number,
    tamano: number,
  ): Observable<RespuestaPagina<RespuestaEventoAuditoria>> {
    return this.http.get<RespuestaPagina<RespuestaEventoAuditoria>>(
      `${this.urlApi}/api/auditoria`,
      {
        params: this.parametros(filtro, pagina, tamano),
      },
    );
  }

  /** Los filtros vacíos, `null` o `''` no se envían (regla 9 del plan). */
  private parametros(
    filtro: FiltroAuditoria,
    pagina: number,
    tamano: number,
  ): Record<string, string> {
    const parametros: Record<string, string> = { pagina: String(pagina), tamano: String(tamano) };
    this.agregarSiTieneValor(parametros, 'idGrupo', filtro.idGrupo);
    this.agregarSiTieneValor(parametros, 'tipoEntidad', filtro.tipoEntidad);
    this.agregarSiTieneValor(parametros, 'idEntidad', filtro.idEntidad);
    this.agregarSiTieneValor(parametros, 'codigoAccion', filtro.codigoAccion);
    this.agregarSiTieneValor(parametros, 'codigoResultado', filtro.codigoResultado);
    this.agregarSiTieneValor(parametros, 'desde', filtro.desde);
    this.agregarSiTieneValor(parametros, 'hasta', filtro.hasta);
    return parametros;
  }

  private agregarSiTieneValor(
    parametros: Record<string, string>,
    clave: string,
    valor: string | number | null | undefined,
  ): void {
    if (valor === undefined || valor === null || valor === '') {
      return;
    }
    parametros[clave] = String(valor);
  }
}
