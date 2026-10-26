import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
import { SelectorGrupo } from '../selector-grupo/selector-grupo';

const TITULO_POR_DEFECTO = 'Panel familiar';

interface EntradaNavegacion {
  /** Texto en la barra lateral (escritorio). */
  etiqueta: string;
  /** Texto corto en la barra inferior (móvil). */
  etiquetaCorta: string;
  /** Sin ruta = todavía no existe en F0; se muestra deshabilitada. */
  ruta?: string;
  /** Activo también en subrutas (ej. "Grupos" en /grupos/:idGrupo). Por defecto, coincidencia exacta. */
  coincidenciaExacta?: boolean;
}

const NAVEGACION_BASE: readonly EntradaNavegacion[] = [
  { etiqueta: 'Panel familiar', etiquetaCorta: 'Panel', ruta: '/', coincidenciaExacta: true },
  { etiqueta: 'Tareas', etiquetaCorta: 'Tareas' },
  { etiqueta: 'Alertas', etiquetaCorta: 'Alertas' },
  { etiqueta: 'Medicamentos', etiquetaCorta: 'Remedios', ruta: '/planes', coincidenciaExacta: false },
  { etiqueta: 'Adultos mayores', etiquetaCorta: 'Personas', ruta: '/adultos', coincidenciaExacta: false },
  { etiqueta: 'Grupos', etiquetaCorta: 'Grupos', ruta: '/grupos', coincidenciaExacta: false },
  { etiqueta: 'Mi perfil', etiquetaCorta: 'Perfil', ruta: '/perfil', coincidenciaExacta: true },
];

/** Solo visible si `ServicioYo.obtener().esAdministrador` es true. */
const ENTRADA_ADMINISTRACION: EntradaNavegacion = {
  etiqueta: 'Administración',
  etiquetaCorta: 'Admin',
  ruta: '/administracion/usuarios',
  coincidenciaExacta: true,
};

/**
 * Marco de la aplicación autenticada (opción C): barra lateral oscura en
 * escritorio y barra de pestañas inferior en móvil.
 */
@Component({
  selector: 'app-marco-app',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SelectorGrupo],
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

  protected readonly navegacion = computed<readonly EntradaNavegacion[]>(() =>
    this.esAdministrador() ? [...NAVEGACION_BASE, ENTRADA_ADMINISTRACION] : NAVEGACION_BASE,
  );
  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    return usuario?.displayName || usuario?.email || '';
  });

  ngOnInit(): void {
    this.grupoActivo.cargar();
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos verificar tus permisos.')),
    });

    this.actualizarTituloRuta();
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.actualizarTituloRuta());
  }

  /** Título del encabezado (opción C): el de la ruta hija activa, no uno fijo (ver hallazgo A11y). */
  private actualizarTituloRuta(): void {
    let ruta: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (ruta.firstChild) {
      ruta = ruta.firstChild;
    }
    this.tituloRuta.set((ruta.data['tituloPagina'] as string | undefined) ?? TITULO_POR_DEFECTO);
  }

  /** Navega a /ingreso solo si Firebase cerró la sesión; si falla, lo registra y no navega. */
  protected async cerrarSesion(): Promise<void> {
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
