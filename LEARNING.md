# Ruta de Aprendizaje: De Backend Java a Desarrollador Fullstack

**Alumno:** Desarrollador Backend Senior en Java
**Objetivo:** Convertirse en desarrollador fullstack con Angular/TypeScript
**Proyecto:** herbia (app guia de plantas)
**Inicio:** 2026-02-22
**Idioma del curso:** Espanol (el codigo siempre en ingles)

---

## Resumen del Programa

Esta es la lista completa de temas que cubriremos juntos, organizados por modulos.
Cada tema se marcara como completado a medida que lo aprendamos en nuestras sesiones.

### Modulo 1: Fundamentos de JavaScript y TypeScript

> **Por que es importante:** Ya conoces Java, asi que tienes una gran ventaja. TypeScript
> es muy similar a Java en muchos aspectos (tipos, clases, interfaces). Pero JavaScript
> (al que TypeScript compila) tiene diferencias importantes que necesitas entender.

- [ ] **1.1 JavaScript vs Java: Diferencias clave**
  - Tipado dinamico, `var` vs `let` vs `const`
  - Valores truthy/falsy (muy diferente a Java!)
  - `===` vs `==` (igualdad estricta vs flexible)
  - `null` vs `undefined` (Java solo tiene `null`)

- [ ] **1.2 Funciones en JavaScript**
  - Declaraciones de funciones vs expresiones
  - Arrow functions `() => {}` (como las lambdas de Java, pero mas potentes)
  - Closures (funciones que "recuerdan" su scope/ambito)
  - La palabra clave `this` (MUY diferente al `this` de Java)

- [ ] **1.3 Objetos y Arrays**
  - Objetos literales `{}` (como los Maps de Java pero mas flexibles)
  - Destructuring `const { name, age } = person`
  - Operador spread `...` (copiar/fusionar objetos y arrays)
  - Metodos de arrays: `map`, `filter`, `reduce`, `find`, `forEach`

- [ ] **1.4 Programacion Asincrona**
  - Callbacks (la forma antigua)
  - Promises (como el `CompletableFuture` de Java)
  - `async` / `await` (forma limpia de manejar codigo asincrono)
  - Por que el navegador es single-threaded (no hay multithreading real como en Java)

- [ ] **1.5 TypeScript en detalle**
  - Anotaciones de tipo (similar a las declaraciones de tipo en Java)
  - Interfaces vs Types (similar a las interfaces de Java, pero mas flexibles)
  - Genericos `<T>` (esto ya lo conoces de Java!)
  - Enums (similar a los enums de Java pero mas simples)
  - Union types `string | number` (Java no tiene esto)
  - Propiedades opcionales `name?: string`
  - Type guards y narrowing

- [ ] **1.6 Modulos (import/export)**
  - ES Modules vs paquetes de Java
  - Named exports vs default exports
  - Como funciona `import` en TypeScript/Angular

### Modulo 2: Conceptos Fundamentales de Angular

> **Por que es importante:** Angular es el framework que une todo.
> Es "opinionated" (como Spring Boot), lo que significa que tiene una "forma correcta" de hacer las cosas.
> Buena noticia: Angular usa inyeccion de dependencias, igual que Spring!

- [x] **2.1 Arquitectura de Angular - Vision general**
  - Componentes (los bloques de construccion - como controladores de UI)
  - Templates (HTML con sintaxis Angular)
  - Servicios (como las clases `@Service` de Spring)
  - Modules vs Standalone Components (Angular moderno usa standalone)
  - Como arranca Angular (similar al `main()` de Spring Boot)

- [x] **2.2 Componentes en profundidad**
  - Decorador `@Component` (como las anotaciones de Java!)
  - Ciclo de vida de un componente (`ngOnInit`, `ngOnDestroy`, etc.)
  - Input/Output (comunicacion padre-hijo)
  - Sintaxis del template: interpolacion `{{ }}`, property binding `[prop]`, event binding `(event)`

- [x] **2.3 Signals (Sistema de reactividad de Angular)**
  - Que son los signals y por que existen
  - `signal()`, `computed()`, `effect()`
  - Comparacion con el patron Observer de Java
  - Por que Angular paso de RxJS a Signals para estado simple

