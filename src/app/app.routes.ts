import { Routes } from '@angular/router';

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
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
