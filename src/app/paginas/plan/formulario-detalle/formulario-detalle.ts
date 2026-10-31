import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { BuscadorMedicamento } from '../buscador-medicamento/buscador-medicamento';
import { SelectorHorario } from '../selector-horario/selector-horario';
import { RespuestaOpcionCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import { hoyEnSantiago } from '../../../nucleo/fechas';
import { RespuestaIntegrante } from '../../../nucleo/grupos/modelos-grupos';
import {
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../../nucleo/http/mensaje-de-error';
import {
  HorarioJson,
  reconstruirHorario,
  validarHorario,
} from '../../../nucleo/planificacion/horario';
import {
  RespuestaDetallePlan,
  RespuestaMedicamento,
  RespuestaPlan,
  SolicitudGuardarDetalle,
} from '../../../nucleo/planificacion/modelos-planificacion';
import { ServicioPlanes } from '../../../nucleo/planificacion/servicio-planes';

type ModoTermino = 'AUTOMATICO' | 'MANUAL';

/** Campos cuyo aviso se arma con `mensajeDeCampo` (error de la API o requerido local). */
type CampoConAviso =
  | 'idMedicamento'
  | 'idPresentacion'
  | 'concentracion'
  | 'dosisCantidad'
  | 'idUnidadDosis'
  | 'fechaInicio'
  | 'fechaFin'
  | 'cantidadInicial'
  | 'cantidadDisponible'
  | 'fechaEstimadaTermino'
  | 'idResponsablePredeterminado'
  | 'instrucciones';

const MENSAJES_REQUERIDO: Partial<Record<CampoConAviso, string>> = {
  idMedicamento: 'Elige un medicamento',
  idPresentacion: 'Elige la presentación',
  dosisCantidad: 'Ingresa la dosis',
  idUnidadDosis: 'Elige la unidad',
  fechaInicio: 'Indica desde cuándo',
  fechaEstimadaTermino: 'Indica la fecha estimada de término',
};

const MENSAJE_SIN_DIAS = 'Selecciona al menos un día';
const MENSAJE_RESPONSABLE_ANTERIOR =
  'El responsable anterior ya no es integrante activo del grupo; elige otro o deja sin responsable.';

/** Texto recortado, o `null` si queda en blanco. */
function textoONulo(valor: string): string | null {
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Formulario para agregar o editar un medicamento (detalle) de un plan.
 *
 * Presentacional respecto a los datos de referencia: la página contenedora
 * (`Plan`) le pasa el plan, el detalle a editar (o `null` para uno nuevo),
 * las opciones de catálogo ya cargadas y la lista de integrantes ACTIVOS del
 * grupo (ya filtrada; este componente no consulta estados de integrantes).
 * Solo llama a la API para guardar (`agregarDetalle`/`actualizarDetalle`) y,
 * vía `BuscadorMedicamento`, para buscar o dar de alta un medicamento.
 *
 * Los datos se cargan una sola vez en `ngOnInit`: para editar otro detalle,
 * la página debe volver a montar el componente (p. ej. con `@if` o un
 * `@for` con `track` por id), no solo cambiar el input `detalle`.
 */
@Component({
  selector: 'app-formulario-detalle',
  imports: [ReactiveFormsModule, NgTemplateOutlet, BuscadorMedicamento, SelectorHorario],
  templateUrl: './formulario-detalle.html',
  styleUrl: './formulario-detalle.scss',
})
export class FormularioDetalle implements OnInit {
  private readonly servicioPlanes = inject(ServicioPlanes);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly idGrupo = input.required<number>();
  readonly plan = input.required<RespuestaPlan>();
  readonly detalle = input<RespuestaDetallePlan | null>(null);
  readonly presentaciones = input<RespuestaOpcionCatalogo[]>([]);
  readonly unidades = input<RespuestaOpcionCatalogo[]>([]);
  /** Opciones de `DIA_SEMANA`, en el orden del catálogo (Lunes…Domingo). */
  readonly dias = input<RespuestaOpcionCatalogo[]>([]);
  /** Integrantes ACTIVOS del grupo (la página filtra); el valor enviado es `idUsuario`. */
  readonly integrantes = input<RespuestaIntegrante[]>([]);

  readonly guardado = output<RespuestaDetallePlan>();
  readonly cancelado = output<void>();

  protected readonly aviso =
    'Registra la indicación entregada por un profesional o cuidador autorizado. Cuida+ no prescribe ni recomienda dosis.';

  protected readonly formulario = this.fb.group({
    idMedicamento: this.fb.control<number | null>(null, Validators.required),
    idPresentacion: this.fb.control<number | null>(null, Validators.required),
    concentracion: [''],
    dosisCantidad: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.001),
    ]),
    idUnidadDosis: this.fb.control<number | null>(null, Validators.required),
    horario: this.fb.control<HorarioJson | null>(null),
    fechaInicio: ['', Validators.required],
    fechaFin: [''],
    cantidadInicial: this.fb.control<number | null>(null, Validators.min(0)),
    cantidadDisponible: this.fb.control<number | null>(null, Validators.min(0)),
    modoCalculoTermino: this.fb.control<ModoTermino>('AUTOMATICO'),
    fechaEstimadaTermino: [''],
    idResponsablePredeterminado: this.fb.control<number | null>(null),
    instrucciones: [''],
  });

  /** Nombre del medicamento elegido (el id va en el control `idMedicamento`). */
  protected readonly nombreMedicamento = signal<string | null>(null);
  protected readonly diasElegidos = signal<ReadonlySet<number>>(new Set());
  protected readonly intentoEnviar = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});
  /** true si, al editar, el responsable predeterminado guardado ya no es un integrante activo del grupo. */
  protected readonly responsableAnteriorInvalido = signal(false);
  protected readonly mensajeResponsableAnterior = MENSAJE_RESPONSABLE_ANTERIOR;

  private readonly idUnidad = toSignal(this.formulario.controls.idUnidadDosis.valueChanges, {
    initialValue: null,
  });
  protected readonly modoTermino = toSignal(
    this.formulario.controls.modoCalculoTermino.valueChanges,
    {
      initialValue: 'AUTOMATICO' as ModoTermino,
    },
  );

  /** " (en comprimido(s))" según la unidad elegida, o vacío si aún no hay unidad. */
  protected readonly enUnidad = computed(() => {
    const id = this.idUnidad();
    const unidad = this.unidades().find((u) => u.idOpcion === id);
    return unidad ? ` (en ${unidad.descripcion})` : '';
  });

  protected readonly todosLosDias = computed(
    () => this.dias().length > 0 && this.dias().every((d) => this.diasElegidos().has(d.idOpcion)),
  );

  protected readonly errorDias = computed(
    () =>
      this.erroresServidor()['diasSemana'] ??
      (this.intentoEnviar() && this.diasElegidos().size === 0 ? MENSAJE_SIN_DIAS : null),
  );

  constructor() {
    const fechaTermino = this.formulario.controls.fechaEstimadaTermino;
    this.formulario.controls.modoCalculoTermino.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((modo) => {
        if (modo === 'MANUAL') {
          fechaTermino.setValidators(Validators.required);
        } else {
          fechaTermino.clearValidators();
        }
        fechaTermino.updateValueAndValidity();
      });
  }

  ngOnInit(): void {
    const detalle = this.detalle();
    if (detalle === null) {
      const plan = this.plan();
      const desde = plan.vigenteDesde;
      const hasta = plan.vigenteHasta;
      const hoy = hoyEnSantiago();
      // Fechas ISO yyyy-mm-dd: el orden lexicográfico es el cronológico.
      let fechaInicio = hoy > desde ? hoy : desde;
      // El plan tiene término: el "Desde" por defecto nunca queda después de él.
      if (hasta !== null && fechaInicio > hasta) {
        fechaInicio = hasta;
      }
      this.formulario.patchValue({ fechaInicio, fechaFin: hasta ?? '' });
      return;
    }

    const idResponsable = detalle.idResponsablePredeterminado;
    const responsableSigueActivo =
      idResponsable === null ||
      this.integrantes().some((integrante) => integrante.idUsuario === idResponsable);
    this.responsableAnteriorInvalido.set(!responsableSigueActivo);

    this.nombreMedicamento.set(detalle.nombreMedicamento);
    this.diasElegidos.set(new Set(detalle.diasSemana));
    this.formulario.patchValue({
      idMedicamento: detalle.idMedicamento,
      idPresentacion: detalle.idPresentacion,
      concentracion: detalle.concentracion ?? '',
      dosisCantidad: detalle.dosisCantidad,
      idUnidadDosis: detalle.idUnidadDosis,
      horario: reconstruirHorario(detalle.horas),
      fechaInicio: detalle.fechaInicio,
      fechaFin: detalle.fechaFin ?? '',
      cantidadInicial: detalle.cantidadInicial,
      cantidadDisponible: detalle.cantidadDisponible,
      modoCalculoTermino: detalle.modoCalculoTermino,
      fechaEstimadaTermino:
        detalle.modoCalculoTermino === 'MANUAL' ? (detalle.fechaEstimadaTermino ?? '') : '',
      idResponsablePredeterminado: responsableSigueActivo ? idResponsable : null,
      instrucciones: detalle.instrucciones ?? '',
    });
  }

  protected mensaje(campo: CampoConAviso): string | null {
    const control: AbstractControl = this.formulario.controls[campo];
    const mensaje = mensajeDeCampo(
      control,
      this.erroresServidor(),
      campo,
      MENSAJES_REQUERIDO[campo] ?? '',
    );
    if (mensaje) return mensaje;
    if (campo === 'dosisCantidad' && control.touched && control.hasError('min')) {
      return 'La dosis debe ser mayor que 0';
    }
    if (
      (campo === 'cantidadInicial' || campo === 'cantidadDisponible') &&
      control.touched &&
      control.hasError('min')
    ) {
      return 'La cantidad debe ser 0 o mayor';
    }
    return null;
  }

  protected elegirMedicamento(medicamento: RespuestaMedicamento): void {
    this.nombreMedicamento.set(medicamento.nombre);
    this.formulario.patchValue({
      idMedicamento: medicamento.idMedicamento,
      concentracion: medicamento.concentracion ?? '',
      ...(medicamento.idPresentacion !== null
        ? { idPresentacion: medicamento.idPresentacion }
        : {}),
    });
  }

  protected cambiarMedicamento(): void {
    this.nombreMedicamento.set(null);
    this.formulario.controls.idMedicamento.setValue(null);
  }

  protected alternarDia(idDia: number, evento: Event): void {
    const elegidos = new Set(this.diasElegidos());
    if ((evento.target as HTMLInputElement).checked) {
      elegidos.add(idDia);
    } else {
      elegidos.delete(idDia);
    }
    this.diasElegidos.set(elegidos);
  }

  protected alternarTodos(evento: Event): void {
    const marcar = (evento.target as HTMLInputElement).checked;
    this.diasElegidos.set(new Set(marcar ? this.dias().map((d) => d.idOpcion) : []));
  }

  protected cancelar(): void {
    this.cancelado.emit();
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();

    const valores = this.formulario.getRawValue();
    const horario = valores.horario;
    if (
      this.formulario.invalid ||
      this.diasElegidos().size === 0 ||
      validarHorario(horario) !== null
    ) {
      return;
    }

    const manual = valores.modoCalculoTermino === 'MANUAL';
    const solicitud: SolicitudGuardarDetalle = {
      idMedicamento: valores.idMedicamento!,
      idPresentacion: valores.idPresentacion!,
      concentracion: textoONulo(valores.concentracion),
      instrucciones: textoONulo(valores.instrucciones),
      dosisCantidad: Number(valores.dosisCantidad),
      idUnidadDosis: valores.idUnidadDosis!,
      diasSemana: this.dias()
        .map((d) => d.idOpcion)
        .filter((id) => this.diasElegidos().has(id)),
      horario: horario!,
      fechaInicio: valores.fechaInicio,
      fechaFin: textoONulo(valores.fechaFin),
      cantidadInicial: valores.cantidadInicial,
      cantidadDisponible: valores.cantidadDisponible,
      modoCalculoTermino: valores.modoCalculoTermino,
      fechaEstimadaTermino: manual ? textoONulo(valores.fechaEstimadaTermino) : null,
      idResponsablePredeterminado: valores.idResponsablePredeterminado,
    };

    const idPlan = this.plan().idPlan;
    const detalle = this.detalle();
    const peticion =
      detalle === null
        ? this.servicioPlanes.agregarDetalle(this.idGrupo(), idPlan, solicitud)
        : this.servicioPlanes.actualizarDetalle(
            this.idGrupo(),
            idPlan,
            detalle.idDetallePlan,
            solicitud,
          );

    this.error.set(null);
    this.erroresServidor.set({});
    this.guardando.set(true);
    peticion.subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.guardado.emit(guardado);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const campos = erroresDeCampos(error);
        this.erroresServidor.set(campos);
        if (Object.keys(campos).length === 0) {
          this.error.set(mensajeDeError(error));
        }
      },
    });
  }
}
