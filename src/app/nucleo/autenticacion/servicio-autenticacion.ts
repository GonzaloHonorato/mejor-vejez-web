import { Injectable, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  confirmPasswordReset,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  verifyPasswordResetCode,
} from 'firebase/auth';

import { configuracionEjecucion, firebaseConfigurado } from '../configuracion/configuracion-ejecucion';

/**
 * true si `usuario` tiene el proveedor "password" entre sus `providerData`
 * (no solo Google u otro proveedor externo). Función pura (sin Firebase Auth
 * en vivo) para poder probarla sin mockear el SDK.
 */
export function tieneProveedorClave(usuario: User | null): boolean {
  return usuario?.providerData.some((proveedor) => proveedor.providerId === 'password') ?? false;
}

/**
 * Orquesta "reautenticar, luego fijar la clave nueva": si `reautenticar`
 * falla, `actualizar` nunca se llama. Función pura (recibe las operaciones
 * como funciones) para poder probar el orden y el corte temprano sin
 * mockear el SDK de Firebase.
 */
export async function reautenticarYCambiarClave(
  reautenticar: () => Promise<unknown>,
  actualizar: () => Promise<void>,
): Promise<void> {
  await reautenticar();
  await actualizar();
}

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

  /** Correo de la cuenta del `codigo` (el `oobCode` del enlace de restablecimiento), si sigue vigente. */
  async verificarCodigoRecuperarClave(codigo: string): Promise<string> {
    return verifyPasswordResetCode(this.requerirAuth(), codigo);
  }

  /** Fija la contraseña nueva con el `codigo` del enlace de restablecimiento. */
  async confirmarRecuperarClave(codigo: string, claveNueva: string): Promise<void> {
    await confirmPasswordReset(this.requerirAuth(), codigo, claveNueva);
  }

  /** true si la sesión actual puede cambiar su contraseña (tiene el proveedor "password", no solo Google). */
  tieneAccesoConClave(): boolean {
    return tieneProveedorClave(this.usuario());
  }

  /** Reautentica con la contraseña actual y fija la nueva (requiere sesión con correo y contraseña). */
  async cambiarClave(claveActual: string, claveNueva: string): Promise<void> {
    const usuario = this.requerirAuth().currentUser;
    if (!usuario?.email) {
      throw new Error('No hay una sesión con correo y contraseña.');
    }
    const credencial = EmailAuthProvider.credential(usuario.email, claveActual);
    await reautenticarYCambiarClave(
      () => reauthenticateWithCredential(usuario, credencial),
      () => updatePassword(usuario, claveNueva),
    );
  }

  private requerirAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase Auth no está configurado');
    }
    return this.auth;
  }
}
