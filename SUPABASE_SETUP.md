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
5. Toca **Probar aviso completo (como una venta)**: crea un aviso real y el servidor lo manda al teléfono. Si llega, las ventas también avisarán. («Probar aviso en este teléfono» solo prueba el teléfono, no el servidor.)

En iPhone hace falta iOS 16.4 o superior y abrir la app **instalada** (Compartir → Agregar a pantalla de inicio).

## 7. Catálogos (librito digital)
Para subir un PDF y compartirlo como un librito:
1. En el SQL Editor pega **todo** `migracion_catalogos.sql` y dale **Run**. Crea las tablas, la carpeta de imágenes (Storage, pública para leer) y los permisos: solo la administración puede subir y borrar.
2. En el panel: **Más → Catálogos (librito) → + Catálogo**. Elige el PDF, revisa las hojas (dividir, una página o girar) y súbelo. Tarda un par de minutos.
3. Toca **Publicar y compartir**: sale el enlace, un QR y el botón de WhatsApp.
4. Cuando termine la campaña: **Archivar y borrar**. Se borran las imágenes y solo queda anotado el nombre y las hojas.

## 8. Importar productos desde el catálogo
1. En el SQL Editor pega **todo** `migracion_importador.sql` y dale **Run** (agrega el precio de referencia del catálogo y la tabla que recuerda dónde está cada producto).
2. En **Más → Catálogos (librito)**, en el catálogo que quieras, toca **Importar productos**.
3. Abre una página y **arrastra un recuadro** sobre el texto de cada producto (código, nombre y precio). Se lee solo; revisa y toca **Agregar a la lista**.
4. Cuando termines, **Importar**. Los productos quedan como **borradores ocultos**, sin precio de venta ni foto.
5. En **Más → Pendientes de completar** les pones tu precio, la cantidad y el enlace de la foto. Al tener precio se activan.

La lectura es automática pero no perfecta: a veces confunde un número o una letra. El precio del catálogo es solo de referencia (el del catálogo viene en otra moneda). Siempre revisa lo que se leyó.

## 9. Dulces (gelatinas y gomitas) · sección privada
1. En el SQL Editor pega **todo** `migracion_dulces.sql` y dale **Run**. Crea sus tablas propias; solo la administración puede leerlas y no tienen ningún permiso público.
2. En el panel: **Más → Dulces (privado)**. Ahí:
   - **+ Entrega**: cliente, fecha, qué entregó (gelatinas o gomitas, cantidad y precio por pieza) y lo que gastó (ej. 6 bolsas de gelatina, 2 cajas de leche condensada). Calcula cuánto cobra, cuánto gastó y cuánto le sobra.
   - **Registrar pago**: cada pago con fecha y forma de pago. Dice si cuadra, si falta o si pagaron de más.
   - **Comprobante**: imagen para imprimir o mandar por WhatsApp. Lleva lo entregado, el total, los pagos y el saldo; **no** lleva gastos ni ganancias.
   - **Por cliente**: lo entregado frente a lo pagado de cada cliente.
   - **Mis productos**: la lista de gelatinas y gomitas con su precio por pieza.
3. En **Ajustes** se puede poner el nombre que sale arriba del comprobante.

Es solo para la administradora: no sale en el catálogo, en las fichas del QR, en las imágenes para estados ni para el visualizador.

## 10. Colores, stock por color y aviso de stock opcional
1. En el SQL Editor pega **todo** `migracion_colores.sql` y dale **Run** (después de las otras migraciones). Hasta entonces el panel funciona igual, solo que sin colores.
2. En un producto: **Viene en varios colores**. Tocas los colores que tiene y le pones cuántas piezas hay de cada uno; la cantidad total se suma sola. Al vender, al pedir una caja o al ingresar mercadería se elige el color.
3. En un producto: **Avisarme cuando se acabe**. Si lo apagas, no sale la alerta de poco stock ni cuenta en «Poco o sin stock», y se puede vender aunque ya no haya (la existencia nunca baja de 0). Sirve para lo que haces bajo pedido.
4. **Más → Ingreso rápido**: buscas o escaneas los productos, pones cuántas llegaron (por color si tiene) y se suma todo de una vez. También crea productos nuevos al vuelo con «Producto rápido».

## 11. Campañas, archivado automático y limpieza de la base
Los productos van por tandadas y casi no se repiten, así que el panel se mantiene limpio solo.
1. En el SQL Editor pega **todo** `migracion_campanas.sql` y dale **Run**. Crea el campo campaña, el archivado y dos tareas diarias de Supabase.
2. **Campaña**: cada producto lleva el nombre de su tanda (al importar del catálogo se pone solo). En **Productos** se filtra por campaña y, al terminar, **Archivar esta campaña** guarda todo junto.
3. **Archivado automático**: cuando un producto se agota y pasan **3 días** (se cambia en Ajustes → Orden y limpieza), se archiva solo: sale de la lista, del catálogo y del QR. Los marcados **Mantener siempre** no se archivan.
4. **Archivados**: en Productos, chip «Archivados». Se pueden **restaurar** o borrar para siempre.
5. **Limpieza de la base**: lo archivado se **borra de verdad a los 30 días**, junto con avisos leídos de más de 60 días, escaneos de QR de más de 90 y registros de más de 180. Las ventas, ganancias y reportes **no se tocan** (cada venta guarda su propia copia). Corre cada día a las 3:45 am; también hay botones «Archivar agotados ahora» y «Limpiar la base ahora».
6. Los productos **nuevos nacen sin aviso de poco stock**; se enciende por producto si alguno sí se vuelve a pedir.

## Cambiar un PIN después
Desde el panel: **Ajustes → Cambiar PIN** (usa la función `cambiar-pin`). También se puede en Authentication → Users.

## Si algo falla
- «PIN incorrecto» con el PIN bueno: revisa que los correos sean exactamente los de la tabla y que corriste `roles.sql`.
- «Esta cuenta aún no tiene rol»: falta `roles.sql`.
- Las fotos no salen: el link debe ser el de la **imagen** directa (termina en .jpg/.png). Los de Google Drive y Dropbox se convierten solos.
