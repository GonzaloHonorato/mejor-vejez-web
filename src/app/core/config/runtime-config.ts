export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface RuntimeConfig {
  apiUrl: string;
  firebase: FirebaseWebConfig;
}

declare global {
  interface Window {
    __env?: Partial<RuntimeConfig>;
  }
}

/** Lee la configuración que inyecta `env.js` antes de que arranque Angular. */
export function readRuntimeConfig(): RuntimeConfig {
  const env = window.__env ?? {};
  return {
    apiUrl: (env.apiUrl ?? '').replace(/\/+$/, ''),
    firebase: {
      apiKey: env.firebase?.apiKey ?? '',
      authDomain: env.firebase?.authDomain ?? '',
      projectId: env.firebase?.projectId ?? '',
      appId: env.firebase?.appId ?? '',
    },
  };
}

export const runtimeConfig = readRuntimeConfig();

export function isFirebaseConfigured(config: FirebaseWebConfig = runtimeConfig.firebase): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}
