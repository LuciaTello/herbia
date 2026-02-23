# herbia

> Tu companera de descubrimiento botanico para viajeros y peregrinos.

## Vision del Proyecto

**herbia** es una aplicacion web adaptada a moviles que ayuda a los viajeros a descubrir e
identificar plantas a lo largo de su camino. El nombre es un juego de palabras entre "herbe"
(hierba/planta en frances) e "IA" (Inteligencia Artificial).

El caso de uso principal: Estás caminando el **Camino de Santiago** (o cualquier ruta de viaje).
Le dices a la app donde estás y a donde vas hoy. La app usa IA para sugerirte 3-4 plantas que
probablemente encuentres por el camino. Durante tu caminata, puedes fotografiar las plantas que
encuentres, y la IA te dira si has encontrado la correcta.

Es como una **busqueda del tesoro botanica** impulsada por IA.

---

## Funcionalidades

### MVP (Version 1.0)

- [ ] **Entrada de Ruta**: El usuario introduce un punto de partida y un destino
  - Ejemplo: "Irun" a "San Sebastian"
  - Autocompletado para ciudades/etapas conocidas en rutas populares

- [ ] **Sugerencias de Plantas con IA**: Basandose en la ruta, sugerir 3-4 plantas
  - Las plantas deben ser comunes y faciles de encontrar a lo largo del camino
  - Considerar la estacion, region y clima
  - Mostrar una foto de referencia para cada planta
  - Mostrar info basica: nombre comun, nombre cientifico, breve descripcion

- [ ] **Captura de Fotos de Plantas**: El usuario puede hacer una foto de una planta que encuentre
  - Acceder a la camara del movil desde el navegador
  - Guardar la foto localmente en el dispositivo

- [ ] **Reconocimiento de Plantas con IA**: Comparar la foto del usuario con la planta sugerida
  - Decirle al usuario si es la correcta o no
  - Proporcionar nivel de confianza
  - Si no coincide, intentar identificar que planta es realmente

- [ ] **Coleccion / Diario de Plantas**: Mantener un registro de todas las plantas encontradas
  - Fecha y ubicacion del descubrimiento
  - Foto del usuario junto a la foto de referencia
  - Notas personales

### Ideas Futuras (Version 2.0+)

- [ ] **Base de Datos de Rutas Populares**: Rutas precargadas
  - Camino de Santiago (todas las rutas: Frances, Norte, Portugues, etc.)
  - Via Francigena
  - Otros senderos europeos de larga distancia

- [ ] **Modo Offline**: Esencial para caminar en zonas sin cobertura
  - Pre-descargar datos e imagenes de plantas antes de empezar una etapa
  - Cachear sugerencias de IA para la ruta del dia
  - Sincronizar fotos y descubrimientos al volver a tener conexion

- [ ] **Funcionalidades Sociales**
  - Compartir tus descubrimientos de plantas
  - Ver lo que otros peregrinos encontraron en la misma ruta
  - Ayuda comunitaria para identificar plantas

- [ ] **Gamificacion**
  - Insignias por encontrar plantas raras
  - Nivel de "Botanico" progresivo
  - Retos diarios

- [ ] **Info Medicinal y Culinaria**
  - Usos tradicionales de las plantas
  - Avisos de seguridad (plantas toxicas!)
  - Plantas comestibles por el camino

---

## Stack Tecnologico

| Capa | Tecnologia | Notas |
|------|-----------|-------|
| **Frontend** | Angular 21.1 | Standalone components, Signals |
| **Lenguaje** | TypeScript 5.9 | Modo estricto activado |
| **Estilos** | CSS (scoped por componente) | Mobile-first, responsive |
| **Testing** | Vitest 4.0 | Tests unitarios + de componente |
| **IA (plantas)** | Google Gemini API (free tier) | Para sugerencias de plantas segun la ruta |
| **IA (vision)** | Pl@ntNet API (gratuita) | Para reconocimiento de plantas desde fotos |
| **Backend** | Node.js + Express (TypeScript) | Proxy para API keys + logica servidor |
| **Base de datos** | PostgreSQL + Prisma (ORM) | Como JPA/Hibernate, datos persistentes en servidor |
| **Contenedores** | Docker (Rancher Desktop) | Para correr PostgreSQL en local |
| **PWA** | Angular PWA | Para instalacion movil + soporte offline |

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  herbia App                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Home    │  │  Route   │  │  Collection  │  │
│  │  Page    │  │  Page    │  │  Page        │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │          │
│  ┌────┴──────────────┴───────────────┴───────┐  │
│  │           Capa de Servicios               │  │
│  ├───────────┬──────────────┬────────────────┤  │
│  │ Route     │ Plant        │ Collection     │  │
│  │ Service   │ Service      │ Service        │  │
│  └─────┬─────┘──────┬───────┘───────┬────────┘  │
│        │            │               │           │
│  ┌─────┴────────────┴───────────────┴────────┐  │
│  │            APIs Externas                  │  │
│  ├────────────────┬──────────────────────────┤  │
│  │  API de IA     │  Local Storage / IndexDB │  │
│  │  (sugerencias  │  (coleccion de plantas,  │  │
│  │   + reconoci-  │   fotos, datos offline)  │  │
│  │   miento via   │                          │  │
│  │   backend)     │                          │  │
│  └────────────────┴──────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Paginas (Componentes)

