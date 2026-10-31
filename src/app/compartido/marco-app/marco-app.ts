import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { Icono, NombreIcono } from '../icono/icono';
import { SelectorGrupo } from '../selector-grupo/selector-grupo';
import { etiquetaRol } from '../../nucleo/grupos/etiqueta-rol';
import { inicialesDe } from './identidad-usuario';
import { EntradaMas, PanelMas, rutaCoincide } from './panel-mas/panel-mas';

const TITULO_POR_DEFECTO = 'Panel familiar';

interface EntradaNavegacion {
  etiqueta: string;
  ruta: string;
  /** Activo también en subrutas (ej. "Grupos" en /grupos/:idGrupo) si es `false`. */
  coincidenciaExacta: boolean;
}

interface EntradaPestana extends EntradaNavegacion {
  icono: NombreIcono;
}

/** Barra lateral (escritorio): todas las entradas; no usa "Más". */
const NAVEGACION_LATERAL: readonly EntradaNavegacion[] = [
  { etiqueta: 'Panel familiar', ruta: '/', coincidenciaExacta: true },
  { etiqueta: 'Tareas', ruta: '/tareas', coincidenciaExacta: false },
  { etiqueta: 'Alertas', ruta: '/alertas', coincidenciaExacta: false },
  { etiqueta: 'Medicamentos', ruta: '/planes', coincidenciaExacta: false },
  { etiqueta: 'Relevos', ruta: '/relevos', coincidenciaExacta: false },
  { etiqueta: 'Adultos mayores', ruta: '/adultos', coincidenciaExacta: false },
  { etiqueta: 'Grupos', ruta: '/grupos', coincidenciaExacta: false },
  { etiqueta: 'Mi perfil', ruta: '/perfil', coincidenciaExacta: true },
];

/** Solo visible si `ServicioYo.obtener().esAdministrador` es true. */
const LATERAL_ADMINISTRACION: EntradaNavegacion = {
  etiqueta: 'Administración',
  ruta: '/administracion/usuarios',
  coincidenciaExacta: true,
};

/** Barra inferior (móvil): 4 accesos fijos; el resto va en "Más". */
const PESTANAS_FIJAS: readonly EntradaPestana[] = [
  { etiqueta: 'Panel', ruta: '/', coincidenciaExacta: true, icono: 'panel' },
  { etiqueta: 'Tareas', ruta: '/tareas', coincidenciaExacta: false, icono: 'tareas' },
  { etiqueta: 'Alertas', ruta: '/alertas', coincidenciaExacta: false, icono: 'alertas' },
  { etiqueta: 'Personas', ruta: '/adultos', coincidenciaExacta: false, icono: 'personas' },
];

const ENTRADAS_MAS: readonly EntradaMas[] = [
  { etiqueta: 'Remedios', ruta: '/planes', icono: 'remedios', prefijoActivo: '/planes' },
  { etiqueta: 'Relevos', ruta: '/relevos', icono: 'relevos', prefijoActivo: '/relevos' },
  { etiqueta: 'Grupos', ruta: '/grupos', icono: 'grupos', prefijoActivo: '/grupos' },
  { etiqueta: 'Perfil', ruta: '/perfil', icono: 'perfil', prefijoActivo: '/perfil' },
];

/** Cubre todo `/administracion/...` (usuarios y auditoría global). */
const MAS_ADMINISTRACION: EntradaMas = {
  etiqueta: 'Administración',
  ruta: '/administracion/usuarios',
  icono: 'administracion',
  prefijoActivo: '/administracion',
};

/**
 * Marco de la aplicación autenticada, celular primero. En celular: cabecera
 * con la marca, el grupo activo y el avatar, y barra de pestañas inferior
 * (4 fijas + "Más", que abre `PanelMas` con el resto de accesos, el correo y
 * "Cerrar sesión"). Desde tableta: barra lateral oscura y cabecera con el
 * título de la página, el grupo, el usuario con su rol y "Cerrar sesión".
 */
@Component({
  selector: 'app-marco-app',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SelectorGrupo, Icono, PanelMas],
  templateUrl: './marco-app.html',
  styleUrl: './marco-app.scss',
})
export class MarcoApp implements OnInit {
  private readonly auth = inject(ServicioAutenticacion);
  private readonly router = inject(Router);
  private readonly grupoActivo = inject(ServicioGrupoActivo);
  private readonly servicioYo = inject(ServicioYo);
  private readonly destroyRef = inject(DestroyRef);