- [x] **2.4 Inyeccion de Dependencias**
  - `@Injectable` (como el `@Service` / `@Component` de Spring)
  - `providedIn: 'root'` (como el scope singleton de Spring)
  - Tokens de inyeccion
  - Como se compara la DI de Angular con la de Spring

- [x] **2.5 Routing (Enrutamiento)**
  - Configuracion de rutas
  - Router outlet
  - Parametros de ruta (como `@PathVariable` de Spring)
  - Navegacion (programatica y desde el template)
  - Route guards (como los filtros de Spring Security)
  - Lazy loading de rutas

- [x] **2.6 Formularios**
  - Template-driven forms (simples, como formularios HTML)
  - Reactive forms (potentes, como construir formularios en codigo)
  - Validacion (validadores integrados y personalizados)

- [ ] **2.7 Comunicacion HTTP**
  - `HttpClient` (como el `RestTemplate` / `WebClient` de Java)
  - Interceptors (como el `HandlerInterceptor` de Spring)
  - Manejo de errores en llamadas HTTP

### Modulo 3: HTML y CSS para Desarrolladores

> **Por que es importante:** Como desarrollador backend, HTML/CSS puede ser territorio nuevo.
> Son los lenguajes que controlan lo que ven los usuarios y como se ve.

- [x] **3.1 Elementos esenciales de HTML**
  - Elementos HTML semanticos (`header`, `main`, `nav`, `section`, etc.)
  - Formularios y elementos de entrada
  - Conceptos basicos de accesibilidad (atributos ARIA, alt text)

- [x] **3.2 Fundamentos de CSS**
  - Selectores, propiedades, valores
  - El Box Model (margin, border, padding, content)
  - Flexbox (sistema de layout moderno)
  - CSS Grid (sistema de layout 2D)
  - Diseno responsive con media queries

- [x] **3.3 CSS en Angular**
  - Estilos de componente (scoped por defecto - como Shadow DOM)
  - Estilos globales vs estilos de componente
  - Variables CSS (custom properties)

### Modulo 4: Gestion de Estado y Arquitectura

> **Por que es importante:** En aplicaciones grandes, gestionar los datos (estado) es el problema
> mas dificil. Es similar a gestionar estado en un sistema Java distribuido.

- [x] **4.1 Estado del Componente**
  - Estado local con signals
  - Compartir estado entre componentes

- [x] **4.2 Servicios como Gestores de Estado**
  - Servicios singleton para estado compartido
  - Patron de gestion de estado basado en servicios

- [ ] **4.3 Conceptos basicos de RxJS**
  - Observables (como Reactive Streams / Project Reactor de Java)
  - Operadores comunes: `map`, `switchMap`, `catchError`, `tap`
  - Cuando usar RxJS vs Signals

### Modulo 5: Trabajando con APIs de IA

> **Por que es importante:** herbia usa IA para sugerencias y reconocimiento de plantas.
> Aprenderas a llamar APIs externas desde Angular.

- [ ] **5.1 Integracion con APIs REST**
  - Llamar APIs de IA desde Angular
  - API keys y seguridad (NUNCA en el codigo frontend!)
  - Patron backend proxy (por que y como)

- [ ] **5.2 Manejo de Imagenes**
  - Acceso a la camara en el navegador
  - Subida y visualizacion de imagenes
  - Trabajar con datos base64 y blob

### Modulo 6: Movil y PWA

> **Por que es importante:** Quieres que herbia funcione en moviles durante las caminatas.
> PWA (Progressive Web App) hace que una app web se sienta como una app nativa.

- [ ] **6.1 Progressive Web App (PWA)**
  - Que es una PWA y por que es perfecta para herbia
  - Service Workers (capacidad offline)
  - App manifest (instalable en el movil)
  - Estrategias de almacenamiento offline

- [ ] **6.2 Diseno Mobile-First**
  - Principios de diseno responsive
  - Interacciones tactiles
  - Rendimiento en dispositivos moviles

### Modulo 7: Testing

> **Por que es importante:** Ya conoces testing de Java (JUnit, Mockito).
> Los conceptos son los mismos, solo cambian las herramientas.

- [x] **7.1 Testing unitario con Vitest**
  - Testing de componentes (como testear controladores de Spring)
  - Testing de servicios (como testear servicios de Spring)
  - Mocking de dependencias (similar a Mockito)

