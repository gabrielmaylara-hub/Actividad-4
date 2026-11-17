# Contrato de implementación

Aplicación Productos, Node 24 + Express 5 + Mongoose 9, CommonJS.

## Autenticación
- JWT en cookie HttpOnly `actividad4_token`, SameSite Strict, Secure solo producción, duración 2 h. Frontend `fetch` mismo origen, credentials same-origin. No localStorage ni token visible.
- POST /api/auth/register JSON {name,email,password}: 201 {user:{id,name,email}} y cookie, registro inicia sesión.
- POST /api/auth/login JSON {email,password}: 200 {user:{id,name,email}} y cookie.
- GET /api/auth/me: 200 {user:{id,name,email}} o 401.
- POST /api/auth/logout: 204, revoca la sesión en Mongo y elimina cookie.
- Nombres 2-80; email normalizado máximo 254; contraseña 8+ caracteres, máximo 72 bytes UTF-8.

## Productos
Todas las rutas requieren sesión válida y filtran propietario en el servidor. Campos de API: id,name,sku,description,category,price,stock,createdAt,updatedAt. Categorías Tecnología, Oficina, Hogar, Otros. Precio en MXN, 0 a 9999999.99 y máximo dos decimales. stock entero 0 a 999999. sku alfanumérico con guion, 2-40, se normaliza a mayúsculas; único por usuario. name 2-100 y description 0-500.
- GET /api/products?q=&category=&page=1&limit=10: 200 {products:[...],pagination:{page,limit,total,pages}}. q búsqueda literal de name o sku, máximo100. category opcional; page entero >=1 y limit 1-50.
- GET /api/products/:id: 200 {product:{...}}; 404 inexistente o ajeno.
- POST /api/products JSON {name,sku,description,category,price,stock}: 201 {product:{...}}.
- PUT /api/products/:id mismos campos completos: 200 {product:{...}}.
- DELETE /api/products/:id: 204.
- ID mal formado:400; SKU duplicado:409; datos inválidos:400; falta sesión:401; JSON incorrecto:400; origen cruzado en escrituras con cookie:403; caída base:503.
- Error JSON: {error:{code,message,details?}}. details es array de {field,message} para validación.

## Interfaz
public/index.html login/registro, public/products.html CRUD. scripts y CSS externos con CSP sin inline. Interfaz español, moneda MXN, accesible y responsive, sin dependencias externas. No datos falsos prellenados.

## Servidor
createApp(options) en src/app.js permite inyectar connectDatabase async y desactivar limitador solo tests. server.js arranque local; src/app.js exporta la instancia creada además de factory. Mongoose Session {user,tokenId,expiresAt}; Product {owner,name,sku,description,category,priceInCents,stock}; User {name,email,passwordHash}.
