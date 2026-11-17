# Actividad 4: gestión de productos

**Autor:** Gabriel Josue May Lara  
**Asignatura:** Desarrollo Full Stack

Aplicación web para registrar una cuenta, iniciar y cerrar sesión y administrar productos. Cada usuario consulta y modifica únicamente sus propios productos. El servidor utiliza Node.js 24, Express 5, MongoDB y Mongoose 9; las pruebas se ejecutan con Jest.

## Estado de la entrega

El proyecto se verificó localmente el 17 de noviembre de 2026: **112 pruebas unitarias y de rutas aprobadas, más 16 pruebas de integración con MongoDB real**. Los resultados están en `docs/evidencia-unitarias.json` y `docs/evidencia-integracion.json`. El documento Word se entrega por separado y dentro del archivo ZIP del proyecto; los requerimientos y la justificación se resumen en este repositorio.

La [aplicación está publicada en Vercel Hobby](https://actividad-4-rust.vercel.app) y conectada a MongoDB Atlas Free. La [ejecución de GitHub Actions](https://github.com/gabrielmaylara-hub/Actividad-4/actions/runs/44202134425) aprobó las pruebas y el despliegue. El [informe de pruebas](docs/PRUEBAS.md) incluye las comprobaciones de la aplicación publicada.

## Funciones

- Registro de usuario e inicio de sesión con correo y contraseña.
- Cierre de sesión con revocación en la base de datos.
- Alta, consulta, edición y eliminación de productos.
- Búsqueda por nombre o SKU, filtro por categoría y paginación.
- Validación de datos y mensajes de error en español.
- Autorización por propietario en todas las operaciones de productos.

El alcance es un catálogo personal de productos. No incluye ventas, cobros, recuperación de contraseñas ni administración de otros usuarios.

## Probar la interfaz de inmediato

Con Node.js 24 instalado, abre PowerShell en esta carpeta y ejecuta:

```powershell
npm ci
npm run dev:demo
```

Abre [http://localhost:3000](http://localhost:3000). Este modo inicia un servidor MongoDB local temporal y genera una clave JWT para la sesión de laboratorio. No requiere configurar una cuenta Atlas; puede descargar el binario de MongoDB la primera vez.

Los usuarios y productos de este modo se pierden al detenerlo. Úsalo para conocer el funcionamiento de la interfaz. La ejecución con datos persistentes se configura a continuación; Atlas y el despliegue remoto siguen siendo necesarios para completar la actividad.

## Ejecutar en Windows con PowerShell

### 1. Preparar el entorno

Instala Node.js 24 y abre PowerShell dentro de la carpeta que contiene `package.json`. Para guardar los datos necesitas una base MongoDB local o una conexión de MongoDB Atlas. Git es necesario si vas a trabajar con el repositorio.

```powershell
node --version
npm --version
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Si `.env` ya existe, conserva sus valores y edítalo; no lo reemplaces por el ejemplo.

### 2. Configurar las variables

Abre `.env` con tu editor. Configura `MONGODB_URI` con tu conexión y genera una clave para JWT:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copia el resultado como valor de `JWT_SECRET`. Esa clave pertenece únicamente al servidor: no se escribe en el navegador ni se comparte con los usuarios.

| Variable | Uso local |
|---|---|
| `NODE_ENV` | `development`. |
| `PORT` | `3000`. |
| `APP_ORIGIN` | `http://localhost:3000`, sin diagonal final. |
| `MONGODB_URI` | URI de MongoDB local o Atlas, con la base `actividad4`. |
| `JWT_SECRET` | Valor aleatorio privado de al menos 32 caracteres. |

Para Atlas sigue la [guía de despliegue](docs/DESPLIEGUE.md). `.env` está excluido de Git; `.env.example` contiene únicamente valores de ejemplo.

### 3. Verificar la conexión y arrancar

```powershell
npm run db:check
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Utiliza ese mismo origen durante la prueba; `localhost` y `127.0.0.1` son orígenes distintos para el navegador. Para detener el servidor, presiona `Ctrl+C` en PowerShell.

### 4. Recorrer la aplicación

1. Crea una cuenta desde la pantalla de acceso. El registro inicia la sesión.
2. Agrega un producto con nombre, SKU, categoría, precio y existencias.
3. Consulta el producto, modifica sus datos y utiliza la búsqueda.
4. Elimina el registro de prueba y confirma la operación.
5. Cierra sesión. Intenta consultar productos nuevamente: debe solicitar acceso.

No se incluyen cuentas predefinidas ni contraseñas de demostración.

## Autenticación y autorización

El servidor emite un JWT con vigencia de dos horas y lo envía en la cookie `actividad4_token`, con `HttpOnly` y `SameSite=Strict`. En producción también utiliza `Secure`. El navegador envía la cookie a la API del mismo origen; el usuario no tiene que copiar tokens.

Cada JWT está asociado a una sesión en MongoDB. Al cerrar sesión se revoca ese registro y se elimina la cookie. Para acceder a productos deben ser válidos tanto el JWT como la sesión. Las contraseñas se almacenan mediante hash con bcrypt; nunca se devuelven en las respuestas de la API.

Los productos pertenecen al usuario que los creó. El servidor toma esa identidad de la sesión y la incorpora a sus consultas; no acepta que el cliente elija un propietario diferente. Un identificador válido de otro usuario devuelve 404.

Las contraseñas deben tener al menos 8 caracteres y no superar 72 bytes en UTF-8. Este límite se mide en bytes: algunos caracteres ocupan más de uno.

El registro y login comparten un límite básico de 30 solicitudes por IP cada 15 minutos. Su contador se almacena en memoria de cada instancia; no es un límite global coordinado entre todas las instancias de Vercel.

## Datos de un producto

| Campo | Regla |
|---|---|
| `name` | Entre 2 y 100 caracteres. |
| `sku` | Entre 2 y 40 caracteres alfanuméricos o guiones; se normaliza a mayúsculas y es único por usuario. |
| `description` | Opcional, hasta 500 caracteres. |
| `category` | `Tecnología`, `Oficina`, `Hogar` u `Otros`. |
| `price` | Pesos mexicanos; de 0 a 9,999,999.99, con hasta dos decimales. |
| `stock` | Entero de 0 a 999,999. |

La API recibe y devuelve `price` en pesos. MongoDB guarda el valor como un entero de centavos en `priceInCents`.

## API

Todas las rutas de productos requieren autenticación. Las peticiones con cuerpo utilizan `Content-Type: application/json`.

| Método | Ruta | Resultado esperado |
|---|---|---|
| GET | `/api/health` | Comprueba la conexión mediante un ping a MongoDB; 200 si responde. |
| POST | `/api/auth/register` | Registra al usuario e inicia sesión; 201. |
| POST | `/api/auth/login` | Inicia sesión; 200. |
| GET | `/api/auth/me` | Devuelve el usuario autenticado; 200. |
| POST | `/api/auth/logout` | Revoca la sesión; 204. |
| GET | `/api/products` | Lista productos del usuario; 200. |
| GET | `/api/products/:id` | Consulta un producto del usuario; 200. |
| POST | `/api/products` | Crea un producto; 201. |
| PUT | `/api/products/:id` | Sustituye sus campos editables; 200. |
| DELETE | `/api/products/:id` | Elimina un producto; 204. |

La lista acepta `q`, `category`, `page` y `limit`. Por ejemplo: `/api/products?q=teclado&category=Tecnolog%C3%ADa&page=1&limit=10`. `limit` admite de 1 a 50 registros. `PUT` requiere todos los campos editables obligatorios.

Las respuestas de error tienen la forma `{ "error": { "code": "...", "message": "..." } }`. La validación puede añadir `details` con el campo y la causa. Se utilizan 400 para datos inválidos, 401 para falta de autenticación, 403 para origen de escritura no permitido, 404 para recursos inexistentes o ajenos, 409 para duplicados, 415 para un cuerpo enviado con tipo de contenido no admitido, 429 al superar el límite de acceso y 503 para indisponibilidad de la base de datos.

El archivo `peticiones.http` ofrece peticiones de ejemplo. El cliente HTTP utilizado debe conservar las cookies del registro o login para ejecutar las rutas protegidas. También se puede recorrer todo el flujo desde la interfaz web.

## Pruebas

```powershell
npm test
npm run test:ci
npm run test:integration
```

- `npm test`: pruebas unitarias y de rutas con dependencias simuladas; no necesita Atlas.
- `npm run test:ci`: ejecuta esas pruebas y genera cobertura.
- `npm run test:integration`: prueba el flujo con MongoDB. Usa una instancia temporal mediante MongoMemoryServer o la URI de pruebas indicada en `TEST_MONGODB_URI`.

Después de `npm run test:ci`, el informe HTML se encuentra en `coverage/index.html` y el resumen de porcentajes en `coverage/coverage-summary.json`.

La ejecución documentada registró 99.65 % de sentencias, 94.83 % de ramas, 100 % de funciones y 100 % de líneas en el alcance configurado: aplicación Express, controladores, rutas, middleware y utilidades. Los modelos y la conexión no forman parte de esa medición; las 16 pruebas de integración sí verificaron operaciones e índices con un proceso MongoDB 7.0.24 real. Esta base local es temporal y no es MongoDB Atlas.

La instancia temporal puede descargar un binario de MongoDB la primera vez. Si ya tienes MongoDB local, puedes indicar una base exclusiva de pruebas en PowerShell:

```powershell
$env:TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/actividad4_test"
npm run test:integration
Remove-Item Env:TEST_MONGODB_URI
```

Usa una base destinada a pruebas porque la suite de integración crea y limpia sus propios registros. El [informe de pruebas](docs/PRUEBAS.md) reúne los casos y resultados de las pruebas locales, GitHub Actions y la aplicación publicada.

## Organización del proyecto

| Ubicación | Contenido |
|---|---|
| `server.js` | Arranque del servidor local con `npm start`. |
| `src/app.js` | Aplicación Express exportada y función `createApp` para pruebas. |
| `src/models/` | Modelos Mongoose de usuarios, sesiones y productos. |
| `src/controllers/` | Operaciones de autenticación y productos. |
| `src/routes/` | Rutas HTTP. |
| `src/middleware/` | Autenticación, validación y manejo de errores. |
| `public/` | HTML, estilos y JavaScript del navegador. |
| `tests/` | Pruebas automatizadas. |
| `.github/workflows/ci-cd.yml` | Pruebas y despliegue con GitHub Actions. |
| `docs/` | Contrato API, despliegue y documentación de pruebas. |

## Despliegue y entrega

Se eligió Vercel para alojar Express y los archivos estáticos en un mismo proyecto, y MongoDB Atlas para conservar los datos. La documentación oficial permite exportar la aplicación desde `src/app.js` y servir los archivos de `public/`. GitHub Actions ejecuta las pruebas antes del trabajo de publicación. Véanse [Express en Vercel](https://vercel.com/docs/frameworks/backend/express) e [integración con GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).

El workflow prueba las solicitudes de cambio hacia `main` y los cambios enviados a esa rama. El despliegue se ejecuta desde `main` cuando `DEPLOY_ENABLED` vale `true`, los secretos están configurados y las pruebas finalizan correctamente.

La entrega académica requiere ZIP o RAR, el Word con los elementos solicitados y la URL del repositorio. El repositorio debe incluir el código, las pruebas, el workflow y las instrucciones. La aplicación desplegada debe poder verificarse. La [matriz de la rúbrica](docs/MATRIZ-RUBRICA.md) ayuda a revisar esos elementos. No se exige un video en las instrucciones recibidas.


El documento Word completo está incluido en el ZIP de entrega de la actividad, que debe adjuntarse por separado conforme a las instrucciones de Tecmilenio.
