# Base de datos para Galerias Muebles y Decoraciones

Este directorio deja preparada la estructura de base de datos para mover el
proyecto desde datos locales (`localStorage` y JSON) hacia Supabase/Postgres.

## Archivo principal

- `supabase-schema.sql`: esquema completo para pegar en el SQL Editor de
  Supabase.
- `remove-reviews.sql`: limpieza opcional para quitar definitivamente la tabla
  y columnas de reseñas en un proyecto de Supabase que ya estaba creado.
- `remove-orders.sql`: limpieza opcional para quitar definitivamente tablas de
  pedidos en un proyecto de Supabase que ya estaba creado.
- `login-security.sql`: agrega la tabla `login_attempts` para limitar intentos
  fallidos y activar CAPTCHA desde una Edge Function.

## Que incluye

- Usuarios reales con Supabase Auth.
- Tabla `profiles` para rol, telefono, direccion y datos del cliente.
- Tabla `providers` para proveedores como Coaster Furniture.
- Tabla `products` para productos importados por SKU.
- Tabla `sync_runs` para guardar cada corrida del scraper.
- Tabla `product_change_logs` para registrar productos nuevos, editados,
  inactivados o reactivados.
- Tablas `favorites`, `carts` y `cart_items`.
- Tabla `product_inquiries` para clientes que preguntan por un producto.
- Tabla `site_settings` para configuracion del sitio.
- Politicas RLS para proteger datos privados y dejar publico el catalogo.

## Quitar reseñas en Supabase existente

El sitio ya no usa reseñas. Si tambien quieres borrar esa estructura de tu base
actual, pega y ejecuta `remove-reviews.sql` en el SQL Editor de Supabase.
Ese script elimina definitivamente `product_reviews`, `products.rating` y
`products.reviews_count`.

## Quitar pedidos en Supabase existente

El sitio ya no procesa pedidos ni pagos internos. Si tu base actual todavia
tiene tablas de pruebas, pega y ejecuta `remove-orders.sql` en el SQL Editor de
Supabase. Ese script elimina definitivamente `orders`, `order_items`,
`order_status` y la configuracion `checkout` de `site_settings`.

## Orden recomendado

1. Crear proyecto en Supabase.
2. Ir a SQL Editor.
3. Pegar y ejecutar `supabase-schema.sql`.
4. Crear el usuario admin desde Supabase Auth.
5. Ejecutar:

```sql
update public.profiles
set role = 'admin'
where email = 'galeriasmuebleria@gmail.com';
```

6. Importar los productos actuales de:

```txt
C:/Users/cirez/LUMINAR HOME/data/imports/coaster-products.json
```

7. Modificar el scraper para hacer `upsert` en `products` usando:

```txt
provider_id + sku
```

8. Conectar el sitio React a Supabase para leer productos, login, favoritos,
   carrito de consulta y consultas.

## Importar productos de Coaster

El importador lee:

```txt
C:/Users/cirez/LUMINAR HOME/data/imports/coaster-products.json
```

y sube los productos a Supabase.

Primero revisa el archivo sin subir nada:

```bash
npm.cmd run import:coaster -- --dry-run
```

Luego consigue estos dos datos en Supabase:

- `SUPABASE_URL`: URL del proyecto.
- `SUPABASE_SERVICE_ROLE_KEY`: llave secreta `service_role`.

En PowerShell, configura las variables solo para esa terminal:

```powershell
$env:SUPABASE_URL="https://tu-proyecto.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"
```

Despues ejecuta:

```bash
npm.cmd run import:coaster
```

El script hace:

- crea o actualiza el proveedor `Coaster Furniture`;
- crea o actualiza categorias;
- inserta o actualiza productos usando `provider_id + sku`;
- guarda una corrida en `sync_runs`.

Para verificar en Supabase:

```sql
select count(*) from public.products;
```

Y para ver productos de Coaster:

```sql
select p.sku, p.name, p.status, p.category
from public.products p
join public.providers pr on pr.id = p.provider_id
where pr.provider_key = 'coaster'
limit 20;
```

## Conectar el frontend

