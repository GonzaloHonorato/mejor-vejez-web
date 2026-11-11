import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AccionMenu, BotonDividido } from '../../../compartido/boton-dividido/boton-dividido';
import { RespuestaContacto } from '../../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../../nucleo/adultos/servicio-adultos';
import {
  RespuestaEstadoCatalogo,
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../../nucleo/catalogos/servicio-catalogos';
import {
  describirCon,
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../../nucleo/http/mensaje-de-error';
import {
  AYUDA_TELEFONO,
  enlaceTelefono,
  formatearControlTelefono,
  formatearTelefono,
  mensajeCampoTelefono,
  normalizarTelefono,
  validadorTelefonoChileno,
} from '../../../nucleo/telefono';
import {
  dentroDe,
  devolverFoco,
  enfocarPrimerCampoInvalido,
  mostrarAviso,
  mostrarSeccion,
  porId,
  porSelector,
  primeroQueExista,
} from '../../../nucleo/foco';

type FormularioEdicionContacto = FormGroup<{
  nombreContacto: FormControl<string>;
  idParentesco: FormControl<number | null>;
  telefono: FormControl<string>;
}>;

type CampoContacto = 'nombreContacto' | 'idParentesco' | 'telefono';

const MENSAJES_REQUERIDO: Record<CampoContacto, string> = {
  nombreContacto: 'Ingresa el nombre del contacto',
  idParentesco: 'Elige el parentesco',
  telefono: 'Ingresa un teléfono',
};

/**
 * Lista de contactos de emergencia de un adulto mayor, con administración
 * (alta, edición en el lugar, designar principal, desactivar/reactivar,
 * eliminar) cuando `puedeAdministrar() && adultoActivo()`. Se usa dentro de
 * `FichaAdulto`: `idGrupo`/`idAdulto` son obligatorios porque sin ellos no
 * hay contactos que pedir.
 *
 * El parentesco se elige del catálogo `PARENTESCO`; un contacto antiguo sin
 * parentesco se muestra como "Sin parentesco" y, al editarlo, hay que elegir
 * uno de la lista. El teléfono sigue la regla chilena de `nucleo/telefono` y se
 * muestra formateado.
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
  imports: [ReactiveFormsModule, BotonDividido],
  templateUrl: './contactos-adulto.html',
  styleUrl: './contactos-adulto.scss',
})
export class ContactosAdulto implements OnInit {
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly idGrupo = input.required<number>();
  readonly idAdulto = input.required<number>();
  readonly puedeAdministrar = input<boolean>(false);
  readonly adultoActivo = input<boolean>(false);
  readonly cambio = output<void>();

  protected readonly ayudaTelefono = AYUDA_TELEFONO;
  protected readonly formatearTelefono = formatearTelefono;
  protected readonly enlaceTelefono = enlaceTelefono;
  protected readonly parentescos = signal<RespuestaOpcionCatalogo[]>([]);

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
    idParentesco: this.fb.control<number | null>(null, Validators.required),
    telefono: ['', [Validators.required, validadorTelefonoChileno]],
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
    this.servicioCatalogos.opciones('PARENTESCO').subscribe({
      next: (opciones) => this.parentescos.set(opciones),
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos cargar los parentescos.')),
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
  protected mensajeCampoNuevo(campo: CampoContacto): string | null {
    return this.mensajeCampo(this.formulario.controls[campo], this.erroresCamposNuevo(), campo);
  }

  /** Igual que {@link mensajeCampoNuevo}, pero para la fila en edición de `contacto`. */
  protected mensajeCampoEdicion(contacto: RespuestaContacto, campo: CampoContacto): string | null {
    return this.mensajeCampo(
      this.formularioEdicion(contacto).controls[campo],
      this.erroresEdicion(contacto.idContacto),
      campo,
    );
  }

  protected readonly describirCon = describirCon;

  protected formatearTelefonoNuevo(): void {
    formatearControlTelefono(this.formulario.controls.telefono);
  }

  protected formatearTelefonoEdicion(contacto: RespuestaContacto): void {
    formatearControlTelefono(this.formularioEdicion(contacto).controls.telefono);
  }

  private mensajeCampo(
    control: AbstractControl,
    errores: Record<string, string>,
    campo: CampoContacto,
  ): string | null {
    return campo === 'telefono'
      ? mensajeCampoTelefono(control, errores, campo, MENSAJES_REQUERIDO.telefono)
      : mensajeDeCampo(control, errores, campo, MENSAJES_REQUERIDO[campo]);
  }

  /** Menú del botón "Editar" de una fila: mismas acciones que antes, Eliminar al final. */
  protected accionesMenu(contacto: RespuestaContacto): AccionMenu[] {
    const inactivo = this.estaInactivo(contacto);
    return [
      ...(!contacto.esPrincipal && !inactivo
        ? [{ id: 'principal', etiqueta: 'Hacer principal' }]
        : []),
      inactivo
        ? { id: 'reactivar', etiqueta: 'Reactivar' }
        : { id: 'desactivar', etiqueta: 'Desactivar' },
      { id: 'eliminar', etiqueta: 'Eliminar', peligro: true },
    ];
  }

  protected ejecutar(contacto: RespuestaContacto, id: string): void {
    if (id === 'principal') this.hacerPrincipal(contacto);
    if (id === 'desactivar') this.desactivar(contacto);
    if (id === 'reactivar') this.reactivar(contacto);
    if (id === 'eliminar') this.eliminar(contacto);
  }

  protected editar(contacto: RespuestaContacto): void {
    this.error.set(null);
    this.erroresEdicionDe(contacto.idContacto).set({});
    this.formulariosEdicion.set(contacto.idContacto, this.crearFormularioEdicion(contacto));
    this.idsEnEdicion.set(new Set([...this.idsEnEdicion(), contacto.idContacto]));
    // La fila de edición vive dentro de la grilla (con scroll propio desde
    // tableta): `scrollIntoView` mueve la grilla y la página.
    const campo = porId(`contacto-nombre-${contacto.idContacto}`);
    mostrarSeccion(() => campo()?.closest('tr'), this.injector, campo);
  }

  protected cancelarEdicion(contacto: RespuestaContacto): void {
    const restantes = new Set(this.idsEnEdicion());
    restantes.delete(contacto.idContacto);
    this.idsEnEdicion.set(restantes);
    this.enfocarFila(contacto.idContacto);
  }

  protected guardarEdicion(contacto: RespuestaContacto): void {
    const formulario = this.formularioEdicion(contacto);
    if (formulario.invalid) {
      formulario.markAllAsTouched();
      this.enfocarPrimerInvalidoDeFila(contacto);
      return;
    }

    this.error.set(null);
    this.erroresEdicionDe(contacto.idContacto).set({});
    const { nombreContacto, idParentesco, telefono } = formulario.getRawValue();
    this.servicioAdultos
      .actualizarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto, {
        nombreContacto: nombreContacto.trim(),
        idParentesco: idParentesco!,
        telefono: normalizarTelefono(telefono) ?? telefono.trim(),
      })
      .subscribe({
        next: () => {
          this.cancelarEdicion(contacto);
          this.cargar(() => this.enfocarFila(contacto.idContacto));
          this.cambio.emit();
        },
        error: (error: unknown) => {
          const campos = erroresDeCampos(error);
          this.erroresEdicionDe(contacto.idContacto).set(campos);
          if (Object.keys(campos).length === 0) {
            this.mostrarError(error);
          } else {
            this.enfocarPrimerInvalidoDeFila(contacto);
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
          // La fila cambia de lugar (los principales van primero): el foco la sigue.
          this.cargar(() => this.enfocarFila(contacto.idContacto));
          this.cambio.emit();
        },
        error: (error: unknown) => this.mostrarError(error),
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
    const idContacto = this.pidiendoReemplazoPara();
    this.pidiendoReemplazoPara.set(null);
    if (idContacto !== null) this.enfocarFila(idContacto);
  }

  /** Foco al <select> recién abierto: quien venía de "Desactivar" no debe perder el lugar en la página. */
  private enfocarSelectDeReemplazo(idContacto: number): void {
    const campo = porId(`reemplazo-${idContacto}`);
    mostrarSeccion(() => campo()?.closest('.reemplazo'), this.injector, campo);
  }

  /** Muestra un error de acción en la cabecera de la tarjeta, que puede quedar fuera de la vista. */
  private mostrarError(error: unknown): void {
    this.error.set(mensajeDeError(error));
    mostrarAviso(porId('contactos-error'), this.injector);
  }

  private enfocarPrimerInvalidoDelAlta(): void {
    enfocarPrimerCampoInvalido(dentroDe(this.host, '.alta form'), this.injector);
  }

  private enfocarPrimerInvalidoDeFila(contacto: RespuestaContacto): void {
    enfocarPrimerCampoInvalido(
      () => document.getElementById(`contacto-nombre-${contacto.idContacto}`)?.closest('form'),
      this.injector,
    );
  }

  /**
   * Devuelve el foco al "Editar" de la fila del contacto; si la fila ya no
   * está (se eliminó), al título de la tarjeta. Nunca queda en `body`.
   */
  private enfocarFila(idContacto: number | undefined): void {
    devolverFoco(
      primeroQueExista(
        idContacto === undefined
          ? () => null
          : porSelector(`#contacto-editar-${idContacto} .mv-boton-dividido__principal`),
        porId('contactos-titulo'),
      ),
      this.injector,
    );
  }

  protected reactivar(contacto: RespuestaContacto): void {
    this.error.set(null);
    this.servicioAdultos
      .reactivarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto)
      .subscribe({
        next: () => {
          this.cargar(() => this.enfocarFila(contacto.idContacto));
          this.cambio.emit();
        },
        error: (error: unknown) => this.mostrarError(error),
      });
  }

  protected eliminar(contacto: RespuestaContacto): void {
    if (!window.confirm('Solo si fue agregado por error.')) return;

    this.error.set(null);
    // La fila desaparece: el foco pasa a la siguiente (o la anterior) o al título.
    const filas = this.contactosOrdenados();
    const indice = filas.findIndex((c) => c.idContacto === contacto.idContacto);
    const vecina = filas[indice + 1] ?? filas[indice - 1];
    this.servicioAdultos
      .eliminarContacto(this.idGrupo(), this.idAdulto(), contacto.idContacto)
      .subscribe({
        next: () => {
          this.cargar(() => this.enfocarFila(vecina?.idContacto));
          this.cambio.emit();
        },
        error: (error: unknown) => this.mostrarError(error),
      });
  }

  protected agregar(): void {
    if (this.agregando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerInvalidoDelAlta();
      return;
    }

    this.error.set(null);
    this.erroresCamposNuevo.set({});
    const { nombreContacto, idParentesco, telefono, esPrincipal } = this.formulario.getRawValue();
    this.agregando.set(true);
    this.servicioAdultos
      .crearContacto(this.idGrupo(), this.idAdulto(), {
        nombreContacto: nombreContacto.trim(),
        idParentesco: idParentesco!,
        telefono: normalizarTelefono(telefono) ?? telefono.trim(),
        esPrincipal: esPrincipal ? true : null,
      })
      .subscribe({
        next: () => {
          this.agregando.set(false);
          this.formulario.reset({
            nombreContacto: '',
            idParentesco: null,
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
            this.mostrarError(error);
          } else {
            this.enfocarPrimerInvalidoDelAlta();
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
          this.cargar(() => this.enfocarFila(contacto.idContacto));
          this.cambio.emit();
        },
        error: (error: unknown) => this.mostrarError(error),
      });
  }

  private crearFormularioEdicion(contacto: RespuestaContacto): FormularioEdicionContacto {
    return this.fb.group({
      nombreContacto: this.fb.control(contacto.nombreContacto, Validators.required),
      idParentesco: this.fb.control<number | null>(contacto.idParentesco, Validators.required),
      telefono: this.fb.control(formatearTelefono(contacto.telefono), [
        Validators.required,
        validadorTelefonoChileno,
      ]),
    });
  }

  protected reintentarCarga(): void {
    this.cargar();
  }

  private cargar(alTerminar?: () => void): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.servicioAdultos.contactos(this.idGrupo(), this.idAdulto()).subscribe({
      next: (contactos) => {
        this.contactos.set(contactos);
        this.cargando.set(false);
        alTerminar?.();
      },
      error: (error: unknown) => {
        this.errorCarga.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }
}
