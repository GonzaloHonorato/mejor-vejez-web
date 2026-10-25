import { Routes } from '@angular/router';

import { guardAdministrador } from './nucleo/autenticacion/guard-administrador';
import { guardAutenticado } from './nucleo/autenticacion/guard-autenticado';

export const routes: Routes = [
  {
    path: 'ingreso',
    title: 'Iniciar sesión · Mejor Vejez',
    loadComponent: () => import('./paginas/ingreso/ingreso').then((m) => m.Ingreso),
  },
  {
    path: 'estado',
    title: 'Estado del servicio · Mejor Vejez',
    loadComponent: () =>
      import('./paginas/estado-servicio/estado-servicio').then((m) => m.EstadoServicio),
  },
  {
    path: '',
    canActivate: [guardAutenticado],
    loadComponent: () => import('./compartido/marco-app/marco-app').then((m) => m.MarcoApp),
    children: [
      {
        path: '',
        title: 'Panel familiar · Mejor Vejez',
        data: { tituloPagina: 'Panel familiar' },
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'perfil',
        title: 'Mi perfil · Mejor Vejez',
        data: { tituloPagina: 'Mi perfil' },
        loadComponent: () => import('./paginas/mi-perfil/mi-perfil').then((m) => m.MiPerfil),
      },
      {
        path: 'grupos',
        title: 'Grupos · Mejor Vejez',
        data: { tituloPagina: 'Grupos' },
        loadComponent: () => import('./paginas/grupos/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:idGrupo',
        title: 'Integrantes · Mejor Vejez',
        data: { tituloPagina: 'Integrantes' },
        loadComponent: () =>
          import('./paginas/integrantes/integrantes').then((m) => m.Integrantes),
      },
      {
        path: 'administracion/usuarios',
        title: 'Administración de usuarios · Mejor Vejez',
        data: { tituloPagina: 'Administración' },
        canActivate: [guardAdministrador],
        loadComponent: () =>
          import('./paginas/administracion-usuarios/administracion-usuarios').then(
            (m) => m.AdministracionUsuarios,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