El sitio React lee el catalogo publico con variables de Vite. Crea un archivo
`.env.local` en la raiz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-o-publishable-key
VITE_STORE_WHATSAPP=5210000000000
VITE_TURNSTILE_SITE_KEY=tu-cloudflare-turnstile-site-key
VITE_SECURE_LOGIN_ENABLED=true
```

Usa `anon` o `publishable key` para `VITE_SUPABASE_ANON_KEY`. No uses
`service_role` en variables `VITE_`.

Despues reinicia el servidor:

```bash
npm.cmd run dev
```

Para desplegar con Supabase conectado, esas variables deben existir antes del
build:

```powershell
$env:VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="tu-anon-o-publishable-key"
$env:VITE_STORE_WHATSAPP="5210000000000"
npm.cmd run build
```

## Registro de usuarios en produccion

El registro del sitio usa Supabase Auth con confirmacion por enlace de correo.
Por ahora se recomienda mantener este flujo hasta tener un dominio propio y un
SMTP configurado.

En Supabase revisa:

1. `Authentication > Providers > Email`
2. Mantener activo `Confirm email`.
3. Configurar `Authentication > URL Configuration`:

```txt
Site URL: http://2.25.174.243/eric_diaz/
Redirect URLs:
http://2.25.174.243/eric_diaz/
http://localhost:5173/eric_diaz/
```

Para CAPTCHA de produccion:

1. Crear un sitio en Cloudflare Turnstile.
2. Copiar `Site key` a `.env.local` como `VITE_TURNSTILE_SITE_KEY`.
3. Copiar `Secret key` en Supabase:
   `Authentication > Bot and Abuse Protection > Enable CAPTCHA protection`.
4. Reiniciar el servidor local o volver a hacer build.

## Login seguro con intentos fallidos y CAPTCHA

El frontend por si solo no puede proteger un login contra ataques de fuerza
bruta, porque un atacante podria saltarse React y llamar directamente al
endpoint de autenticacion. Para produccion se agrega una Supabase Edge Function
llamada `secure-login`.

Flujo implementado:

- Login normal: despues de 3 intentos fallidos por correo/IP se pide CAPTCHA.
- Login normal: despues de 6 intentos fallidos se bloquea temporalmente por
  15 minutos.
- Login admin: pide CAPTCHA desde el primer intento.
- Login admin: despues de 3 intentos fallidos se bloquea temporalmente por
  15 minutos.
- El login normal no revela si un correo pertenece a un administrador.
- El login normal no prueba contrasenas de cuentas administradoras; solo
  registra el intento dentro del flujo publico.
- La tabla `login_attempts` guarda hashes de correo e IP, no datos en texto.

Pasos para activarlo:

1. Ejecutar `database/login-security.sql` en el SQL Editor de Supabase.
2. Crear un widget en Cloudflare Turnstile y copiar:
   - Site key
   - Secret key
3. En Supabase Edge Function Secrets agregar:

```env
TURNSTILE_SECRET_KEY=tu-secret-key-de-turnstile
LOGIN_ATTEMPT_PEPPER=un-texto-largo-aleatorio-para-hashear-intentos
```

Supabase ya proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` a las Edge Functions.

4. Desplegar la funcion:

```bash
npx supabase functions deploy secure-login
```

5. En `.env.local` del frontend agregar:

```env
VITE_TURNSTILE_SITE_KEY=tu-site-key-de-turnstile
VITE_SECURE_LOGIN_ENABLED=true
```

6. Reiniciar localhost o volver a compilar:

```bash
npm.cmd run build
```

Para envio de correos en produccion, configura un SMTP propio en Supabase. El
correo incluido sirve para pruebas y puede tener limites bajos.

### Cuando tengas dominio y SMTP

Cuando el proyecto ya tenga dominio, configura un SMTP propio en Supabase para
poder personalizar los correos de autenticacion:

```txt
Authentication > Emails > Confirm signup
```

Mientras uses el correo default de Supabase, deja el template con enlace. Si mas
adelante quieres cambiar a codigo de verificacion, primero configura SMTP y luego
puedes usar un subject como:

```txt
Tu codigo de verificacion de Galerias
```

Y en el cuerpo del correo incluye `{{ .Token }}`:

```html
<h2>Confirma tu correo</h2>
<p>Usa este codigo para terminar tu registro en Galerias Muebles y Decoraciones:</p>
<p style="font-size: 28px; letter-spacing: 8px; font-weight: 700;">{{ .Token }}</p>
<p>Este codigo vence pronto. Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
```

Ese cambio tambien requiere volver a activar en el frontend la pantalla para
ingresar el codigo y verificarlo con Supabase Auth.

## Notas importantes

- La contrasena no se guarda en `profiles`; eso lo maneja Supabase Auth.
- El frontend solo debe usar la llave publica `anon`.
- El scraper debe usar la llave secreta `service_role`, pero esa llave nunca va
  dentro del frontend.
- Si un proveedor elimina un producto, el sistema lo debe marcar como
  `inactive`, no borrarlo inmediatamente.
- La tabla `product_inquiries` permite que clientes pregunten por un producto
  por WhatsApp o contacto directo con la tienda.
