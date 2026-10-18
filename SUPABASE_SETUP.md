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

## 12. Diseños y colores juntos, y archivado más seguro
1. En el SQL Editor pega **todo** `migracion_disenos.sql` y dale **Run** (después de `migracion_colores.sql` y `migracion_campanas.sql`).
2. **Variantes**: un producto puede venir por **color**, por **diseño** (capibara, princesas, carros…) o por **los dos** ("Capibara · Rosa"). En el formulario eliges los diseños y los colores que tiene y le pones las piezas de cada combinación. Al vender, pedir una caja o ingresar mercadería se elige la opción.
3. **Cada diseño tiene sus propios colores**: en el editor, cada diseño (y los «Colores sueltos, sin diseño») es un bloque aparte con su botón **Colores**, donde eliges solo los que de verdad existen en ese diseño. Un diseño sin colores se guarda como diseño solo. **Copiar colores a los demás** pasa los colores de un diseño a los otros.
4. **Dos o más colores en una misma opción**: en el editor, **Combinar dos o más colores** (por ejemplo Rosa + Azul). Queda como una sola opción con su propia existencia y se ve con el punto partido en sus colores.
5. **Predeterminados propios**: en **Ajustes → Colores y diseños predeterminados** agregas los tuyos. También se pueden guardar al escribir uno nuevo dentro de un producto.
6. **Archivar es más seguro**: al archivar una campaña eliges «solo los agotados» (lo recomendado) o «todo», y «todo» pide escribir ARCHIVAR. Después aparece **Deshacer** unos segundos. Borrar para siempre pide escribir BORRAR, y limpiar la base pide escribir LIMPIAR. Un producto archivado que aún tenía piezas espera el doble de tiempo antes de borrarse.

## 13. Foto de cada diseño
1. En el SQL Editor pega **todo** `migracion_fotos_disenos.sql` y dale **Run** (después de `migracion_disenos.sql`).
2. En el editor del producto, cada diseño tiene su campo **Foto de este diseño**: pegas el link de la imagen (igual que las fotos del producto). La foto vale para todas las opciones de ese diseño.
3. Se ve como miniatura al elegir la opción al vender, en la ficha del producto y en el QR público; al tocarla se amplía. También sale entre las fotos disponibles al crear una imagen para estados.

## 14. Mi inventario, fotos subidas y medidor de espacio
1. En el SQL Editor pega **todo** `migracion_fotos_storage.sql` y dale **Run**. Crea la carpeta `fotos` (pública para leer, solo la administración sube y borra) y la función que mide el espacio.
2. **Mi inventario** es ahora la pantalla principal: cada producto con su foto, cuántas piezas hay y, debajo, **cuántas de cada estilo** (diseño con su foto, o color). La administración ve además lo que vale el inventario (a precio de venta, a costo y la ganancia posible) y puede **Corregir cantidades** con − / +. Los vendedores ven las cantidades pero no los costos ni pueden editar.
3. **Subir foto**: en el formulario del producto y en la foto de cada diseño hay un botón para tomar o elegir una foto del teléfono. Se comprime sola (máx. 1000 px, unos 100 KB) y se guarda en Supabase. Pegar un link sigue funcionando.
4. **Espacio**: en **Ajustes → Espacio de fotos** hay una barra con lo usado y lo que queda (fotos + catálogos; el plan gratis da 1 GB). Avisa desde el 80 % y no deja subir más al llegar al 98 %. **Liberar fotos sin usar** borra del almacenamiento las que ningún producto usa; al borrar un producto para siempre también se borran sus fotos.
5. **Menú**: abajo quedan Inventario, Vender, Recibir y Más. Todo lo demás está en «Más», en grupos (Mi día, Mercadería, Dinero, Compartir, Privado, Sistema). «Ingreso rápido» ahora es **Recibí mercadería**, «Campaña» es **Tanda** y «Pendientes de completar» es **Falta foto o precio**.

6. **Vender con fotos**: debajo de la venta salen todos los productos con su foto y «Quedan N»; se toca la foto para agregar (si tiene estilos, pregunta cuál). **Recibir** sugiere arriba los que se están acabando. La primera vez que alguien entra sale una ayuda corta de «lo básico en 3 toques».

7. **Ver los productos**: en Inventario hay dos formas, **Cuadrícula** (3 columnas en el teléfono: foto, número de piezas encima, nombre y precio; al tocar sale el detalle con los estilos y sus cantidades) y **Detalle** (tarjetas grandes). La elegida se recuerda. El valor del inventario va en un desplegable.
8. **Producto nuevo en 3 pasos** (botón **Nuevo** en Inventario, en Resumen, en Productos y al recibir mercadería): 1 nombre, foto (subir o link), categoría y tanda; 2 precio y costo (dice cuánto se gana por pieza); 3 cuántas piezas, o los estilos si viene en colores o diseños.
9. **Resumen del día** ahora abre con un panorama del inventario: piezas, y cuántos productos están bien, por acabarse o agotados.

## Cambiar un PIN después
Desde el panel: **Ajustes → Cambiar PIN** (usa la función `cambiar-pin`). También se puede en Authentication → Users.

## Si algo falla
- «PIN incorrecto» con el PIN bueno: revisa que los correos sean exactamente los de la tabla y que corriste `roles.sql`.
- «Esta cuenta aún no tiene rol»: falta `roles.sql`.
- Las fotos no salen: el link debe ser el de la **imagen** directa (termina en .jpg/.png). Los de Google Drive y Dropbox se convierten solos.
