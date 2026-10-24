// Configuración en RUNTIME. En el contenedor, nginx reescribe este archivo al
// arrancar con las variables de entorno (ver docker/40-runtime-env.sh), así la
// misma imagen sirve para cualquier entorno. Este valor es el de desarrollo.
window.__env = {
  apiUrl: 'http://localhost:8080',
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },
};
