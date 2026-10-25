// Configuración en RUNTIME. En el contenedor, nginx reescribe este archivo al
// arrancar con las variables de entorno (ver docker/40-runtime-env.sh), así la
// misma imagen sirve para cualquier entorno. Este valor es el de desarrollo.
window.__env = {
  urlApi: 'http://localhost:8080',
  firebase: {
    apiKey: 'AIzaSyC_YqxzZSf5KllPuoQRbk4gdt7GAkehBS0',
    authDomain: 'mejor-vejez-app.firebaseapp.com',
    projectId: 'mejor-vejez-app',
    appId: '1:1068942960599:web:83b46a51071093c775cd92',
  },
};