- [ ] **7.2 Testing End-to-End**
  - Que es el testing E2E
  - Testear flujos de usuario

### Modulo 8: Build, Deploy y DevOps

> **Por que es importante:** Necesitas llevar tu app a los usuarios.
> Similar a compilar y desplegar una app Java, pero para el frontend.

- [ ] **8.1 Proceso de Build**
  - Como Angular CLI compila la app
  - Builds de produccion vs desarrollo
  - Optimizacion del tamano del bundle

- [ ] **8.2 Despliegue**
  - Opciones de hosting para apps Angular
  - Conceptos basicos de CI/CD para frontend

---

## Referencia Rapida Java-a-TypeScript

| Java | TypeScript | Notas |
|------|-----------|-------|
| `String name = "hello";` | `const name: string = 'hello';` | `const` = final, `string` en minuscula |
| `int count = 0;` | `let count: number = 0;` | Todos los numeros son `number` (no hay int/long/float) |
| `boolean active = true;` | `let active: boolean = true;` | Mismo concepto |
| `List<String> items` | `items: string[]` | Los arrays son mas simples |
| `Map<String, Object>` | `Record<string, any>` o `{ [key: string]: any }` | Los objetos son muy flexibles |
| `interface Runnable` | `interface Runnable` | Sintaxis casi identica! |
| `public class Cat {}` | `class Cat {}` | Sin modificadores de acceso por defecto (es public) |
| `@Autowired` | `inject()` | Inyeccion de dependencias de Angular |
| `@RestController` | `@Component` | Decorador que define un componente UI |
| `@Service` | `@Injectable` | Clase de servicio inyectable |
| `CompletableFuture<T>` | `Promise<T>` | Computacion asincrona |
| `Stream.map()` | `array.map()` | Operaciones funcionales sobre colecciones |
| `Optional<T>` | `T \| undefined` | Manejo de valores nulos |
| `package com.app` | `import { X } from './file'` | Sistema de modulos |
| `final` | `const` / `readonly` | Inmutabilidad |
| `null` | `null \| undefined` | JS tiene DOS valores "nada"! |

---

## Registro de Sesiones

### Sesion 1 - 2026-02-22: Setup del Proyecto y Primera Leccion

**Lo que hicimos:**
- Revisamos el proyecto Angular 21.1.0 generado por Angular CLI
- Creamos la documentacion del proyecto (HER-B-IA.md)
- Creamos este curriculum de aprendizaje (LEARNING.md)
- Discutimos los objetivos del proyecto y la arquitectura
- Renombramos el proyecto de "untitled" a "herbia" en 5 ficheros
- Reemplazamos el template placeholder de Angular por nuestra propia pagina de bienvenida
- Anadimos estilos CSS basicos al componente raiz

**Conceptos clave introducidos:**
- Estructura de un proyecto Angular: como se organizan los ficheros
- `package.json`: como el `pom.xml` o `build.gradle` de Java - gestiona dependencias
- `angular.json`: configuracion del proyecto (como `application.properties` en Spring Boot)
- `tsconfig.json`: opciones del compilador TypeScript (como las opciones del compilador en Java)
- `main.ts`: punto de entrada (como `public static void main(String[] args)`)
- Componentes: el bloque basico de construccion de apps Angular (clase + template + estilos)
- Signals: la forma de Angular de manejar datos reactivos (`signal('value')`)
- Componentes standalone: patron moderno de Angular (sin necesidad de NgModule)
- `@Component`: decorador similar a las anotaciones de Java (`@Controller`, `@Service`)
- `protected readonly`: `protected` permite acceso desde el template, `readonly` es como `final`
- Interpolacion `{{ }}`: mostrar valores de TypeScript en el HTML (como Thymeleaf `th:text`)
- HTML semantico: `<main>`, `<header>`, `<section>` en vez de `<div>` para todo
- CSS scoped: cada componente tiene sus propios estilos aislados
- `:host`: selector CSS especial para el propio componente
- `signal()`: wrapper reactivo que notifica al template cuando el valor cambia
- `?.` (optional chaining): como `Optional` de Java, evita NullPointerException
- Tests con Vitest: `describe` = clase test, `it` = `@Test`, `expect` = `assertThat`

