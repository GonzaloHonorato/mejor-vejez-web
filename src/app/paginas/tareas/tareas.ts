import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AccionesTarea } from './acciones-tarea/acciones-tarea';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { formatearFecha, formatearHora, hoyEnSantiago, nombreDia, sumarDias } from '../../nucleo/fechas';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { QuienConfirma } from '../../nucleo/tareas/estados-tarea';
import { RespuestaTarea } from '../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../nucleo/tareas/servicio-tareas';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Página "Tareas" (`/tareas?fecha=yyyy-mm-dd&idAdulto=`): agenda de un día
 * del grupo activo. Sigue el mismo patrón de `paginas/planes`: un `effect()`
 * con contador de generación recarga (o limpia) la lista cada vez que el
 * grupo activo, la fecha o los filtros cambian; el día por defecto es
 * `hoyEnSantiago()` (nunca la fecha del navegador).
 *
 * `desde`/`hasta` de `ServicioTareas.listar` son fechas INCLUSIVAS (contrato
 * de la Tarea 5 de la API: la ventana real es `[desde 00:00, hasta + 1
 * 00:00)` en Santiago; `hasta` nulo equivale a `desde`). Para pedir la
 * agenda de un solo día se envían ambas iguales a la fecha elegida (nunca
 * `sumarDias(fecha, 1)`, que pediría dos días).
 */
@Component({
  selector: 'app-tareas',
  imports: [ReactiveFormsModule, RouterLink, AccionesTarea],
  templateUrl: './tareas.html',
  styleUrl: './tareas.scss',
})
export class Tareas implements OnInit {
  private readonly servicioTareas = inject(ServicioTareas);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly formatearFecha = formatearFecha;
  protected readonly formatearHora = formatearHora;
  protected readonly nombreDia = nombreDia;

