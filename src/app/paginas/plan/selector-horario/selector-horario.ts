import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { merge } from 'rxjs';

import {
  HorarioJson,
  expandirHorario,
  validarHorario,
} from '../../../nucleo/planificacion/horario';

type Modo = 'HORAS_FIJAS' | 'INTERVALO';

let siguienteId = 0;

/**
 * Selector del horario de un medicamento: `ControlValueAccessor` de
 * `HorarioJson | null` con dos modos ("Horas fijas" / "Intervalo").
 *
 * Contrato con el formulario padre:
 * - El valor emitido es el `HorarioJson` construido SOLO cuando
 *   `validarHorario` lo acepta; mientras el horario está incompleto o fuera
 *   del contrato se emite `null`.
 * - Además se registra como `Validator` (`NG_VALIDATORS`): el control queda
 *   inválido con `{ horario: <mensaje exacto de validarHorario> }`, así el
 *   padre puede bloquear el envío con `control.invalid` o leer el mensaje.
 * - El error se muestra (`role="alert"`) tras la primera interacción, o
 *   siempre si el padre pasa `[mostrarError]="true"` (p. ej. tras intentar
 *   enviar).
 * - Para cargar un detalle existente el padre escribe
 *   `reconstruirHorario(detalle.horas)` en el control.
 *
 * Las horas fijas en blanco se ignoran (una fila vacía no es un error); si
 * todas están en blanco el error es "Indica al menos una hora".
 */
@Component({
  selector: 'app-selector-horario',
  imports: [ReactiveFormsModule],
  templateUrl: './selector-horario.html',
  styleUrl: './selector-horario.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectorHorario), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => SelectorHorario), multi: true },
  ],
})
export class SelectorHorario implements ControlValueAccessor, Validator {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly elementoHost: ElementRef<HTMLElement> = inject(ElementRef);

  /** Fuerza a mostrar el error aunque no haya habido interacción (el padre intentó enviar). */
  readonly mostrarError = input(false);

  protected readonly prefijo = `horario-${++siguienteId}`;

  protected readonly modo = this.fb.control<Modo>('HORAS_FIJAS');
  protected readonly horas: FormArray<FormControl<string>> = this.fb.array([this.fb.control('')]);
  protected readonly intervalo: FormGroup<{
    inicio: FormControl<string>;
    fin: FormControl<string>;
    frecuencia: FormControl<number | null>;
  }> = this.fb.group({
    inicio: this.fb.control(''),
    fin: this.fb.control(''),
    frecuencia: this.fb.control<number | null>(null),
  });

  /** Objeto candidato (puede no cumplir el contrato) según el estado actual del formulario interno. */
  private readonly candidato = signal<unknown>(null);
  protected readonly modoActual = signal<Modo>('HORAS_FIJAS');
  protected readonly deshabilitado = signal(false);
  private readonly interactuado = signal(false);

  protected readonly error = computed(() => validarHorario(this.candidato()));
  protected readonly horasPrevistas = computed(() =>
    this.error() === null ? expandirHorario(this.candidato() as HorarioJson) : [],
  );
  protected readonly errorVisible = computed(() =>
    this.interactuado() || this.mostrarError() ? this.error() : null,
  );

  private alCambiar: (valor: HorarioJson | null) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  constructor() {
    this.recalcular();
    // Cambiar de modo (radio) no cuenta como "interacción" con el horario en
    // sí: no debe adelantar el error de validación antes de que la persona
    // empiece a llenar los campos del modo elegido.
    this.modo.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.recalcular();
      this.emitir();
    });
    merge(this.horas.valueChanges, this.intervalo.valueChanges)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        this.interactuado.set(true);
        this.recalcular();
        this.emitir();
      });
  }

  protected agregarHora(): void {
    this.horas.push(this.fb.control(''));
    const indiceNuevo = this.horas.length - 1;
    afterNextRender(() => this.enfocarHora(indiceNuevo), { injector: this.injector });
  }

  protected quitarHora(indice: number): void {
    if (this.horas.length <= 1) return;
    this.horas.removeAt(indice);
    const indiceFoco = Math.min(indice, this.horas.length - 1);
    afterNextRender(() => this.enfocarHora(indiceFoco), { injector: this.injector });
  }

  /** Foco accesible tras agregar/quitar una hora: la fila correspondiente queda con el foco. */
  private enfocarHora(indice: number): void {
    this.elementoHost.nativeElement
      .querySelector<HTMLInputElement>(`#${this.prefijo}-hora-${indice}`)
      ?.focus();
  }

  protected tocar(): void {
    this.interactuado.set(true);
    this.alTocar();
  }

  writeValue(valor: HorarioJson | null): void {
    const opciones = { emitEvent: false };
    this.horas.clear(opciones);
    if (valor?.tipo === 'HORAS_FIJAS') {
      this.modo.setValue('HORAS_FIJAS', opciones);
      const horas = valor.horas.length > 0 ? valor.horas : [''];
      horas.forEach((hora) => this.horas.push(this.fb.control(hora), opciones));
      this.intervalo.reset(undefined, opciones);
    } else {
      this.horas.push(this.fb.control(''), opciones);
      if (valor?.tipo === 'INTERVALO') {
        this.modo.setValue('INTERVALO', opciones);
        this.intervalo.setValue(
          { inicio: valor.hora_inicio, fin: valor.hora_fin, frecuencia: valor.frecuencia_horas },
          opciones,
        );
      } else {
        this.modo.setValue('HORAS_FIJAS', opciones);
        this.intervalo.reset(undefined, opciones);
        this.interactuado.set(false);
      }
    }
    this.recalcular();
  }

  registerOnChange(fn: (valor: HorarioJson | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    const opciones = { emitEvent: false };
    for (const control of [this.modo, this.horas, this.intervalo]) {
      if (deshabilitado) {
        control.disable(opciones);
      } else {
        control.enable(opciones);
      }
    }
    this.deshabilitado.set(deshabilitado);
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    const error = this.error();
    return error === null ? null : { horario: error };
  }

  private recalcular(): void {
    const modo = this.modo.value;
    this.modoActual.set(modo);
    if (modo === 'HORAS_FIJAS') {
      this.candidato.set({
        version: 1,
        tipo: 'HORAS_FIJAS',
        horas: this.horas.getRawValue().filter((hora) => hora.trim() !== ''),
      });
      return;
    }
    const { inicio, fin, frecuencia } = this.intervalo.getRawValue();
    this.candidato.set({
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: inicio,
      hora_fin: fin,
      frecuencia_horas: frecuencia,
    });
  }

  private emitir(): void {
    this.alCambiar(
      this.error() === null ? (structuredClone(this.candidato()) as HorarioJson) : null,
    );
  }
}