**Lo que el alumno deberia repasar:**
- Mirar `src/main.ts` y compararlo con un metodo `main()` de Java
- Mirar `src/app/app.ts` y notar el decorador `@Component` (como anotaciones Java)
- Mirar `src/app/app.config.ts` y comparar los providers con la configuracion `@Bean` de Spring
- Leer la tabla de Referencia Rapida Java-a-TypeScript de arriba
- Mirar `src/app/app.html` y entender la interpolacion `{{ title() }}`
- Mirar `src/app/app.css` y entender como `:host`, `margin: 0 auto` y `rem` funcionan

**Preguntas para reflexionar:**
1. En `app.ts`, por que usamos `signal('herbia')` en vez de simplemente `title = 'herbia'`?
2. En `app.config.ts`, a que te recuerda `provideRouter(routes)` en Spring?
3. Cual es el papel de `app.html`? A que concepto de Java se parece? (Pista: piensa en JSP/Thymeleaf)
4. Por que los estilos en `app.css` solo afectan a este componente y no a toda la pagina?
5. Que pasaria si quitas los `()` de `{{ title() }}` en el template? (Pista: `title` es un signal, no un string)

### Sesion 1 (continuacion) - 2026-02-22: Primera pagina, formularios y datos mock

**Lo que hicimos:**
- Explicacion detallada de npm (equivalente a Maven/Gradle), scripts y como arrancar la app
- Explicacion de como arranca Angular: `index.html` → `main.ts` → `App` component
- Explicacion de la arquitectura: Componentes (lo que se VE), Servicios (lo que HACE), Router (lo que NAVEGA)
- Explicacion del flujo SPA: todo pasa en el navegador, sin recargar pagina
- Creamos el componente `HomePage` (pages/home/) a mano, sin Angular CLI
- Creamos el componente `RoutePage` (pages/route/) con formulario
- Configuramos las rutas en `app.routes.ts`: `/` → HomePage, `/route` → RoutePage
- Conectamos la navegacion con `routerLink` en HomePage
- Limpiamos `app.html` para que sea solo el marco (header + router-outlet)
- Creamos el modelo `Plant` (interface TypeScript, como un DTO/Record de Java)
- Mostramos datos mock de plantas con `@if` y `@for` en el template
- Usamos `[src]` y `[alt]` para imagenes dinamicas

**Conceptos clave aprendidos:**

*Crear componentes:*
- Un componente = 3 ficheros (`.ts` + `.html` + `.css`)
- `selector`: el nombre del tag HTML personalizado
- `imports`: declarar las dependencias que el template necesita (como `FormsModule`, `RouterLink`)
- `export class`: `export` es como `public` en Java

*Sintaxis del template Angular (los dos superpoderes):*
- `[corchetes]` = valor dinamico controlado por TypeScript (TypeScript → HTML)
  - Ejemplo: `[disabled]="true"`, `[src]="foto"`, `[ngModel]="origin()"`
- `(parentesis)` = reaccionar a lo que hace el usuario (HTML → TypeScript)
  - Ejemplo: `(click)="buscar()"`, `(ngSubmit)="onSearch()"`, `(ngModelChange)="origin.set($event)"`
- `{{ interpolacion }}` = mostrar un valor de TypeScript como texto en el HTML

*Signals en profundidad (variable vigilada):*
- Un signal es una CAJA que contiene un valor
- `signal('valor')` = crear la caja (como `new AtomicReference<>()`)
- `origin()` = leer el valor de la caja (con parentesis!)
- `origin.set('nuevo')` = cambiar el valor de la caja
- Cuando cambia, Angular refresca SOLO la parte del HTML que usa ese signal
- Signal con tipo generico: `signal<Plant[]>([])` como `Signal<List<Plant>>`

*Formularios:*
- `FormsModule` necesario para usar `ngModel`
- `ngModel` = conexion bidireccional entre input y variable
- `[ngModel]` = input muestra el valor de la variable
- `(ngModelChange)` = cuando el usuario escribe, actualiza la variable
- `$event` = el valor nuevo que escribio el usuario
- `(ngSubmit)` = evento que se dispara al enviar el formulario
- `required` = validacion HTML nativa

*Routing:*
- `{ path: '', component: HomePage }` = mapear URL a componente (como `@GetMapping`)
- `routerLink="/route"` = navegar sin recargar la pagina
- `<router-outlet>` = donde se cargan los componentes segun la URL
- `<a>` para navegacion, `<button>` para acciones

