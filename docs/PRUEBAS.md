# Pruebas del proyecto

Las pruebas con Jest comprueban las respuestas de la API, la persistencia de los datos y el rechazo de operaciones inválidas.

## Capas de comprobación

| Capa | Qué comprueba | Qué no acredita por sí sola |
|---|---|---|
| Pruebas unitarias | Decisiones de los controladores y utilidades con dependencias simuladas. | Que Atlas esté configurado. |
| Pruebas de rutas | Métodos, validación, autenticación y respuestas HTTP de la aplicación Express. | Que el proveedor haya publicado esa versión. |
| Integración MongoDB | Interacción de la aplicación con una base de pruebas y persistencia de operaciones. | Que la URI y el acceso de red de Atlas sean correctos. |
| Comprobación de Atlas | Conexión con la base indicada en `MONGODB_URI`. | Que toda la interfaz de producción funcione. |
| Recorrido de producción | Login, CRUD, logout y autorización en la URL desplegada. | Una cobertura completa de todos los errores posibles. |

Los comandos correspondientes están en el README. El workflow ejecuta las pruebas unitarias, de rutas y de integración antes de publicar.

## Casos de prueba

| Área | Comportamientos por comprobar |
|---|---|
| Registro | Datos válidos, campos inválidos, correo duplicado, hash de contraseña y ausencia de datos privados en la respuesta. |
| Login | Credenciales válidas e inválidas, cookie de sesión y mensajes consistentes. |
| JWT y sesión | Ausencia de cookie, token inválido o vencido, sesión revocada y acceso después del logout. |
| Crear producto | Datos válidos, normalización de SKU, SKU duplicado del mismo usuario y asociación al propietario autenticado. |
| Consultar productos | Filtros, paginación, resultados vacíos y aislamiento entre cuentas. |
| Editar y eliminar | Operaciones válidas, identificador mal formado, recurso inexistente y recurso de otra cuenta. |
| Validación | Precio con más de dos decimales o fuera de rango, existencias fraccionarias o negativas y categoría no admitida. |
| Errores | JSON mal formado, fallo de persistencia, códigos HTTP y formato de respuesta. |

Esta tabla es una guía de revisión. Solo deben considerarse cubiertos los casos que aparezcan realmente en la suite y hayan sido ejecutados.

## Registro de resultados

El 17 de noviembre de 2026 se ejecutaron y aprobaron 112 pruebas unitarias y de rutas en siete suites, y 16 pruebas de integración en una suite con MongoDB local real. Los archivos `evidencia-unitarias.json` y `evidencia-integracion.json` contienen el resultado de Jest. La cobertura mide la aplicación Express, controladores, rutas, middleware y utilidades: 99.65 % de sentencias, 94.83 % de ramas, 100 % de funciones y 100 % de líneas. No incluye los modelos ni la configuración de la conexión.

La suite incluye estos casos y ajustes:

| Caso revisado | Ajuste y motivo |
|---|---|
| JWT sin expiración | Se exige `exp` numérico además de validar firma, emisor y audiencia; se añadió una prueba que rechaza su ausencia. |
| Fracciones menores que un centavo | Se sustituyó una tolerancia de redondeo por la comparación exacta del precio con sus centavos; se añadieron los casos `0.000000001` y `1.000000001`. |
| Sesión vencida y sanitización de consultas | La integración detectó que el operador interno `$gt` debía marcarse como confiable con `mongoose.trusted`; se conservó la sanitización de entradas y se ajustaron los mocks al código corregido. |
| Conexión del driver dentro de Jest | Se utilizó el adaptador nativo `os` documentado para el incidente [NODE-7832](https://jira.mongodb.org/browse/NODE-7832), sin simular la base en la suite de integración. |
| Autorización y cambios de propietario | Se verifican tanto el rechazo de campos no permitidos como la imposibilidad de consultar, editar o borrar productos de otra cuenta. |

## Ejecutar las pruebas

```powershell
npm test
npm run test:ci
npm run test:integration
```

## Verificación del despliegue

La [ejecución de GitHub Actions](https://github.com/gabrielmaylara-hub/Actividad-4/actions/runs/44202134425) aprobó 112 pruebas unitarias y de rutas, 16 pruebas de integración con MongoDB 8 y el despliegue en Vercel.

En la [aplicación publicada](https://actividad-4-rust.vercel.app) se comprobó el registro de una cuenta de prueba, el inicio y cierre de sesión, y la creación, consulta, edición y eliminación de un producto. Al recargar la página se confirmó la persistencia de los cambios. [/api/health](https://actividad-4-rust.vercel.app/api/health) respondió HTTP 200 y confirmó la conexión a MongoDB Atlas. El catálogo devolvió HTTP 401 al consultarlo sin sesión.