  private readonly esAdministrador = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tituloRuta = signal(TITULO_POR_DEFECTO);
  private readonly correoYo = signal('');
  private readonly nombreYo = signal('');
  /** URL actual (se actualiza en cada `NavigationEnd`): decide si "Más" está activo. */
  protected readonly urlActual = signal('');
  protected readonly masAbierto = signal(false);
  /**
   * Con "Más" abierto, todo lo de detrás (salto, lateral, cabecera, main y
   * pie) queda `inert`. La barra de pestañas no, para que al cerrar el foco
   * pueda volver al botón "Más" de inmediato.
   */
  protected readonly inerteDetras = computed(() => (this.masAbierto() ? '' : null));
  private readonly botonMas = viewChild.required<ElementRef<HTMLButtonElement>>('botonMas');

  protected readonly navegacion = computed<readonly EntradaNavegacion[]>(() =>
    this.esAdministrador() ? [...NAVEGACION_LATERAL, LATERAL_ADMINISTRACION] : NAVEGACION_LATERAL,
  );
  protected readonly pestanas = PESTANAS_FIJAS;
  protected readonly entradasMas = computed<readonly EntradaMas[]>(() =>
    this.esAdministrador() ? [...ENTRADAS_MAS, MAS_ADMINISTRACION] : ENTRADAS_MAS,
  );
  /** "Más" se marca activo si la ruta actual (o una subruta) es una de las del panel. */
  protected readonly masActivo = computed(() =>
    this.entradasMas().some((entrada) => rutaCoincide(this.urlActual(), entrada.prefijoActivo)),
  );
  /**
   * Nombre de la cabecera y del avatar: el del núcleo (`GET /api/yo`) cuando
   * llega; mientras tanto, o si falla, el de Firebase y luego el correo.
   */
  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    return this.nombreYo() || usuario?.displayName || usuario?.email || '';
  });
  protected readonly iniciales = computed(() => inicialesDe(this.nombreUsuario()));
  /** Rol en el grupo activo ("Coordinador/a", "Colaborador/a"); vacío si no hay. */
  protected readonly rolActivo = computed(() => etiquetaRol(this.grupoActivo.activo()?.miRol));
  protected readonly correoUsuario = computed(() => this.auth.usuario()?.email || this.correoYo());

  ngOnInit(): void {
    this.grupoActivo.cargar();
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.esAdministrador.set(yo.esAdministrador);
        this.correoYo.set(yo.email ?? '');
        this.nombreYo.set(yo.nombre?.trim() ?? '');
      },
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos verificar tus permisos.')),
    });

    this.actualizarTituloRuta();
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.actualizarTituloRuta();
        this.cerrarMas();
      });
  }

  protected alternarMas(): void {
    if (this.masAbierto()) {
      this.cerrarMas();
    } else {
      this.masAbierto.set(true);
    }
  }

  /** Cierra "Más" (Escape, fondo, "Cerrar" o navegación) y devuelve el foco a su botón. */
  protected cerrarMas(): void {
    if (!this.masAbierto()) return;
    this.masAbierto.set(false);
    this.botonMas().nativeElement.focus();
  }

  /** URL actual y título del encabezado: el de la ruta hija activa, no uno fijo. */
  private actualizarTituloRuta(): void {
    this.urlActual.set(this.router.url);
    let ruta: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (ruta.firstChild) {
      ruta = ruta.firstChild;
    }
    this.tituloRuta.set((ruta.data['tituloPagina'] as string | undefined) ?? TITULO_POR_DEFECTO);
  }

  /** Navega a /ingreso solo si Firebase cerró la sesión; si falla, lo registra y no navega. */
  protected async cerrarSesion(): Promise<void> {
    // Se cierra "Más" antes de intentar, para que un fallo de `signOut` o
    // de la navegación no deje el fondo `inert`.
    this.cerrarMas();
    try {
      await this.auth.cerrarSesion();
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      return;
    }
    this.grupoActivo.limpiar();
    await this.router.navigateByUrl('/ingreso');
  }
}
