# Despliegue en Vercel con MongoDB Atlas

Esta guía describe la configuración que falta realizar en las cuentas del proyecto. La existencia de estos pasos y del workflow no demuestra que la aplicación ya esté publicada.

## 1. Preparar MongoDB Atlas

1. Crea o selecciona un proyecto y un cluster compatible con la aplicación. Revisa el plan elegido antes de confirmar recursos de pago.
2. Crea un usuario de base de datos dedicado al proyecto y asígnale permisos de lectura y escritura sobre `actividad4`. Este usuario es distinto de la cuenta con la que accedes al panel de Atlas.
3. En la lista de acceso de red autoriza la IP de la computadora desde la que probarás la conexión.
4. Obtén la cadena de conexión para Node.js y establece `actividad4` como nombre de base. Si la contraseña contiene caracteres reservados, deben estar codificados correctamente dentro de la URI.
5. Guarda la cadena completa únicamente en `MONGODB_URI` de tu archivo `.env`.

Para comprobarla desde la carpeta del proyecto:

```powershell
npm run db:check
```

El resultado debe acreditar la conexión con la URI configurada. Una prueba sobre MongoDB local no acredita Atlas.

La lista de acceso de Atlas también debe permitir las conexiones que salgan de Vercel. Autorizar la computadora local no autoriza automáticamente el proveedor. Comprueba la configuración de red disponible para tu proyecto de Vercel. El rango `0.0.0.0/0` permite conexiones desde cualquier IP y no es un requisito de la actividad; no se habilita desde el código del proyecto. Consulta la [lista de acceso de Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

## 2. Publicar el repositorio en GitHub

Crea un repositorio para esta actividad y carga los archivos de la aplicación en su raíz. Usa `main` como rama principal para coincidir con el workflow. Incluye `package-lock.json` y el archivo `.github/workflows/ci-cd.yml`.

No incluyas `.env`, `node_modules/` ni `.vercel/`. `.gitignore` excluye esas rutas. Confirma que GitHub muestra las carpetas `src`, `public`, `tests`, `docs` y `.github/workflows`.

La URL del repositorio debe copiarse desde el repositorio real. Todavía no se ha fijado una URL en este paquete.

## 3. Crear y vincular el proyecto de Vercel

Puedes vincular el proyecto desde la carpeta local con Vercel CLI:

```powershell
npx vercel@65.17.0 login
npx vercel@65.17.0 link
```

Selecciona la cuenta y el proyecto adecuados. Estos comandos vinculan el directorio; el despliegue de la entrega se realizará mediante GitHub Actions después de aprobar las pruebas. Si Vercel propone conectar también el repositorio Git, conserva la configuración que desactiva sus publicaciones automáticas directas.

La configuración debe utilizar Node.js 24 y detectar el proyecto como Express. `src/app.js` exporta la aplicación; `server.js` permite el arranque local. Los archivos de interfaz se encuentran en `public/`. En Vercel se sirven como archivos estáticos, por lo que su disponibilidad debe revisarse junto con la API. Referencia: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express).

En las variables de entorno del proyecto Vercel, con alcance de **Production**, configura:

| Nombre | Valor |
|---|---|
| `MONGODB_URI` | URI privada de Atlas para la base `actividad4`. |
| `JWT_SECRET` | Clave aleatoria privada, distinta de cualquier valor utilizado en las pruebas. |
| `APP_ORIGIN` | Origen HTTPS de producción asignado al proyecto, sin ruta ni diagonal final. |
| `NODE_ENV` | `production`. |

`PORT` se utiliza para el servidor local; Vercel administra la ejecución de la aplicación. Para generar `JWT_SECRET` puedes usar el comando del README. La configuración de producción debe coincidir con el dominio que se abrirá en el navegador; un origen distinto puede provocar el rechazo de las operaciones de escritura.

## 4. Configurar GitHub Actions

El comando de vinculación crea `.vercel/project.json`, donde se encuentran `orgId` y `projectId`. Consúltalos localmente para registrar los secretos; no es necesario publicar ese archivo.

