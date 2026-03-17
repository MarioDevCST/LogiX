# LogiX

Aplicación React (Vite) con Firebase Authentication + Firestore.

## Entornos (DEV y PROD)

Se recomienda trabajar con dos proyectos de Firebase:

- **DEV**: para desarrollo y pruebas (puedes resetear datos y probar cambios).
- **PROD**: para demo/cliente (datos reales + reglas estrictas).

La app lee la configuración de Firebase desde variables `VITE_FIREBASE_*`. Para diferenciar claramente el entorno en pantalla, el Header muestra una insignia “Developer” y cambia de color cuando el entorno es DEV.

### Variables de entorno

- Copia `.env.example` a un archivo local y rellena los valores.
- Para local, usa un archivo de entorno de desarrollo y pon `VITE_APP_STAGE=DEV`.
- Para el despliegue de PROD, usa configuración del proyecto PROD y `VITE_APP_STAGE=PROD`.
- Si despliegas una versión “staging” apuntando a Firebase DEV pero en modo build, pon explícitamente `VITE_APP_STAGE=DEV` para que se vea el indicador.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
