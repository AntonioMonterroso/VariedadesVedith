# Puesta en marcha (una sola vez)

Proyecto de Supabase: `https://blrmfbvqxndhxglvqfku.supabase.co` (ya está en `config.js`).

## 1. Crear las tablas
1. Supabase → **SQL Editor** → *New query*.
2. Pega **todo** `schema.sql` y dale **Run**. Se puede correr otra vez sin problema.

## 2. Crear los dos usuarios (los dos PIN)
Supabase → **Authentication → Users → Add user → Create new user**. Marca **Auto Confirm User**.

| Para quién | Correo | Contraseña |
|---|---|---|
| Administración | `admin@vedith.example.com` | un PIN de **6 números** |
| Visualizador | `visor@vedith.example.com` | **otro** PIN de 6 números |

Los correos son inventados a propósito: nunca se envía nada a esas direcciones.
Los dos PIN deben ser distintos (si no, la pantalla de entrada no sabría quién eres).

Luego, en **Authentication → Sign In / Providers**, apaga **Allow new users to sign up** para que nadie más pueda crear cuentas.

## 3. Asignar los roles
SQL Editor → pega `roles.sql` → Run. Deben salir 2 filas: `administrador` y `visualizador`.

## 4. Probar
Abre la página publicada y entra con cada PIN.
Si al entrar sale «permission denied», corre `arreglo_permisos.sql` (el `schema.sql` actual ya lo incluye).

## 5. Publicar en GitHub Pages
1. Repositorio: https://github.com/AntonioMonterroso/VariedadesVedith (contenido de esta carpeta).
2. Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
3. Cuando tengas la dirección (`https://antoniomonterroso.github.io/VariedadesVedith/`), pégala en **Ajustes → Dirección de la app para los QR** **antes** de imprimir las etiquetas definitivas.

No subas `push_setup.sql` con el secreto escrito. La *anon key* de `config.js` sí puede ser pública: lo protegido lo cuidan las reglas de la base.

## 6. Avisos al teléfono (opcional, pero recomendado)
La llave pública ya está en `config.js`. Faltan las dos funciones y sus secretos, todo desde el panel de Supabase (no hace falta instalar nada):

1. **Edge Functions → Deploy a new function → Via Editor**
   - Nombre `enviar-push`: pega el contenido de `supabase/functions/enviar-push/index.ts`. Desactiva **Verify JWT** y despliega.
   - Nombre `cambiar-pin`: pega `supabase/functions/cambiar-pin/index.ts` y despliega (aquí **Verify JWT** queda activado).
2. **Edge Functions → Secrets** (o Project Settings → Edge Functions) → agrega:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET` y `VAPID_SUBJECT` (por ejemplo `mailto:tucorreo@ejemplo.com`).
   Los valores se generaron con `node generar-vapid.mjs`; la llave privada y el secreto **no** se guardan en GitHub.
3. En el SQL Editor corre `push_setup.sql` cambiando `<TU_SECRETO>` por el mismo `PUSH_SECRET`.
4. En el panel: **Notificaciones → Activar avisos** desde el teléfono de la administradora.

En iPhone hace falta iOS 16.4 o superior y abrir la app **instalada** (Compartir → Agregar a pantalla de inicio).

## Cambiar un PIN después
Desde el panel: **Ajustes → Cambiar PIN** (usa la función `cambiar-pin`). También se puede en Authentication → Users.

## Si algo falla
- «PIN incorrecto» con el PIN bueno: revisa que los correos sean exactamente los de la tabla y que corriste `roles.sql`.
- «Esta cuenta aún no tiene rol»: falta `roles.sql`.
- Las fotos no salen: el link debe ser el de la **imagen** directa (termina en .jpg/.png). Los de Google Drive y Dropbox se convierten solos.
