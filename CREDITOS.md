# El Corazón de la Ciudad · Badajoz

**Publicada:** https://alvarotaiagu.github.io/apartamentos-corazon-ciudad-badajoz-web/
(GitHub Pages sobre la rama `master`, con `noindex` en las tres páginas mientras no se venda).

Web de los dos apartamentos turísticos de la calle Ramón Albarrán, 9 (06002 Badajoz).
Concepto: **«Cartografía»** — la portada es un plano nocturno del casco antiguo,
real, con esta coreografía:

1. Arranca **ya ampliado**, a ras de calle (340 m de encuadre), y el callejero se
   traza saliendo de la chincheta, que lleva dentro el tejado del logo.
2. Aparecen en silueta las **manzanas** del barrio.
3. Con el plano ya hecho, la cámara **se retira de un solo tirón** (340 → 1.250 m,
   frenando al final) y, según se abre, van saliendo del portal los **recorridos a
   pie reales** con sus minutos, del más cercano al más lejano. Es el deszoom lo que
   hace que quepan: el encuadre final se calcula para que entren la Alcazaba (769 m)
   y la Puerta de Palmas (664 m).

El plano empieza a dibujarse **detrás de la cortina**, casi un segundo antes de que
esta se levante, y el titular sube mientras la cortina aún sube. Si no, al destaparse
se ven unos fotogramas de hero vacío y parece que la página se ha colgado;
`verificar.mjs` mide que, en el instante del destape, el lienzo ya tenga mapa.

En móvil se descartan solos los caminos que no caben (la Puerta de Palmas se
sale por la izquierda), y las chapas de los minutos nunca bajan del bloque de
texto, que se mide en vivo.

## De dónde sale cada cosa

### Marca
La paleta **no está inventada**: sale del logo real del negocio, midiendo los colores
dominantes sobre la imagen con PIL.

| Token | Color | Origen |
|---|---|---|
| `--indigo` | `#302490` | azul de las manos y el rótulo del logo |
| `--bermellon` | `#D8241A` | rojo del tejado y el corazón del logo |
| `--plano` | `#EFEEF4` | papel frío, elegido para **no** repetir las cremas cálidas del resto de webs del estudio (`#F4EFE7`, `#F7F4EF`, `#F3F1EA`…) |

`img/marca.svg` es el emblema **redibujado** (tejado + manos + corazón). El logo original
lleva el nombre y el teléfono incrustados y a 38 px se convertía en un borrón.
`img/logo.png` conserva el logo completo con fondo transparente.

### Fotografías
Las 29 fotos son las **reales del negocio**, descargadas de su web oficial
(`elcorazondelaciudad.com`, que corre sobre Amenitiz/Cloudinary) a 2048 px y
reprocesadas a 1600/800 px más un LQIP de 24 px. Los originales quedan en
`fotos-origen/`, separados por apartamento.

Las fotos de Badajoz (Plaza Alta, Puente de Palmas, la Giralda, la Catedral) son las
que el propio negocio usa en su web.

### Callejero de la portada
`js/callejero.js` contiene 547 calles del casco antiguo en un radio de 460 m alrededor
del portal, en metros respecto a él.

> Datos cartográficos © colaboradores de **OpenStreetMap**, disponibles bajo la
> **Open Database License (ODbL)**. https://www.openstreetmap.org/copyright

Obtenidos vía Overpass API, simplificados con Douglas-Peucker (ε = 2,5 m).
La atribución está recogida en `aviso-legal.html`.

### Datos y distancias
Todo verificado, nada inventado:

- Dirección, teléfono, correo, superficies, camas y servicios: de su web oficial.
- Coordenadas `38.8774593, -6.9696957`: Nominatim (OSM), edificio con portal nº 9.
- Distancias a monumentos: **recorrido real a pie**, calculado con Dijkstra sobre el
  grafo peatonal de OSM (14.941 nodos en 1,4 km a la redonda). **No** es la línea recta
  multiplicada por un factor: es el camino que se anda de verdad, calle a calle.
- Minutos = `ceil(metros / 80)` con **mínimo 2**, porque entre el portal, la escalera y
  salir a la acera nadie llega a ningún sitio en sesenta segundos.

| Sitio | Andando | Minutos | (línea recta) |
|---|---|---|---|
| Catedral de San Juan Bautista | 77 m | 2 min | 102 m |
| Plaza de España | 139 m | 2 min | 101 m |
| Ayuntamiento | 175 m | 3 min | 161 m |
| La Giralda | 389 m | 5 min | 329 m |
| Museo de Bellas Artes | 389 m | 5 min | 340 m |
| Plaza Alta | 565 m | 8 min | 437 m |
| Puerta de Palmas | 664 m | 9 min | 615 m |
| Alcazaba | 769 m | 10 min | 643 m |
| Puente de Palmas (otra orilla) | 1.564 m | 20 min | 907 m |

Los cinco marcados como `hero` en `datos/rutas.json` son los que se dibujan en la
portada. El Puente de Palmas no se cita con sus 20 minutos porque ese nodo de OSM está
al otro lado del río: la web habla de la **Puerta** de Palmas (9 min), y el puente
arranca justo detrás.

### Reseñas
Las cinco son **literales** de su web, con el nombre de quien las firmó
(Marina, Leyder, David, Jose, Alejandro). No se muestra recuento ni nota media,
porque con tan pocas reseñas un número hace más daño que bien.

## Lo que falta antes de publicar

- [ ] Nombre o razón social completa y NIF/CIF del titular (marcado en las dos
      páginas legales).
- [ ] Número de registro de los apartamentos en el registro turístico de Extremadura.
- [ ] Confirmar precios con Víctor: **no se indica ninguno**, porque no se pudieron
      verificar.
- [ ] Quitar `noindex,nofollow` de `index.html`, `aviso-legal.html` y `privacidad.html`
      el día que se publique de verdad.

## Cómo probarla

```
node verificar.mjs          # 29 comprobaciones en local: escritorio, móvil,
                            # movimiento reducido, sin JS y páginas legales
node mirar.mjs 1440 900 esc # capturas sección a sección (escritorio)
node mirar.mjs 390 844 mov  # ídem en móvil
node en-vivo.mjs            # comprueba lo YA PUBLICADO en Pages: que el CSS y
                            # las fotos carguen bajo el prefijo del repo
```

Las capturas van a `pruebas/` (ignorado por git, igual que `fotos-origen/`).
Los scripts levantan su propio servidor (puertos 8731 y 8732) y usan el
Playwright instalado en `ayuntamiento-usagre-web`.

## Técnica

GSAP 3.12.5 + ScrollTrigger (cdnjs) · Lenis 1.0.42 (jsDelivr, **nunca** cdnjs: allí
da 404 silencioso) · Cormorant Garamond + Jost (Google Fonts). Sin dependencias
propias: la web es HTML, CSS y JS a pelo.