*Control de flujo en templates:*
- `@if (condicion) { ... }` = mostrar HTML condicionalmente
- `@for (item of lista; track item.id) { ... }` = recorrer una lista
- `track` = clave unica para optimizar el renderizado (como una PK en SQL)

*CSS nuevos:*
- `:focus` = estilos cuando el usuario hace click en un input
- `transition` = animar cambios de estilo (ej: cambio de color suave)
- `object-fit: cover` = la imagen mantiene proporciones y se recorta si hace falta
- `overflow: hidden` = respetar bordes redondeados en imagenes
- `text-decoration: none` = quitar subrayado de enlaces
- `box-sizing: border-box` = el padding se cuenta dentro del ancho total

*Gestion de estado (comparacion con React/Redux):*
- Angular NO necesita Redux para la mayoria de apps
- Nivel 1: Signals = estado local del componente (como useState en React)
- Nivel 2: Servicios con signals = estado compartido (reemplaza Redux en el 80% de los casos)
- Nivel 3: NgRx = Redux para Angular (solo para apps muy complejas, no lo necesitamos)

*Seguridad API keys:*
- NUNCA poner API keys en el frontend (el codigo es visible con F12)
- Necesitamos un backend proxy que guarde las claves en secreto

**Decisiones tomadas para la proxima sesion:**
- Backend con Node.js + Express (TypeScript en ambos lados)
- Google Gemini API (free tier) para sugerencias de plantas segun la ruta
- Pl@ntNet API (gratuita) para reconocimiento de plantas desde fotos

### Sesion 1 (parte final) - 2026-02-22: Servicios, DI, estado compartido y localStorage

**Lo que hicimos:**
- Creamos `PlantService` para separar la logica de datos del componente (como @Service en Spring)
- Creamos `CollectionService` con estado compartido entre paginas via signals
- Creamos `CollectionPage` (`/collection`) para ver las plantas encontradas
- Creamos el modelo `FoundPlant` (composicion: contiene un `Plant` + fecha + ruta)
- Anadimos persistencia con `localStorage` (los datos sobreviven al cerrar el navegador)
- Anadimos boton "La he encontrado!" en cada planta de RoutePage
- Anadimos boton de borrar (x) en cada planta de CollectionPage
- Anadimos botones "Volver al inicio" en RoutePage y CollectionPage
- Desactivamos el boton "La he encontrado!" si la planta ya esta en la coleccion
- El alumno escribio su primer codigo: el metodo `removePlant` y el boton delete en el template

**Conceptos clave aprendidos:**

*Inyeccion de dependencias:*
- `@Injectable({ providedIn: 'root' })` = como `@Service` + singleton en Spring
- `inject(PlantService)` = como `@Autowired` en Spring
- Un componente puede inyectar varios servicios
- La logica de negocio va en el servicio, no en el componente (misma regla que Controller/Service en Spring)

*Estado compartido via servicios:*
- Un servicio singleton con signals permite compartir datos entre componentes
- `getCollection()` devuelve el signal (no el valor) para mantener la reactividad
- RoutePage y CollectionPage comparten la misma instancia de CollectionService

*Interfaces TypeScript (como DTOs/Records de Java):*
- `interface Plant { ... }` define la forma de un objeto
- No existe en tiempo de ejecucion (solo ayuda al compilador)
- Composicion `FoundPlant { plant: Plant }` en vez de herencia

*Metodos de arrays (como Java Streams):*
- `.some()` = `Stream.anyMatch()` (devuelve true si algun elemento cumple la condicion)
- `.filter()` = `Stream.filter()` (devuelve nuevo array con los que cumplen la condicion)
- `[...list, item]` (spread) = crear nuevo array con todos los existentes + uno nuevo

*localStorage (almacenamiento del navegador):*
- `localStorage.setItem(key, value)` = guardar (solo strings)
- `localStorage.getItem(key)` = leer
- `JSON.stringify()` = objeto → string JSON (como Jackson ObjectMapper.writeValueAsString)
- `JSON.parse()` = string JSON → objeto (como Jackson ObjectMapper.readValue)

*Atajos de JavaScript:*
- `{ plant }` = `{ plant: plant }` (shorthand cuando propiedad y variable se llaman igual)
- `` `texto ${variable}` `` = template literal (como String.format en Java, pero con backticks)
- `&times;` = entidad HTML para el simbolo x

