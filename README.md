# Vedith Variedades · Panel de inventario

Panel para vender, controlar el inventario y pedir cajas de Tupperware. Sitio estático (HTML + JS) con Supabase como base de datos. Se publica en GitHub Pages.

## Qué hace
- **Dos PIN de 6 números**: administración (todo) y visualizador (ve productos y precios, y puede vender).
- **Productos** con fotos por link de internet, código interno (`VED-0001`) y código de Tupperware (solo administración, nunca sale en la ficha pública ni en el QR).
- **Descuento (Regateo)**: precio mínimo que define la administración. Se muestra aparte, solo al tocarlo, y con un toque se vende a ese precio.
- **Cajas (pedidos a Tupperware)**: se registran los productos por caja, se marca si llegó (suma al inventario) y si ya se pagó (y con qué: efectivo, depósito o transferencia).
- **Dinero**: cada venta y cada pago de caja queda asignado a una cuenta (efectivo o banco). Se registran los depósitos de efectivo al banco. No es control bancario.
- **Ventas** con fiado y abonos. Las ventas del visualizador le llegan a la administración (aviso en el panel y en el teléfono).
- **Etiquetas QR** (solo administración): hojas listas para imprimir, con seguimiento de cuáles ya se imprimieron. Nunca se bloquea reimprimir.
- **Catálogos (librito)**: subes el PDF de la campaña y se convierte en un librito que se voltea página por página. Se comparte con un enlace o QR sin PIN; al terminar la campaña se archiva y se borran las imágenes (queda solo el nombre y las hojas).
- **Importador de productos**: marcas con un recuadro cada producto en las páginas del catálogo y se lee su código, nombre y precio (OCR dentro del navegador, sin costo). Los productos entran como borradores y se completan en «Pendientes» con tu precio y el enlace de su foto.
- **App instalable** con atajos (buscar, vender, escanear, etiquetas), escáner de QR con la cámara y respaldo en Excel.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html` | El panel (usa Supabase) |
| `demo.html` | Lo mismo con datos de ejemplo en el navegador. PIN 111111 (administración) y 222222 (visualizador) |
| `config.js` | Dirección y llave pública de Supabase |
| `schema.sql`, `roles.sql`, `push_setup.sql` | Base de datos |
| `supabase/functions/` | `enviar-push` (avisos) y `cambiar-pin` |
| `SUPABASE_SETUP.md` | Pasos de instalación |

Empieza por [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
