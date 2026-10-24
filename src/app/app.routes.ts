import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/en-construccion/en-construccion').then((m) => m.EnConstruccion),
  },
  { path: '**', redirectTo: '' },
];
