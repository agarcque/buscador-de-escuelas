# Buscador de Escuelas en Mexico

Aplicacion frontend responsiva para consultar centros de trabajo educativos en Mexico usando dos archivos CSV como fuente principal de datos.

## Estructura

```text
Buscador_de_Escuelas/
├─ index.html
├─ package.json
├─ README.md
├─ public/
│  └─ data/
│     ├─ CATALOGO_CENTRO_TRABAJO_01_16_CSV.csv
│     └─ CATALOGO_CENTRO_TRABAJO_17_32_CSV.csv
└─ src/
   ├─ main.js
   └─ styles.css
```

## Uso local

1. Coloca los CSV en `public/data/` con estos nombres:
   - `CATALOGO_CENTRO_TRABAJO_01_16_CSV.csv`
   - `CATALOGO_CENTRO_TRABAJO_17_32_CSV.csv`
2. Instala dependencias:

```bash
npm install
```

3. Inicia la app:

```bash
npm run dev
```

## Decisiones arquitectonicas

- La app es solo frontend y carga los CSV en el navegador.
- PapaParse procesa los archivos con `worker` y lectura por pasos para no bloquear tanto la interfaz con catalogos grandes.
- Los registros se normalizan al cargarse para acelerar busquedas por nombre, CCT, estado, municipio, nivel y tipo.
- Por defecto solo se muestran centros con estatus `ACTIVO`.
- La lista renderiza un maximo inicial de 120 tarjetas para mantener la interfaz rapida con datasets grandes.
- El mapa usa Leaflet y limita los marcadores visibles a 500 para conservar rendimiento.

## Publicacion en Railway

Railway puede ejecutar:

```bash
npm install
npm run build
npm start
```

La app se publica como sitio estatico desde la carpeta `dist`.

## Recomendaciones para escalar

- Mover los CSV a una API con paginacion, indices de busqueda y cache.
- Guardar los datos en PostgreSQL/PostGIS para busquedas geograficas reales.
- Agregar busqueda tolerante a errores con Meilisearch, Typesense o Elasticsearch.
- Incorporar filtros dependientes desde backend para reducir carga del navegador.
- Agregar pruebas automatizadas de filtros, carga de datos y vistas responsivas.
