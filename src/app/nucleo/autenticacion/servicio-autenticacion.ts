import { Injectable, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

import { configuracionEjecucion, firebaseConfigurado } from '../configuracion/configuracion-ejecucion';

/**
 * Sesión con Firebase Auth. Si la config de Firebase viene vacía la app
 * funciona igual, sin sesión: `habilitado` queda en false.
 */
@Injectable({ providedIn: 'root' })
export class ServicioAutenticacion {
  readonly habilitado = firebaseConfigurado();
  readonly usuario = signal<User | null>(null);
  /** false hasta que Firebase resuelve si hay sesión guardada. */
  readonly listo = signal(!this.habilitado);

  private readonly auth: Auth | null = null;

  constructor() {
    if (!this.habilitado) {
      return;
    }
    const app: FirebaseApp = initializeApp(configuracionEjecucion.firebase);
    this.auth = getAuth(app);
    onAuthStateChanged(this.auth, (usuario) => {
      this.usuario.set(usuario);
      this.listo.set(true);
    });
  }

  async ingresarConGoogle(): Promise<void> {
    await signInWithPopup(this.requerirAuth(), new GoogleAuthProvider());
  }

  async ingresarConCorreo(correo: string, clave: string): Promise<void> {
    await signInWithEmailAndPassword(this.requerirAuth(), correo, clave);
  }

  async cerrarSesion(): Promise<void> {
    await signOut(this.requerirAuth());
  }

  /** ID token vigente (Firebase lo renueva solo) o null sin sesión. */
  async tokenId(): Promise<string | null> {
    return this.auth?.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  private requerirAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase Auth no está configurado');
    }
    return this.auth;
  }
}