  protected readonly tareas = signal<RespuestaTarea[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly adultosFiltro = signal<RespuestaAdultoMayor[]>([]);
  protected readonly esAdministrador = signal(false);
  private readonly idUsuario = signal<number | null>(null);

  /** Fecha elegida (`yyyy-mm-dd`), inicializada con el query param `fecha` o `hoyEnSantiago()`. */
  protected readonly fecha = signal(this.leerFechaDeLaUrl());
  /** Filtro "Adulto mayor", inicializado con el query param `idAdulto`. */
  protected readonly idAdultoFiltro = signal<number | null>(this.leerIdAdultoDeLaUrl());
  protected readonly soloMisTareas = signal(false);

  protected readonly controlFecha = this.fb.control<string>(this.fecha());
  protected readonly controlFiltroAdulto = this.fb.control<number | null>(this.idAdultoFiltro());

  protected readonly tituloDia = computed(() => `${nombreDia(this.fecha())} ${formatearFecha(this.fecha())}`);

  /** Sin grupo activo no hay nada que administrar, aunque la persona sea admin. */
  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  /** `quien` para `AccionesTarea`: el usuario autenticado y su rol en el grupo activo. */
  protected readonly quien = computed<QuienConfirma>(() => ({
    idUsuario: this.idUsuario() ?? -1,
    miRol: this.activo()?.miRol ?? null,
    esAdministrador: this.esAdministrador(),
  }));

  /** Descarta respuestas de `listar()` obsoletas (grupo o filtros ya cambiaron de nuevo). */
  private generacionCarga = 0;
  /** Descarta respuestas de `ServicioAdultos.listar()` obsoletas (el grupo ya cambió de nuevo). */
  private generacionAdultos = 0;
  /** idGrupo con el que ya se vio el filtro de adulto; null hasta la primera emisión. */
  private idGrupoFiltro: number | null = null;

  constructor() {
    // Lista de adultos del grupo (filtro): solo cambia con el grupo.
    effect(() => {
      const grupo = this.activo();
      this.adultosFiltro.set([]);
      if (!grupo) return;

      const generacion = ++this.generacionAdultos;
      this.servicioAdultos.listar(grupo.idGrupo, true).subscribe({
        next: (adultos) => {
          if (generacion !== this.generacionAdultos) return;
          this.adultosFiltro.set(adultos);
        },
        // Defensivo: sin la lista simplemente no hay opciones en el filtro.
        error: () => undefined,
      });
    });

    // Si el grupo activo cambia de verdad (no en la carga inicial), el
    // filtro de adulto del grupo anterior ya no tiene sentido: ese adulto
    // puede no existir en el grupo nuevo y `ServicioConsultaTareas` responde
    // 404, dejando la agenda vacía con un error en pantalla (hallazgo I2).
    // Se limpia antes de que el efecto de carga, declarado después, lea
    // `idAdultoFiltro()` y arme la petición.
    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoFiltro === null) {
        this.idGrupoFiltro = grupo?.idGrupo ?? null;
        return;
      }
      if (grupo && grupo.idGrupo !== this.idGrupoFiltro) {
        this.idGrupoFiltro = grupo.idGrupo;
        this.idAdultoFiltro.set(null);
        this.controlFiltroAdulto.setValue(null);
        this.router.navigate([], {
          relativeTo: this.ruta,
          queryParams: { idAdulto: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

    effect(() => {
      const grupo = this.activo();
      const fecha = this.fecha();
      const idAdulto = this.idAdultoFiltro();
      const soloMias = this.soloMisTareas();

      this.error.set(null);
      // Nunca se muestran tareas del grupo/día anterior mientras carga el nuevo.
      this.tareas.set([]);

      if (!grupo) {
        this.cargando.set(false);
        return;
      }
      this.cargar(grupo.idGrupo, fecha, idAdulto, soloMias);
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.idUsuario.set(yo.idUsuario);
        this.esAdministrador.set(yo.esAdministrador);
      },
      // Defensivo: sin esto no se muestran acciones de coordinador/admin ni "Nueva tarea".
      error: () => undefined,
    });
    this.servicioCatalogos.estados('TAREA_CUIDADO', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      // Defensivo: sin el catálogo no se muestran insignias de estado ni acciones.
      error: () => undefined,
    });
  }

  protected descripcionEstado(tarea: RespuestaTarea): string {
    return this.estados().find((estado) => estado.idEstado === tarea.idEstado)?.descripcion ?? '';
  }

  protected responsable(tarea: RespuestaTarea): string {
    return tarea.responsable?.nombre ?? 'Sin asignar';
  }

  protected anterior(): void {
    this.cambiarFecha(sumarDias(this.fecha(), -1));
  }

  protected siguiente(): void {
    this.cambiarFecha(sumarDias(this.fecha(), 1));
  }

  protected hoy(): void {
    this.cambiarFecha(hoyEnSantiago());
  }

  /** Cambio del `<input type="date">`: ignora un valor vacío (el navegador no deja fecha sin elegir). */
  protected cambiarFechaDesdeInput(): void {
    const valor = this.controlFecha.value;
    if (valor === '') return;
    this.cambiarFecha(valor);
  }

  /** Cambia el filtro de adulto y lo refleja en el query param `idAdulto` de la URL. */
  protected cambiarFiltroAdulto(): void {
    const idAdulto = this.controlFiltroAdulto.value;
    this.idAdultoFiltro.set(idAdulto);
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { idAdulto },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected alternarSoloMisTareas(): void {
    this.soloMisTareas.set(!this.soloMisTareas());
  }

  protected actualizarTarea(tareaActualizada: RespuestaTarea): void {
    this.tareas.update((lista) =>
      lista.map((tarea) => (tarea.idTarea === tareaActualizada.idTarea ? tareaActualizada : tarea)),
    );
  }

  private cambiarFecha(fecha: string): void {
    this.fecha.set(fecha);
    this.controlFecha.setValue(fecha);
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { fecha },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private cargar(idGrupo: number, fecha: string, idAdulto: number | null, soloMias: boolean): void {
    const generacion = ++this.generacionCarga;
    this.cargando.set(true);
    this.error.set(null);
    this.servicioTareas
      .listar(idGrupo, { desde: fecha, hasta: fecha, idAdulto: idAdulto ?? undefined, soloMias })
      .subscribe({
        next: (tareas) => {
          if (generacion !== this.generacionCarga) return;
          this.tareas.set(tareas);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          if (generacion !== this.generacionCarga) return;
          this.error.set(mensajeDeError(error));
          this.cargando.set(false);
        },
      });
  }

  private leerFechaDeLaUrl(): string {
    const valor = this.ruta.snapshot.queryParamMap.get('fecha');
    return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : hoyEnSantiago();
  }

  private leerIdAdultoDeLaUrl(): number | null {
    const valor = this.ruta.snapshot.queryParamMap.get('idAdulto');
    if (!valor) return null;
    const idAdulto = Number(valor);
    return Number.isFinite(idAdulto) ? idAdulto : null;
  }
}