En el repositorio de GitHub abre **Settings > Secrets and variables > Actions**. Registra como secretos del repositorio:

| Secreto | Procedencia |
|---|---|
| `VERCEL_TOKEN` | Token de la cuenta Vercel autorizada para desplegar el proyecto. |
| `VERCEL_ORG_ID` | Valor `orgId` del proyecto vinculado. |
| `VERCEL_PROJECT_ID` | Valor `projectId` del proyecto vinculado. |

En la pestaña de variables agrega `DEPLOY_ENABLED` con el texto `true` cuando las variables de Vercel y Atlas estén listas. Si está ausente o tiene otro valor, GitHub ejecuta las pruebas y omite el trabajo de despliegue. Referencia: [secretos de GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

El trabajo de pruebas utiliza un servicio desechable `mongo:8` y la base `actividad4_ci_test`; no requiere credenciales de Atlas. Sus pasos son:

1. Instalar las versiones registradas en `package-lock.json` con `npm ci`.
2. Ejecutar las pruebas unitarias y de rutas con `npm run test:ci`.
3. Ejecutar integración con MongoDB mediante `npm run test:integration`.

El trabajo de despliegue depende de que los anteriores terminen correctamente. En un cambio enviado a `main`, o en una ejecución manual sobre `main`, ejecuta:

```text
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

El workflow aporta el token mediante una variable de entorno; no se escribe un valor privado dentro del archivo YAML. Las solicitudes de cambio solo ejecutan pruebas. El flujo sigue el patrón oficial de [GitHub Actions con Vercel](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).

### Evitar un despliegue que omita las pruebas

La integración Git de Vercel puede publicar al recibir cambios, independientemente del trabajo de GitHub Actions. Para que la entrega se publique mediante el pipeline, `vercel.json` debe conservar:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

Esta propiedad desactiva el despliegue automático de la integración Git, mientras que el workflow utiliza Vercel CLI. Si `vercel.json` contiene otras opciones, conserva esas opciones y la propiedad indicada. Referencia: [configuración Git de Vercel](https://vercel.com/docs/project-configuration/git-configuration).

## 5. Comprobar la publicación

Abre **Actions > Pruebas y despliegue**. Ejecuta el workflow sobre `main` o envía un cambio a esa rama. Verifica que aparezcan exitosos tanto **Jest y MongoDB** como **Publicar en Vercel**. Un trabajo marcado como omitido no prueba la publicación.

Con la URL que realmente entregue Vercel, realiza esta revisión:

1. Abre la aplicación por HTTPS y comprueba que el login carga con sus estilos. Consulta `/api/health`: debe devolver `{"status":"ok","database":"connected"}` después de un ping real a MongoDB.
2. Registra una cuenta de prueba y crea un producto.
3. Recarga la página y comprueba que el producto sigue presente.
4. Edita y elimina el producto.
5. Cierra sesión y comprueba que la API ya no permite consultar productos con esa sesión.
6. Comprueba desde una segunda cuenta que los productos de la primera no se pueden consultar ni modificar.
7. Confirma en Atlas que se utilizaron la base y las colecciones del proyecto.

Estos pasos validan la publicación y los datos persistentes, además de lo que verifican las pruebas automatizadas. Una ejecución de Jest exitosa no sustituye esta revisión.

Registra en el documento de entrega la URL del repositorio, la URL pública, el enlace a la ejecución exitosa del workflow y la fecha de verificación. Mientras alguno falte, debe conservarse como pendiente.

## Versiones del workflow

Se fijaron `actions/checkout@v7.0.1`, `actions/setup-node@v7.1.0` y `vercel@65.17.0`, consultados el 17 de noviembre de 2026. Las dependencias de la aplicación se fijan mediante `package-lock.json`.

Fuentes: [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) y [paquete oficial Vercel](https://www.npmjs.com/package/vercel). La versión de CLI se contrastó con `npm view vercel version`.
