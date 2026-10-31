import {
  Component,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Icono } from '../../../compartido/icono/icono';
import { RespuestaContacto } from '../../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../../nucleo/adultos/servicio-adultos';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../../nucleo/catalogos/servicio-catalogos';
import {
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../../nucleo/http/mensaje-de-error';

type FormularioEdicionContacto = FormGroup<{
  nombreContacto: FormControl<string>;
  parentesco: FormControl<string>;
  telefono: FormControl<string>;
}>;

/**
 * Lista de contactos de emergencia de un adulto mayor, con administración
 * (alta, edición en el lugar, designar principal, desactivar/reactivar,
 * eliminar) cuando `puedeAdministrar() && adultoActivo()`. Se usa dentro de
 * `FichaAdulto`: `idGrupo`/`idAdulto` son obligatorios porque sin ellos no
 * hay contactos que pedir.
 *
 * Desactivar al principal habiendo otros contactos activos exige elegir un
 * reemplazo: el botón "Desactivar" no
 * llama a la API, solo abre un `<select>` en línea con "Confirmar"/
 * "Cancelar" explícitos; la llamada se dispara únicamente al tocar
 * "Confirmar" con una opción real elegida (nunca con el placeholder, y
 * nunca solo por seleccionar una opción con el teclado).
 */
@Component({
  selector: 'app-contactos-adulto',
  imports: [ReactiveFormsModule, Icono],
  templateUrl: './contactos-adulto.html',
  styleUrl: './contactos-adulto.scss',
})
export class ContactosAdulto implements OnInit {
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);

  readonly idGrupo = input.required<number>();
  readonly idAdulto = input.required<number>();
  readonly puedeAdministrar = input<boolean>(false);
  readonly adultoActivo = input<boolean>(false);
  readonly cambio = output<void>();

  protected readonly contactos = signal<RespuestaContacto[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Falla al pedir la lista: se ofrece reintentar, a diferencia de un error de una acción. */
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly agregando = signal(false);
  /** Errores de campo SOLO del formulario "Agregar contacto": nunca se mezclan con los de una fila en edición. */
  protected readonly erroresCamposNuevo = signal<Record<string, string>>({});

  /** idContacto del principal que pide reemplazo antes de desactivarse; null si ninguno. */
  protected readonly pidiendoReemplazoPara = signal<number | null>(null);

  /** idEstado de "INACTIVO" para CONTACTO_EMERGENCIA; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivo = signal<number | null>(null);

  /** Puede administrar Y el adulto está activo: sin esto no hay alta ni acciones por fila. */
  protected readonly puedeActuar = computed(() => this.puedeAdministrar() && this.adultoActivo());

  /** Activos primero, luego inactivos (orden estable dentro de cada grupo). */
  protected readonly contactosOrdenados = computed<RespuestaContacto[]>(() =>
    [...this.contactos()].sort(
      (a, b) => Number(this.estaInactivo(a)) - Number(this.estaInactivo(b)),
    ),
  );

  private readonly controlesReemplazo = new Map<number, FormControl<number | null>>();
  private readonly idsEnEdicion = signal<ReadonlySet<number>>(new Set());
  private readonly formulariosEdicion = new Map<number, FormularioEdicionContacto>();
  /** Errores de campo por fila en edición, aislados por `idContacto` (nunca compartidos con el formulario de alta ni entre filas). */
  private readonly erroresEdicionPorContacto = new Map<
    number,
    ReturnType<typeof signal<Record<string, string>>>
  >();

  protected readonly formulario = this.fb.group({
    nombreContacto: ['', Validators.required],
    parentesco: [''],
    telefono: ['', Validators.required],
    esPrincipal: [false],
  });

  ngOnInit(): void {
    this.cargar();
    this.servicioCatalogos.estados('CONTACTO_EMERGENCIA', 'ESTADO').subscribe({
      next: (estados: RespuestaEstadoCatalogo[]) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivo.set(inactivo?.idEstado ?? null);
      },
      error: () => undefined,
    });
  }

  protected estaInactivo(contacto: RespuestaContacto): boolean {
    const idInactivo = this.idEstadoInactivo();
    return idInactivo !== null && contacto.idEstado === idInactivo;
  }

  protected estaEditando(contacto: RespuestaContacto): boolean {
    return this.idsEnEdicion().has(contacto.idContacto);
  }

  protected contactosActivosExcepto(idContacto: number): RespuestaContacto[] {
    return this.contactos().filter(
      (contacto) => contacto.idContacto !== idContacto && !this.estaInactivo(contacto),
    );
  }

  protected controlReemplazo(idContacto: number): FormControl<number | null> {
    let control = this.controlesReemplazo.get(idContacto);
    if (!control) {
      control = this.fb.control<number | null>(null);
      this.controlesReemplazo.set(idContacto, control);
    }
    return control;
  }

  protected formularioEdicion(contacto: RespuestaContacto): FormularioEdicionContacto {
    let formulario = this.formulariosEdicion.get(contacto.idContacto);
    if (!formulario) {
      formulario = this.crearFormularioEdicion(contacto);
      this.formulariosEdicion.set(contacto.idContacto, formulario);
    }
    return formulario;
  }

  /** Errores de campo de la fila `idContacto` en edición: propios, nunca los del alta ni los de otra fila. */
  protected erroresEdicion(idContacto: number): Record<string, string> {
    return this.erroresEdicionDe(idContacto)();
  }

  /** Error de la API, o si no un mensaje local cuando se tocó sin completar, en el formulario "Agregar contacto". */
  protected mensajeCampoNuevo(
    campo: 'nombreContacto' | 'telefono',
    mensajeRequerido: string,
  ): string | null {
    return mensajeDeCampo(
      this.formulario.controls[campo],
      this.erroresCamposNuevo(),
      campo,
      mensajeRequerido,
    );
  }

  /** Igual que {@link mensajeCampoNuevo}, pero para la fila en edición de `contacto`. */
  protected mensajeCampoEdicion(
    contacto: RespuestaContacto,
    campo: 'nombreContacto' | 'telefono',
    mensajeRequerido: string,
  ): string | null {
    const formulario = this.formularioEdicion(contacto);
    return mensajeDeCampo(
      formulario.controls[campo],
      this.erroresEdicion(contacto.idContacto),
      campo,
      mensajeRequerido,
    );
  }

  protected editar(contacto: RespuestaContacto): void {
    this.error.set(null);
    this.erroresEdicionDe(contacto.idContacto).set({});
    this.formulariosEdicion.set(contacto.idContacto, this.crearFormularioEdicion(contacto));
    this.idsEnEdicion.set(new Set([...this.idsEnEdicion(), contacto.idContacto]));
  }

  protected cancelarEdicion(contacto: RespuestaContacto): void {
    const restantes = new Set(this.idsEnEdicion());
    restantes.delete(contacto.idContacto);
    this.idsEnEdicion.set(restantes);
  }

  protected guardarEdicion(contacto: RespuestaContacto): void {
    const formulario = this.formularioEdicion(contacto);
    if (formulario.invalid) {
      formulario.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.erroresEdicionDe(contacto.idContacto).set({});
    const { nombreContacto, parentesco, telefono } = formulario.getRawValue();
    this.servicioAdultos
      .actualizarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto, {
        nombreContacto: nombreContacto.trim(),
        parentesco: parentesco.trim() === '' ? null : parentesco.trim(),
        telefono: telefono.trim(),
      })
      .subscribe({
        next: () => {
          this.cancelarEdicion(contacto);
          this.cargar();
          this.cambio.emit();
        },
        error: (error: unknown) => {
          const campos = erroresDeCampos(error);
          this.erroresEdicionDe(contacto.idContacto).set(campos);
          if (Object.keys(campos).length === 0) {
            this.error.set(mensajeDeError(error));
          }
        },
      });
  }

  protected hacerPrincipal(contacto: RespuestaContacto): void {
    this.error.set(null);
    this.servicioAdultos
      .designarPrincipal(this.idGrupo(), this.idAdulto(), contacto.idContacto)
      .subscribe({
        next: () => {
          this.cargar();
          this.cambio.emit();
        },
        error: (error: unknown) => this.error.set(mensajeDeError(error)),
      });
  }

  protected desactivar(contacto: RespuestaContacto): void {
    this.error.set(null);
    const otrosActivos = this.contactosActivosExcepto(contacto.idContacto);
    if (contacto.esPrincipal && otrosActivos.length > 0) {
      this.controlReemplazo(contacto.idContacto).setValue(null);
      this.pidiendoReemplazoPara.set(contacto.idContacto);
      this.enfocarSelectDeReemplazo(contacto.idContacto);
      return;
    }
    this.confirmarDesactivar(contacto, undefined);
  }

  /**
   * "Confirmar" del select de reemplazo: nunca se llama a la API solo por
   * elegir una opción (rompería con teclado — WCAG 3.2.2 — y sería un callejón
   * sin salida sin "Cancelar"). El placeholder "Selecciona…" vale null, así
   * que sin una opción real elegida el botón queda deshabilitado y este
   * método no hace nada si de todos modos se invoca.
   */
  protected confirmarReemplazo(contacto: RespuestaContacto): void {
    const idNuevoPrincipal = this.controlReemplazo(contacto.idContacto).value;
    if (idNuevoPrincipal === null) return;
    this.confirmarDesactivar(contacto, idNuevoPrincipal);
  }

  protected cancelarReemplazo(): void {
    this.pidiendoReemplazoPara.set(null);
  }

  /** Foco al <select> recién abierto: quien venía de "Desactivar" no debe perder el lugar en la página. */
  private enfocarSelectDeReemplazo(idContacto: number): void {
    afterNextRender(
      () => {
        document.getElementById(`reemplazo-${idContacto}`)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected reactivar(contacto: RespuestaContacto): void {
    this.error.set(null);
    this.servicioAdultos
      .reactivarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto)
      .subscribe({
        next: () => {
          this.cargar();
          this.cambio.emit();
        },
        error: (error: unknown) => this.error.set(mensajeDeError(error)),
      });
  }

  protected eliminar(contacto: RespuestaContacto): void {
    if (!window.confirm('Solo si fue agregado por error.')) return;

    this.error.set(null);
    this.servicioAdultos
      .eliminarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto)
      .subscribe({
        next: () => {
          this.cargar();
          this.cambio.emit();
        },
        error: (error: unknown) => this.error.set(mensajeDeError(error)),
      });
  }

  protected agregar(): void {
    if (this.agregando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.erroresCamposNuevo.set({});
    const { nombreContacto, parentesco, telefono, esPrincipal } = this.formulario.getRawValue();
    this.agregando.set(true);
    this.servicioAdultos
      .crearContacto(this.idGrupo(), this.idAdulto(), {
        nombreContacto: nombreContacto.trim(),
        parentesco: parentesco.trim() === '' ? null : parentesco.trim(),
        telefono: telefono.trim(),
        esPrincipal: esPrincipal ? true : null,
      })
      .subscribe({
        next: () => {
          this.agregando.set(false);
          this.formulario.reset({
            nombreContacto: '',
            parentesco: '',
            telefono: '',
            esPrincipal: false,
          });
          this.cargar();
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.agregando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCamposNuevo.set(campos);
          if (Object.keys(campos).length === 0) {
            this.error.set(mensajeDeError(error));
          }
        },
      });
  }

  private erroresEdicionDe(idContacto: number): ReturnType<typeof signal<Record<string, string>>> {
    let errores = this.erroresEdicionPorContacto.get(idContacto);
    if (!errores) {
      errores = signal<Record<string, string>>({});
      this.erroresEdicionPorContacto.set(idContacto, errores);
    }
    return errores;
  }

  private confirmarDesactivar(
    contacto: RespuestaContacto,
    idNuevoPrincipal: number | undefined,
  ): void {
    this.servicioAdultos
      .desactivarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto, idNuevoPrincipal)
      .subscribe({
        next: () => {
          this.pidiendoReemplazoPara.set(null);
          this.cargar();
          this.cambio.emit();
        },
        error: (error: unknown) => this.error.set(mensajeDeError(error)),
      });
  }

  private crearFormularioEdicion(contacto: RespuestaContacto): FormularioEdicionContacto {
    return this.fb.group({
      nombreContacto: this.fb.control(contacto.nombreContacto, Validators.required),
      parentesco: this.fb.control(contacto.parentesco ?? ''),
      telefono: this.fb.control(contacto.telefono, Validators.required),
    });
  }

  protected reintentarCarga(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.servicioAdultos.contactos(this.idGrupo(), this.idAdulto()).subscribe({
      next: (contactos) => {
        this.contactos.set(contactos);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.errorCarga.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }
}
