# Matriz de revisión de la Actividad 4

Fuente de los criterios: `Rub_act4.pdf`, proporcionado con la actividad. Los porcentajes siguientes corresponden a la rúbrica; no representan una calificación obtenida.

| Criterio | Peso | Evidencia del proyecto que debe revisarse | Comprobación necesaria |
|---|---:|---|---|
| Configuración del servidor | 20 % | `server.js`, `src/app.js`, conexión MongoDB y middleware. | Arranque correcto, conexión real a Atlas y solicitudes atendidas. |
| Generación de rutas | 10 % | Rutas de productos y pruebas HTTP. | CRUD completo, validación y respuestas de error claras. |
| Autenticación y autorización | 20 % | Rutas de autenticación, JWT, sesiones, propiedad de productos y login en `public/`. | Registro, login, logout, rechazo sin sesión y aislamiento entre usuarios. |
| Generación de controladores | 15 % | `src/controllers/` y modelos Mongoose. | Operaciones persistentes y manejo de errores. |
| Pruebas unitarias | 10 % | Jest, pruebas de controladores y rutas, `PRUEBAS.md`. | Ejecución real, casos relevantes y revisión manual del estudiante. |
| Despliegue | 15 % | `.github/workflows/ci-cd.yml`, configuración de Vercel y Atlas. | URL pública funcional y workflow con pruebas y despliegue exitosos. |
| Documentación | 10 % | Word de la actividad, README y documentación técnica. | Requisitos funcionales y no funcionales, diagrama entidad-relación y justificación de SaaS. |
| **Total** | **100 %** | | |

Los criterios de servidor, rutas y autenticación aparecen en la página 1 de la rúbrica; autenticación continúa en la 2. La página 2 contiene controladores, pruebas y despliegue. La documentación está en la página 3.

## Relación con las tarjetas de errores

| Tarjeta | Aplicación al proyecto |
|---|---|
| Conexión Atlas, p. 1 | `MONGODB_URI`, acceso de red y comando `npm run db:check`. |
| Rutas protegidas, p. 2 | Middleware de autenticación antes de las rutas de productos. |
| Contraseñas, p. 3 | Hash con bcrypt, sin almacenamiento de texto plano. |
| Pruebas, p. 4 | Jest, casos de error y revisión de los resultados. |
| Despliegue SaaS, p. 5 | Variables de producción y aplicación Express compatible con Vercel. |
| Pipeline, p. 6 | Workflow ubicado en `.github/workflows/` y despliegue posterior a pruebas. |
| Controladores, p. 7 | Manejo central de errores y códigos HTTP. |
| Validación, p. 8 | Rechazo de datos inválidos en la API, además de controles del formulario. |
| Documentación, p. 9 | Requisitos, diagrama, API e instrucciones. |
| Login y API, p. 10 | Interfaz del mismo origen y JWT en cookie HttpOnly. |

La tarjeta de login muestra el envío de JWT por encabezado como solución de ejemplo. Este proyecto lo transporta en una cookie HttpOnly y comprueba su firma y sesión en el servidor. La decisión debe explicarse de acuerdo con el código; no supone eliminar JWT.

## Elementos de entrega

1. Carpeta comprimida en ZIP o RAR con el código y documentación del proyecto.
2. Documento Word que reúna requisitos funcionales, no funcionales, diagrama y justificación de Vercel.
3. URL del repositorio GitHub con código, archivo del pipeline e instrucciones de ejecución.
4. Aplicación desplegada con Atlas y ejecución exitosa del pipeline, verificables mediante sus enlaces.

El Word puede reunir toda la explicación sin dividirla en anexos separados. Las instrucciones no fijan un límite de páginas, una cantidad de pruebas ni un porcentaje mínimo de cobertura. Tampoco exigen un video.

## Evidencia de publicación

La [aplicación publicada](https://actividad-4-rust.vercel.app) se verificó con MongoDB Atlas. La [ejecución de GitHub Actions](https://github.com/gabrielmaylara-hub/Actividad-4/actions/runs/44175554053/attempts/2) registra las pruebas y el despliegue. Los casos y resultados se detallan en [PRUEBAS.md](PRUEBAS.md).