*CSS nuevo:*
- `position: relative` en padre + `position: absolute` en hijo = posicionar en una esquina
- `.clase1.clase2` = selector con dos clases (elemento que tiene AMBAS clases)

### Sesion 2 - 2026-02-23: Backend Node.js, Gemini API, Wikipedia y refactoring

**Lo que hicimos:**
- Creamos el backend completo en `server/` con Node.js + Express + TypeScript
- Instalamos dependencias: express, cors, dotenv, @google/generative-ai, typescript, tsx
- Creamos `server/src/index.ts` con endpoint POST `/api/plants/suggest`
- Integramos Google Gemini API para sugerencias de plantas reales
- Creamos fichero `.env` con `GEMINI_API_KEY` y `PORT`
- Actualizado `.gitignore` para excluir `.env`, `server/node_modules`, `server/dist`
- Conectamos Angular frontend con backend: anadimos `provideHttpClient()` en app.config.ts
- Modificamos `PlantService` para llamar al backend real (ya no usa datos mock)
- Anadimos estados de loading y error en RoutePage
- Resolvimos problema de URLs de imagenes falsas generadas por Gemini
- Anadimos funcion `getWikipediaImage()` para buscar imagenes reales en Wikipedia
- Refactorizamos `server/src/index.ts`: extrajimos funciones privadas del handler largo
- Discutimos persistencia: localStorage vs base de datos real
- Decidimos usar PostgreSQL + Prisma (ORM) con Docker/Rancher Desktop
- Alumno instalando Rancher Desktop (requiere reinicio)

**Conceptos clave aprendidos:**

*Backend Node.js + Express:*
- Express es como Spring Boot pero minimalista
- `app.post('/ruta', handler)` = `@PostMapping("/ruta")`
- `req.body` = `@RequestBody` (cuerpo de la peticion)
- `res.json(data)` = `ResponseEntity.ok(data)` (respuesta JSON)
- `res.status(400).json(...)` = `ResponseEntity.badRequest()`
- Middleware (`app.use(cors())`, `app.use(express.json())`) = filtros de Spring
- `dotenv.config()` = cargar variables de entorno (como application.properties)

*Programacion asincrona en profundidad:*
- JavaScript es single-threaded (un solo hilo) por diseno historico (1995, navegador)
- `async` marca una funcion que PUEDE esperar cosas
- `await` dice "espera aqui pero deja que otros trabajen mientras tanto"
- No es multithreading: es como una carniceria con un solo carnicero que atiende por turnos
- `Promise.all([...])` = ejecutar multiples promesas EN PARALELO
- `try/catch/finally` funciona igual que en Java para manejar errores async

*Refactoring en TypeScript/Node.js:*
- No hay `private methods` como en Java (no estamos en una clase)
- Funciones sin `export` = privadas al modulo (nadie fuera del fichero puede usarlas)
- Un fichero = un modulo (equivalente a una clase en Java para encapsulacion)
- Estructura recomendada: imports → funciones privadas → route handlers → arranque

*Persistencia - opciones:*
- `localStorage` = almacenamiento del navegador, NO es una base de datos real
  - ~5-10 MB, no se envia al servidor, el usuario puede borrarlo
  - Similar a cookies pero mas grande y sin envio automatico
- SQLite = base de datos en un fichero, cabe en un movil (lo usan WhatsApp, Instagram)
- PostgreSQL = base de datos real en servidor (lo que ya conoces de Java)
- Prisma = ORM para TypeScript, equivalente a Hibernate/JPA
  - `schema.prisma` = como las `@Entity` de JPA
  - `prisma.model.findMany()` = `repository.findAll()`
  - `prisma.model.create({ data })` = `repository.save(entity)`
  - `prisma.model.delete({ where })` = `repository.deleteById(id)`
- Docker/Rancher Desktop = para correr PostgreSQL en local sin instalarlo en la maquina

*Wikipedia API:*
- `https://en.wikipedia.org/api/rest_v1/page/summary/{nombre}` = buscar info de una pagina
- Devuelve un JSON con `thumbnail.source` = URL de la imagen principal
- `encodeURIComponent()` = codificar caracteres especiales para URLs (como URLEncoder en Java)
- `data.thumbnail?.source` = optional chaining, si thumbnail es null/undefined, devuelve undefined