1. **Home Page** (`/`)
   - Pantalla de bienvenida
   - Acceso rapido para iniciar una nueva ruta o ver la coleccion

2. **Route Page** (`/route`)
   - Introducir inicio y destino
   - Ver plantas sugeridas para la ruta
   - Hacer fotos y comparar con las sugerencias

3. **Collection Page** (`/collection`)
   - Ver todas las plantas encontradas en todos los viajes
   - Filtrar por ruta, fecha, tipo de planta

4. **Plant Detail Page** (`/plant/:id`)
   - Info detallada de una planta especifica
   - Foto del usuario vs foto de referencia
   - Resultado del reconocimiento IA

### Servicios

1. **RouteService** - Gestiona datos de ruta (inicio, destino, info del camino)
2. **PlantService** - Se comunica con la API de IA para sugerencias y reconocimiento
3. **CollectionService** - Gestiona la coleccion de plantas del usuario (almacenamiento local)
4. **CameraService** - Maneja el acceso a la camara y captura de fotos

---

## Estructura del Proyecto (Planificada)

```
src/
├── app/
│   ├── app.ts                    # Componente raiz
│   ├── app.config.ts             # Configuracion de la app
│   ├── app.routes.ts             # Definiciones de rutas
│   ├── app.html                  # Template raiz
│   ├── app.css                   # Estilos raiz
│   │
│   ├── pages/                    # Componentes de pagina (con ruta)
│   │   ├── home/
│   │   │   ├── home.ts
│   │   │   ├── home.html
│   │   │   └── home.css
│   │   ├── route/
│   │   │   ├── route.ts
│   │   │   ├── route.html
│   │   │   └── route.css
│   │   ├── collection/
│   │   │   ├── collection.ts
│   │   │   ├── collection.html
│   │   │   └── collection.css
│   │   └── plant-detail/
│   │       ├── plant-detail.ts
│   │       ├── plant-detail.html
│   │       └── plant-detail.css
│   │
│   ├── components/               # Componentes UI reutilizables
│   │   ├── plant-card/
│   │   ├── camera-button/
│   │   └── nav-bar/
│   │
│   ├── services/                 # Logica de negocio y llamadas API
│   │   ├── route.service.ts
│   │   ├── plant.service.ts
│   │   ├── collection.service.ts
│   │   └── camera.service.ts
│   │
│   └── models/                   # Interfaces TypeScript (como DTOs de Java)
│       ├── plant.model.ts
│       ├── route.model.ts
│       └── collection.model.ts
│
├── index.html
├── main.ts
└── styles.css                    # Estilos globales
```

---

## Registro de Desarrollo

### 2026-02-22 - Proyecto Creado y Primeras Paginas

- Generado proyecto Angular 21.1.0 con Angular CLI
- Setup del proyecto con:
  - Standalone components (sin NgModule)
  - Vitest para testing
  - Configuracion estricta de TypeScript
  - Router preconfigurado
- Creada la documentacion del proyecto (este fichero)
- Creado el curriculum de aprendizaje (LEARNING.md)
- Renombrado el proyecto de "untitled" a "herbia" en todos los ficheros
- Reemplazado el template placeholder por pagina de bienvenida propia
- Creado componente `HomePage` (`/`) con botones de navegacion
- Creado componente `RoutePage` (`/route`) con formulario origen/destino
- Creado modelo `Plant` (interface TypeScript)
- Implementada lista de plantas con datos mock (Romero, Brezo, Helecho)
- Configurado routing: `/` → HomePage, `/route` → RoutePage
- Decidido stack backend: Node.js + Express con TypeScript
- Decididas APIs de IA: Google Gemini (sugerencias) + Pl@ntNet (reconocimiento)
- **Estado:** Frontend funcional con 2 paginas, navegacion y datos mock. Falta backend + IA

