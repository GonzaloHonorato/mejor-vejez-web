import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Event,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map, take } from 'rxjs';

/**
 * La primera navegación terminó. Una cancelación por redirección (p. ej. el
 * guard que manda a `/ingreso`) o por una navegación nueva no cuenta: la
 * que sigue emite su propio fin.
 */
function terminaNavegacion(evento: Event): boolean {
  if (evento instanceof NavigationEnd || evento instanceof NavigationError) return true;
  return (
    evento instanceof NavigationCancel &&
    evento.code !== NavigationCancellationCode.Redirect &&
    evento.code !== NavigationCancellationCode.SupersededByNewNavigation
  );
}

/**
 * Raíz de la app. Mientras Firebase resuelve la sesión (el guard espera) y
 * hasta que termina la primera navegación muestra un esqueleto del marco en
 * vez de la pantalla en blanco.
 */
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);

  protected readonly cargando = toSignal(
    this.router.events.pipe(
      filter(terminaNavegacion),
      take(1),
      map(() => false),
    ),
    { initialValue: true },
  );
}