### Sesion 2 (continuacion) - 2026-02-23: Docker, PostgreSQL, Prisma y refactoring backend

**Lo que hicimos:**
- Instalamos Rancher Desktop (Docker) para correr contenedores
- Creamos `docker-compose.yml` con PostgreSQL 17
- Instalamos y configuramos Prisma 7 (ORM) con adapter para PostgreSQL
- Creamos modelo `FoundPlant` en `schema.prisma` (como @Entity en JPA)
- Ejecutamos primera migracion (`prisma migrate dev --name init`)
- Creamos endpoints CRUD: GET, POST, DELETE para `/api/collection`
- Refactorizamos el backend en ficheros separados:
  - `index.ts` → solo setup y arranque (como Application.java)
  - `routes/plant.routes.ts` → controlador de plantas
  - `routes/collection.routes.ts` → controlador de coleccion
  - `services/plant.service.ts` → logica de Gemini + Wikipedia
- Conectamos Angular frontend con los nuevos endpoints de coleccion
- Cambiamos modelo `FoundPlant` de estructura anidada a plana (como la tabla)
- Migramos `CollectionService` de localStorage a HTTP calls
- Anadimos `ngOnInit` para cargar datos del backend al abrir la pagina
- Resolvimos bug: Gemini API key vacia por orden de ejecucion de modulos (dotenv)

**Conceptos clave aprendidos:**

*Docker / Docker Compose:*
- `docker-compose.yml` = define servicios de infraestructura (bases de datos, caches, etc.)
- `docker compose up -d` = arranca todo en background
- `docker compose down` = para todo
- `volumes` = persistir datos del contenedor en disco (sobrevive reinicios)
- `ports: "5432:5432"` = exponer puerto del contenedor al host

*Prisma (ORM, equivalente a JPA/Hibernate):*
- `schema.prisma` = como las clases @Entity en JPA
- `model FoundPlant { ... }` = define tabla + tipo TypeScript
- `@id @default(autoincrement())` = como @Id @GeneratedValue(IDENTITY)
- `@default(now())` = como @CreationTimestamp
- `@@map("found_plants")` = como @Table(name = "found_plants")
- `prisma migrate dev` = genera y ejecuta SQL (como Flyway/Liquibase)
- `prisma generate` = genera el cliente TypeScript (como metamodelo JPA)
- Prisma 7 usa "adapters" para conectar (PrismaPg para PostgreSQL)

*Refactoring backend (estructura de proyecto):*
- `index.ts` = Application.java (solo setup + arranque)
- `routes/*.routes.ts` = @RestController (maneja HTTP)
- `services/*.service.ts` = @Service (logica de negocio)
- `generated/prisma/` = codigo generado por Prisma (como metamodelo JPA)
- Express `Router()` = mini controlador, se monta con `app.use('/prefix', router)`
- Inyeccion manual: `collectionRouter(prisma)` = pasar dependencia como parametro

*Orden de ejecucion en Node.js:*
- Los imports se ejecutan ANTES que el codigo del fichero
- `dotenv.config()` debe ejecutarse ANTES de usar `process.env`
- Solucion: no inicializar servicios a nivel de modulo, usar funcion `init()`
- En Spring no pasa porque el contenedor DI resuelve el orden automaticamente

*Angular - ngOnInit:*
- `ngOnInit()` = como @PostConstruct en Spring
- Se ejecuta despues de crear el componente
- Lugar ideal para cargar datos del backend
- Implementar interface `OnInit` para usarlo

*Modelo plano vs anidado:*
- Antes: `FoundPlant { plant: Plant; ... }` (composicion, para localStorage)
- Ahora: `FoundPlant { id, commonName, ... }` (plano, refleja la tabla SQL)
- `track found.id` en vez de `track found.foundAt + found.plant.scientificName`
- Borrar por `id` (PK) en vez de por `scientificName`

*Signal como cache local:*
- El signal vive en RAM del navegador (rapido para la UI)
- PostgreSQL es la fuente de verdad (persistente)
- Al cargar pagina: GET backend → signal.set(datos)
- Al anadir: POST backend → recargar signal
- Al borrar: DELETE backend → actualizar signal localmente