### 2026-02-22 - Servicios, Coleccion y Persistencia

- Creado `PlantService` (logica de sugerencias, datos mock por ahora)
- Creado `CollectionService` (estado compartido, persistencia con localStorage)
- Creado modelo `FoundPlant` (planta encontrada + fecha + ruta)
- Creado componente `CollectionPage` (`/collection`)
- Boton "La he encontrado!" en RoutePage → anade planta a la coleccion
- Boton borrar (x) en CollectionPage → elimina planta de la coleccion
- Botones "Volver al inicio" en RoutePage y CollectionPage
- Boton desactivado si la planta ya esta en la coleccion
- Comentarios explicativos en el codigo para atajos de JavaScript
- **Estado:** Frontend completo con 3 paginas, navegacion, coleccion persistente. Falta backend + IA

### 2026-02-23 - Backend, Gemini API, Wikipedia, Refactoring

- Creado backend Node.js + Express en `server/`
- Integrado Google Gemini API para sugerencias reales de plantas
- Conectado frontend Angular con backend (PlantService ahora llama al API)
- Anadido `provideHttpClient()` en app.config.ts
- Resuelto problema de imagenes: Gemini generaba URLs falsas → anadida busqueda en Wikipedia API
- Refactorizado `server/src/index.ts`: handler largo dividido en 4 funciones privadas
  - `buildPlantPrompt()`, `askGeminiForPlants()`, `getWikipediaImage()`, `enrichPlantsWithImages()`
- Estados de loading y error en RoutePage
- Creado `.env` con GEMINI_API_KEY
- Decidido migrar de localStorage a PostgreSQL + Prisma
- Instalando Rancher Desktop (Docker) para contenedor PostgreSQL
- **Estado:** App funcional end-to-end (Angular → Express → Gemini → Wikipedia). Falta base de datos real.

### 2026-02-23 - Docker, PostgreSQL, Prisma, Refactoring completo

- Instalado Rancher Desktop (Docker) para contenedores
- Creado `docker-compose.yml` con PostgreSQL 17 + volume persistente
- Instalado y configurado Prisma 7 como ORM (equivalente JPA/Hibernate)
- Creado modelo `FoundPlant` en schema.prisma, ejecutada primera migracion
- Creados endpoints CRUD: GET/POST/DELETE `/api/collection`
- Refactorizado backend en ficheros separados (routes/, services/)
- Conectado frontend Angular: CollectionService ahora usa HTTP en vez de localStorage
- Modelo FoundPlant cambiado de anidado a plano (refleja tabla SQL)
- Anadido ngOnInit en CollectionPage y RoutePage para cargar datos del backend
- **Estado:** App fullstack completa: Angular → Express → Gemini/Wikipedia + PostgreSQL

### Proxima sesion prevista
- Opcion A: Camara + Pl@ntNet (reconocimiento de plantas desde fotos)
- Opcion B: PWA (instalar app en el movil, soporte offline)
- Opcion C: Mejorar UI/UX (diseno mobile-first, animaciones)

---

## Glosario (para el desarrollador Java)

| Termino Angular/Frontend | Equivalente Java | Explicacion |
|--------------------------|-----------------|-------------|
| Component | Controller + View | Elemento UI reutilizable con logica y template |
| Template | JSP / Thymeleaf | El HTML que define lo que ve el usuario |
| Service | Clase @Service | Logica de negocio, inyectable via DI |
| Signal | Patron Observer | Valor reactivo que notifica cuando cambia |
| Observable (RxJS) | Reactor Flux/Mono | Flujo de datos asincrono |
| Route | @RequestMapping | Ruta URL mapeada a un componente |
| Guard | Filtro de seguridad | Protege rutas de acceso no autorizado |
| Interceptor | HandlerInterceptor | Modifica peticiones/respuestas HTTP |
| Pipe | Formatter | Transforma datos para mostrar (ej: formato fecha) |
| Directive | Custom tag | Anade comportamiento a elementos HTML |
| NgModule | Spring @Configuration | Agrupa componentes/servicios relacionados (patron legacy) |
| Standalone Component | @Component + @Bean | Componente autocontenido (patron moderno) |
| package.json | pom.xml / build.gradle | Gestion de dependencias |
| node_modules/ | .m2/ / .gradle/ | Carpeta de dependencias descargadas |
| npm / yarn | Maven / Gradle | Gestor de paquetes |
| webpack / esbuild | Maven compiler plugin | Herramienta de build (bundler) |
| dist/ | target/ | Carpeta de salida del build |
