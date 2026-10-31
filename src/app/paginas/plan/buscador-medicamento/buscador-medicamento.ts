import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { RespuestaOpcionCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import {
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../../nucleo/http/mensaje-de-error';
import { RespuestaMedicamento } from '../../../nucleo/planificacion/modelos-planificacion';
import { ServicioMedicamentos } from '../../../nucleo/planificacion/servicio-medicamentos';

/** Espera tras la última tecla antes de consultar el catálogo. */
const ESPERA_MS = 300;
/** Largo mínimo (sin espacios en los bordes) para buscar. */
const LARGO_MINIMO = 2;

/**
 * Buscador del catálogo global de medicamentos (prioriza los del grupo, que
 * se marcan "Usado en este grupo"). Si no está el que se busca, ofrece
 * "Agregar «texto» al catálogo": un mini formulario que llama a
 * `ServicioMedicamentos.crear` (la API devuelve el existente si ya estaba,
 * con otra escritura) y elige el devuelto.
 *
 * No usa un `<form>` propio: se monta dentro del `<form>` del detalle y un
 * formulario anidado haría que su envío disparara también el del padre.
 * Enter dentro del buscador nunca envía el formulario contenedor: en el
 * alta ejecuta "Agregar al catálogo" y en la búsqueda no hace nada.
 *
 * Presentacional respecto a la selección: solo emite `elegido`; quien lo
 * usa decide cómo mostrar el medicamento elegido.
 */
@Component({
  selector: 'app-buscador-medicamento',
  imports: [ReactiveFormsModule],
  templateUrl: './buscador-medicamento.html',
  styleUrl: './buscador-medicamento.scss',
})
export class BuscadorMedicamento {
  private readonly servicio = inject(ServicioMedicamentos);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly idGrupo = input.required<number>();
  /** Opciones de `PRESENTACION_MEDICAMENTO` (para mostrar resultados y para el alta). */
  readonly presentaciones = input<RespuestaOpcionCatalogo[]>([]);
  /** id del mensaje de error que describe al buscador (lo pone quien lo usa); null sin error. */
  readonly descritoPor = input<string | null>(null);
  readonly elegido = output<RespuestaMedicamento>();

  protected readonly texto = this.fb.control('');
  protected readonly resultados = signal<RespuestaMedicamento[]>([]);
  /** Último texto consultado (recortado); null si no hay búsqueda vigente. */
  protected readonly buscado = signal<string | null>(null);
  protected readonly buscando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly agregando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresCampos = signal<Record<string, string>>({});
  protected readonly nuevo = this.fb.group({
    // pattern(/\S/): un nombre de solo espacios no debe pasar como "completo".
    nombre: ['', [Validators.required, Validators.pattern(/\S/)]],
    principioActivo: [''],
    idPresentacion: this.fb.control<number | null>(null, Validators.required),
    concentracion: [''],
  });

  /** Campos del alta con aviso visible en el formulario (ver `mensajeCampo`). */
  private static readonly CAMPOS_VISIBLES = ['nombre', 'idPresentacion'] as const;

  constructor() {
    this.texto.valueChanges
      .pipe(
        debounceTime(ESPERA_MS),
        map((valor) => valor.trim()),
        distinctUntilChanged(),
        tap(() => this.error.set(null)),
        switchMap((valor) => {
          if (valor.length < LARGO_MINIMO) {
            return of({ valor: null, resultados: [] as RespuestaMedicamento[] });
          }
          this.buscando.set(true);
          return this.servicio.buscar(this.idGrupo(), valor).pipe(
            map((resultados) => ({ valor, resultados })),
            catchError((error: unknown) => {
              this.error.set(mensajeDeError(error));
              return of({ valor, resultados: [] as RespuestaMedicamento[] });
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ valor, resultados }) => {
        this.buscando.set(false);
        this.buscado.set(valor);
        this.resultados.set(resultados);
      });
  }

  protected alPresionarEnter(evento: Event): void {
    const destino = evento.target as HTMLElement | null;
    if (destino?.tagName === 'BUTTON') return; // Enter sobre un botón = su clic.
    evento.preventDefault();
    if (this.agregando() && destino?.closest('.nuevo')) {
      this.crear();
    }
  }

  protected descripcionPresentacion(idPresentacion: number | null): string | null {
    return this.presentaciones().find((p) => p.idOpcion === idPresentacion)?.descripcion ?? null;
  }

  protected elegir(medicamento: RespuestaMedicamento): void {
    this.elegido.emit(medicamento);
    this.limpiar();
  }

  protected abrirAlta(): void {
    this.erroresCampos.set({});
    this.error.set(null);
    this.nuevo.reset({
      nombre: this.buscado() ?? '',
      principioActivo: '',
      idPresentacion: null,
      concentracion: '',
    });
    this.agregando.set(true);
  }

  protected cerrarAlta(): void {
    this.agregando.set(false);
  }

  protected mensajeCampo(campo: 'nombre' | 'idPresentacion', requerido: string): string | null {
    const control = this.nuevo.controls[campo];
    const mensaje = mensajeDeCampo(control, this.erroresCampos(), campo, requerido);
    if (mensaje) return mensaje;
    if (campo === 'nombre' && control.touched && control.hasError('pattern')) {
      return 'Ingresa el nombre';
    }
    return null;
  }

  protected crear(): void {
    if (this.guardando()) return;
    if (this.nuevo.invalid) {
      this.nuevo.markAllAsTouched();
      return;
    }
    const { nombre, principioActivo, idPresentacion, concentracion } = this.nuevo.getRawValue();
    this.error.set(null);
    this.erroresCampos.set({});
    this.guardando.set(true);
    this.servicio
      .crear(this.idGrupo(), {
        nombre: nombre.trim(),
        principioActivo: principioActivo.trim() === '' ? null : principioActivo.trim(),
        idPresentacion: idPresentacion!,
        concentracion: concentracion.trim() === '' ? null : concentracion.trim(),
      })
      .subscribe({
        next: (medicamento) => {
          this.guardando.set(false);
          this.agregando.set(false);
          this.elegir(medicamento);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          // Sin ningún error de campo visible (ninguno, o solo de campos que
          // este formulario no muestra, p. ej. "principioActivo" o
          // "concentracion"): sin esto, la persona no vería ningún aviso.
          const algunCampoVisible = Object.keys(campos).some((campo) =>
            BuscadorMedicamento.CAMPOS_VISIBLES.includes(
              campo as (typeof BuscadorMedicamento.CAMPOS_VISIBLES)[number],
            ),
          );
          if (!algunCampoVisible) {
            this.error.set(mensajeDeError(error));
          }
        },
      });
  }

  private limpiar(): void {
    // Con evento: así `distinctUntilChanged` no recuerda el texto anterior y volver a escribirlo busca de nuevo.
    this.texto.setValue('');
    this.resultados.set([]);
    this.buscado.set(null);
  }
}
