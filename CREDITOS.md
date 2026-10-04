# El Corazón de la Ciudad · Badajoz

**Publicada:** https://alvarotaiagu.github.io/apartamentos-corazon-ciudad-badajoz-web/
(GitHub Pages sobre la rama `master`, con `noindex` en las tres páginas mientras no se venda).

Web de los dos apartamentos turísticos de la calle Ramón Albarrán, 9 (06002 Badajoz).
Concepto: **«Cartografía»** — la portada dibuja el callejero real del casco antiguo
saliendo del portal, como si lo estuviera trazando un cartógrafo.

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
- Distancias a monumentos: **línea recta real** calculada desde el portal con los nodos
  de OSM. Los minutos son esa distancia × 1,3 (rodeo del callejero) a 80 m/min.

| Sitio | Línea recta | Andando |
|---|---|---|
| Plaza de España | 101 m | 2 min |
| Catedral de San Juan Bautista | 102 m | 2 min |
| Ayuntamiento | 161 m | 3 min |
| La Giralda | 329 m | 5 min |
| Museo de Bellas Artes | 340 m | 5 min |
| Plaza Alta | 437 m | 7 min |
| Puerta de Palmas | 615 m | 10 min |
| Alcazaba | 643 m | 10 min |
| Puente de Palmas | 907 m | 14 min |

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
