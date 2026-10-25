import { Injectable, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../http/mensaje-de-error';
import { RespuestaGrupo } from './modelos-grupos';
import { ServicioGrupos } from './servicio-grupos';

const CLAVE_ALMACENAMIENTO = 'mv.grupoActivo';

/**
 * Grupo activo de la sesión actual, compartido por toda la app. Se restaura
 * desde `localStorage` al cargar y se guarda ahí cada vez que cambia; si el
 * guardado ya no está disponible (lo desactivaron, por ejemplo) cae al
 * primer grupo de la lista, o a `null` si no hay ninguno.
 */
@Injectable({ providedIn: 'root' })
export class ServicioGrupoActivo {
  private readonly servicioGrupos = inject(ServicioGrupos);

  private readonly _grupos = signal<RespuestaGrupo[]>([]);
  private readonly _activo = signal<RespuestaGrupo | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly grupos: Signal<RespuestaGrupo[]> = this._grupos.asReadonly();
  readonly activo: Signal<RespuestaGrupo | null> = this._activo.asReadonly();
  /** Mensaje del último `cargar()` fallido, o null si el último intento (o no hubo ninguno) salió bien. */
  readonly error: Signal<string | null> = this._error.asReadonly();

  /** Generación de la última llamada a `cargar()` en curso; descarta respuestas obsoletas. */
  private generacionCarga = 0;

  /**
   * Nunca rechaza: si `listar()` falla, lo captura, deja el estado vacío
   * (sin dejar un grupo de una carga anterior a medias) y expone el motivo
   * en `error()`. Así quien llama (`marco-app`, `grupos`) no necesita su
   * propio try/catch para evitar una promesa rechazada sin control.
   */
  async cargar(): Promise<void> {
    const generacion = ++this.generacionCarga;
    try {
      const grupos = await firstValueFrom(this.servicioGrupos.listar());
      if (generacion !== this.generacionCarga) {
        // Una llamada a cargar() posterior ya resolvió primero: esta respuesta quedó obsoleta.
        return;
      }

      this._error.set(null);
      this._grupos.set(grupos);

      const idGuardado = this.leerIdGuardado();
      const guardado =
        idGuardado !== null ? grupos.find((grupo) => grupo.idGrupo === idGuardado) ?? null : null;
      this.fijarActivo(guardado ?? grupos[0] ?? null);
    } catch (error) {
      if (generacion !== this.generacionCarga) return;

      this._error.set(mensajeDeError(error));
      this._grupos.set([]);
      this.fijarActivo(null);
    }
  }

  seleccionar(idGrupo: number): void {
    const grupo = this._grupos().find((candidato) => candidato.idGrupo === idGrupo) ?? null;
    this.fijarActivo(grupo);
  }

  /** Se llama al cerrar sesión: no deja el grupo de una persona para la siguiente. */
  limpiar(): void {
    this._grupos.set([]);
    this.fijarActivo(null);
  }

  private fijarActivo(grupo: RespuestaGrupo | null): void {
    this._activo.set(grupo);
    this.guardarIdGuardado(grupo?.idGrupo ?? null);
  }

  private leerIdGuardado(): number | null {
    try {
      const valor = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      if (valor === null) {
        return null;
      }
      const idGrupo = Number(valor);
      return Number.isFinite(idGrupo) ? idGrupo : null;
    } catch {
      return null;
    }
  }

  private guardarIdGuardado(idGrupo: number | null): void {
    try {
      if (idGrupo === null) {
        localStorage.removeItem(CLAVE_ALMACENAMIENTO);
      } else {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, String(idGrupo));
      }
    } catch {
      // Sin localStorage (modo privado, bloqueo del navegador) seguimos solo en memoria.
    }
  }
}
