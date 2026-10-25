export interface ConfiguracionFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface ConfiguracionEjecucion {
  urlApi: string;
  firebase: ConfiguracionFirebase;
}

declare global {
  interface Window {
    __env?: Partial<ConfiguracionEjecucion>;
  }
}

/** Lee la configuración que inyecta `env.js` antes de que arranque Angular. */
export function leerConfiguracionEjecucion(): ConfiguracionEjecucion {
  const env = window.__env ?? {};
  return {
    urlApi: (env.urlApi ?? '').replace(/\/+$/, ''),
    firebase: {
      apiKey: env.firebase?.apiKey ?? '',
      authDomain: env.firebase?.authDomain ?? '',
      projectId: env.firebase?.projectId ?? '',
      appId: env.firebase?.appId ?? '',
    },
  };
}

export const configuracionEjecucion = leerConfiguracionEjecucion();

export function firebaseConfigurado(
  config: ConfiguracionFirebase = configuracionEjecucion.firebase,
): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}
