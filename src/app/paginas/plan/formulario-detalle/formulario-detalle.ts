import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
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
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { map } from 'rxjs';

import { BuscadorMedicamento } from '../buscador-medicamento/buscador-medicamento';
import { SelectorHorario } from '../selector-horario/selector-horario';
import { RespuestaOpcionCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import { fechaConAnio } from '../../../nucleo/fecha-legible';
import { hoyEnSantiago } from '../../../nucleo/fechas';
import { RespuestaIntegrante } from '../../../nucleo/grupos/modelos-grupos';
import {
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../../nucleo/http/mensaje-de-error';
import {
  HorarioJson,
  expandirHorario,
  reconstruirHorario,
  validarHorario,
} from '../../../nucleo/planificacion/horario';
import {
  INTERVALOS_SIMPLES,
  configuracionSimpleDeHoras,
  diasEntre,
  esHoraSimpleValida,
  fechaFinSimple,
  horarioSimple,
  horasDesdePrimeraToma,
  resumenSimple,
} from '../../../nucleo/planificacion/horario-simple';
import {
  RespuestaDetallePlan,
  RespuestaMedicamento,
  RespuestaPlan,
  SolicitudGuardarDetalle,
} from '../../../nucleo/planificacion/modelos-planificacion';
import { ServicioPlanes } from '../../../nucleo/planificacion/servicio-planes';
import { dentroDe, enfocarPrimerCampoInvalido, mostrarAviso } from '../../../nucleo/foco';

type ModoTermino = 'AUTOMATICO' | 'MANUAL';

/** Simple: primera toma + cada N horas + N días. Avanzado: el formulario completo. */
type ModoConfiguracion = 'SIMPLE' | 'AVANZADO';

const DIAS_POR_DEFECTO = 7;
const MAXIMO_DIAS = 365;
const MENSAJE_PRIMERA_TOMA = 'Indica la hora de la primera toma';
const MENSAJE_CADA = 'Elige cada cuántas horas';
const MENSAJE_DURANTE = 'Indica un número entero de días entre 1 y 365';

/** `null` vacío lo resuelve `required`; aquí solo se exige que sea entero. */
function entero(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  return valor === null || valor === '' || Number.isInteger(Number(valor)) ? null : { entero: true };
}

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
  private readonly injector = inject(Injector);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

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

  /**
   * Modo simple (por defecto al agregar). Lo que no se muestra en simple
   * (cantidades, término, responsable, instrucciones) queda en `formulario`
   * con su valor actual: por defecto al agregar, el guardado al editar.
   */
  protected readonly simple = this.fb.group({
    primeraToma: ['08:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    cada: this.fb.control<number>(8),
    durante: this.fb.control<number | null>(DIAS_POR_DEFECTO, [
      Validators.required,
      Validators.min(1),
      Validators.max(MAXIMO_DIAS),
      entero,
    ]),
  });
  protected readonly intervalos = INTERVALOS_SIMPLES;
  protected readonly modo = signal<ModoConfiguracion>('SIMPLE');

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

  private readonly valoresSimples = toSignal(
    this.simple.valueChanges.pipe(map(() => this.simple.getRawValue())),
    { initialValue: this.simple.getRawValue() },
  );
  private readonly valores = toSignal(
    this.formulario.valueChanges.pipe(map(() => this.formulario.getRawValue())),
    { initialValue: this.formulario.getRawValue() },
  );

  /** Días del modo simple como número entero válido, o `null`. */
  private readonly diasSimples = computed(() => {
    const durante = this.valoresSimples().durante;
    if (durante === null || (durante as unknown) === '') return null;
    const dias = Number(durante);
    return Number.isInteger(dias) && dias >= 1 && dias <= MAXIMO_DIAS ? dias : null;
  });

  /** Último día en simple, o `null` si falta "Durante" o "Desde". */
  private readonly finSimple = computed(() => {
    const dias = this.diasSimples();
    const desde = this.valores().fechaInicio;
    return dias === null || desde === '' ? null : fechaFinSimple(desde, dias);
  });

  /** "Desde" fuera de la vigencia del plan (la misma regla que aplica el core). */
  private readonly desdeFueraDelPlan = computed(() => {
    const desde = this.valores().fechaInicio;
    const { vigenteDesde, vigenteHasta } = this.plan();
    return desde !== '' && (desde < vigenteDesde || (vigenteHasta !== null && desde > vigenteHasta));
  });

  /** Con la duración elegida termina después del fin del plan. */
  private readonly terminaDespuesDelPlan = computed(() => {
    const fin = this.finSimple();
    const hasta = this.plan().vigenteHasta;
    return fin !== null && hasta !== null && fin > hasta;
  });

  /** Resumen en vivo del modo simple; vacío mientras falte algo. */
  protected readonly resumen = computed(() => {
    const { primeraToma, cada } = this.valoresSimples();
    const dias = this.diasSimples();
    const desde = this.valores().fechaInicio;
    if (!esHoraSimpleValida(primeraToma) || !INTERVALOS_SIMPLES.includes(cada)) return '';
    if (dias === null || desde === '') return '';
    return resumenSimple(primeraToma, cada, desde, dias);
  });

  /**
   * La configuración avanzada actual se puede expresar en simple: todos los
   * días, horas equiespaciadas que cubren el día con un intervalo de la
   * lista y fecha de fin definida (de 1 a 365 días).
   */
  protected readonly expresableEnSimple = computed(() => {
    const { horario, fechaInicio, fechaFin } = this.valores();
    if (!this.todosLosDias() || horario === null || validarHorario(horario) !== null) return false;
    if (configuracionSimpleDeHoras(expandirHorario(horario)) === null) return false;
    if (fechaInicio === '' || fechaFin === '') return false;
    const dias = diasEntre(fechaInicio, fechaFin);
    return dias >= 1 && dias <= MAXIMO_DIAS;
  });

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
      // Los 7 días por defecto no pasan del fin del plan.
      if (hasta !== null) {
        this.simple.controls.durante.setValue(
          Math.min(DIAS_POR_DEFECTO, diasEntre(fechaInicio, hasta)),
        );
      }
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

    if (this.expresableEnSimple()) {
      this.avanzadoASimple(false);
    } else {
      this.modo.set('AVANZADO');
    }
  }

  /** Mensaje de error de un campo del modo simple ("Desde" usa `mensajeDesde`). */
  protected mensajeSimple(campo: 'primeraToma' | 'cada' | 'durante'): string | null {
    const control: AbstractControl = this.simple.controls[campo];
    const mostrar = control.touched || this.intentoEnviar();
    if (campo === 'primeraToma') {
      return mostrar && control.invalid ? MENSAJE_PRIMERA_TOMA : null;
    }
    if (campo === 'cada') {
      return mostrar && !INTERVALOS_SIMPLES.includes(this.valoresSimples().cada) ? MENSAJE_CADA : null;
    }
    const deServidor = this.erroresServidor()['fechaFin'];
    if (deServidor) return deServidor;
    if (mostrar && control.invalid) return MENSAJE_DURANTE;
    if (this.terminaDespuesDelPlan()) {
      return `Con esa duración termina después del fin del plan (${fechaConAnio(this.plan().vigenteHasta)}); elige menos días`;
    }
    return null;
  }

  /** "Desde" en simple: lo de siempre (API o requerido) más la vigencia del plan. */
  protected mensajeDesde(): string | null {
    const mensaje = this.mensaje('fechaInicio');
    if (mensaje || !this.desdeFueraDelPlan()) return mensaje;
    const { vigenteDesde, vigenteHasta } = this.plan();
    const rango = vigenteHasta
      ? `del ${fechaConAnio(vigenteDesde)} al ${fechaConAnio(vigenteHasta)}`
      : `desde el ${fechaConAnio(vigenteDesde)}`;
    return `Elige una fecha dentro de la vigencia del plan (${rango})`;
  }

  /** Cambia de modo y lleva el foco al primer campo del modo nuevo. */
  protected cambiarModo(modo: ModoConfiguracion): void {
    if (modo === 'AVANZADO') {
      this.simpleAAvanzado();
    } else {
      if (!this.expresableEnSimple()) return;
      this.avanzadoASimple();
    }
    this.modo.set(modo);
    const destino = modo === 'AVANZADO' ? '#detalle-todos-dias' : '#detalle-primera-toma';
    const elemento = dentroDe(this.host, destino);
    afterNextRender(() => (elemento() as HTMLElement | null)?.focus(), {
      injector: this.injector,
    });
  }

  /**
   * Lleva lo simple al formulario avanzado: todos los días, las horas
   * calculadas como horas fijas y la fecha de fin. Lo que esté incompleto en
   * simple no se copia.
   */
  private simpleAAvanzado(): void {
    const { primeraToma, cada } = this.simple.getRawValue();
    this.diasElegidos.set(new Set(this.dias().map((d) => d.idOpcion)));
    if (esHoraSimpleValida(primeraToma) && INTERVALOS_SIMPLES.includes(cada)) {
      this.formulario.controls.horario.setValue(horarioSimple(primeraToma, cada));
    }
    const fin = this.finSimple();
    if (fin !== null) {
      this.formulario.controls.fechaFin.setValue(fin);
    }
  }

  /**
   * Lleva lo avanzado (ya comprobado con `expresableEnSimple`) al modo simple.
   * Con `conservarPrimeraToma`, si las horas son las mismas se mantiene la
   * primera toma que eligió la persona (08:00 cada 8, no 00:00); al abrir un
   * detalle guardado no hay elección previa y se usa la hora más temprana.
   */
  private avanzadoASimple(conservarPrimeraToma = true): void {
    const { horario, fechaInicio, fechaFin } = this.formulario.getRawValue();
    const horas = expandirHorario(horario!);
    const configuracion = configuracionSimpleDeHoras(horas)!;
    const primeraActual = this.simple.controls.primeraToma.value;
    const mismaSerie =
      conservarPrimeraToma &&
      esHoraSimpleValida(primeraActual) &&
      horasDesdePrimeraToma(primeraActual, configuracion.cada).sort().join() === horas.join();
    this.simple.setValue({
      primeraToma: mismaSerie ? primeraActual : configuracion.primeraToma,
      cada: configuracion.cada,
      durante: diasEntre(fechaInicio, fechaFin),
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

    if (this.modo() === 'SIMPLE') {
      this.simple.markAllAsTouched();
      if (this.simple.invalid || this.desdeFueraDelPlan() || this.terminaDespuesDelPlan()) {
        this.enfocarPrimerError();
        return;
      }
      this.simpleAAvanzado();
    }

    const valores = this.formulario.getRawValue();
    const horario = valores.horario;
    if (
      this.formulario.invalid ||
      this.diasElegidos().size === 0 ||
      validarHorario(horario) !== null
    ) {
      this.enfocarPrimerError();
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
          mostrarAviso(dentroDe(this.host, '.error-formulario'), this.injector);
        } else {
          this.enfocarPrimerError();
        }
      },
    });
  }

  /** Lleva a la vista (y al foco, si es un campo) el primer error del formulario. */
  private enfocarPrimerError(): void {
    enfocarPrimerCampoInvalido(dentroDe(this.host, 'form'), this.injector);
  }
}
