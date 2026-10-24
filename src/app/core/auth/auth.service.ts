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

import { isFirebaseConfigured, runtimeConfig } from '../config/runtime-config';

/**
 * Sesión con Firebase Auth. Si la config de Firebase viene vacía la app
 * funciona igual, sin sesión: `enabled` queda en false.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly enabled = isFirebaseConfigured();
  readonly user = signal<User | null>(null);
  /** false hasta que Firebase resuelve si hay sesión guardada. */
  readonly ready = signal(!this.enabled);

  private readonly auth: Auth | null = null;

  constructor() {
    if (!this.enabled) {
      return;
    }
    const app: FirebaseApp = initializeApp(runtimeConfig.firebase);
    this.auth = getAuth(app);
    onAuthStateChanged(this.auth, (user) => {
      this.user.set(user);
      this.ready.set(true);
    });
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.requireAuth(), new GoogleAuthProvider());
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.requireAuth(), email, password);
  }

  async signOut(): Promise<void> {
    await signOut(this.requireAuth());
  }

  /** ID token vigente (Firebase lo renueva solo) o null sin sesión. */
  async idToken(): Promise<string | null> {
    return this.auth?.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  private requireAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase Auth no está configurado');
    }
    return this.auth;
  }
}
