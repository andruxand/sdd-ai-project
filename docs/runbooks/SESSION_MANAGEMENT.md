# Session Management and Token Optimization

Esta guía explica por qué y cómo gestionar sesiones de IA para optimizar el consumo de tokens y la calidad de las respuestas.

## Qué son los tokens

Los tokens son las unidades de texto que la IA procesa. Cada palabra, cada símbolo, cada espacio es uno o más tokens. Cuando interactúas con Copilot o Claude Code:

- **Cada mensaje tuyo** consume tokens
- **Cada respuesta del modelo** consume tokens
- **Cada archivo que el modelo lee** consume tokens
- **Todo el historial de la conversación** se envía en cada mensaje

Esto significa que en el mensaje número 50 de una sesión, el modelo está procesando TODO lo anterior: los 49 mensajes previos, todas las respuestas, todos los archivos leídos. Es como si cada vez fotocopiaras toda la conversación antes de agregar una línea más.

## Por qué las sesiones largas son un problema

En una sesión larga se acumula:

| Qué se acumula                 | Por qué es un problema                                 |
| ------------------------------ | ------------------------------------------------------ |
| Intentos fallidos              | El modelo puede repetir enfoques que ya no funcionaron |
| Archivos que ya no importan    | Ocupan espacio en la ventana de contexto               |
| Logs y stack traces viejos     | Confunden al modelo con errores ya resueltos           |
| Alternativas descartadas       | El modelo puede volver a sugerirlas                    |
| Preguntas y respuestas previas | Diluyen las instrucciones importantes                  |
| Razonamiento repetido          | El modelo re-hace análisis que ya hizo                 |

Esto causa:

- **Degradación de calidad**: el modelo empieza a olvidar reglas o inventar cosas
- **Costo alto**: de 80k a 200k tokens por feature en sesión monolítica
- **Imposibilidad de paralelizar**: todo está en una sola sesión

## El patrón correcto: sesiones cortas con handoff

### Lo que NO debes hacer

**Sesión monolítica** (todo en una sesión):

```
spec + implementación + errores + debug + pruebas + PR = 200k tokens
```

**Sesión vacía** (abrir nueva sin contexto):

```
Nueva sesión sin contexto = el modelo re-descubre todo = tiempo perdido
```

### Lo que SÍ debes hacer

**Sesiones cortas con handoff** (una fase por sesión):

```
Sesión 1: Spec (20k tokens) -> handoff (300 tokens)
Sesión 2: Implementación (25k tokens) -> handoff (300 tokens)
Sesión 3: Tests (15k tokens) -> handoff (300 tokens)
Sesión 4: Review + PR (10k tokens)
Total: ~70k tokens vs ~200k en sesión monolítica
```

## Cómo usar handoffs paso a paso

### Paso 1: Trabajar en una fase

Trabaja normalmente en tu sesión de chat con el agente correspondiente. Por ejemplo, con `@openspec` para generar proposal, design y tasks.

### Paso 2: Generar el handoff

Cuando termines la fase, ejecuta en Copilot Chat:

```text
/handoff
```

El agente generará un archivo `openspec/changes/{change-id}/handoff.md` con:

- Objetivo del cambio (1-2 oraciones)
- Qué se completó y qué queda pendiente
- Archivos tocados
- Riesgos abiertos
- Criterios de aceptación para la siguiente fase
- Decisiones tomadas (para no re-discutirlas)
- Notas para el siguiente agente

Este archivo típicamente tiene menos de 80 líneas y menos de 500 tokens. Compara eso con los 20,000+ tokens de historial de la sesión.

### Paso 3: Cerrar la sesión

Cierra el chat actual. Esto descarta todo el historial acumulado: los archivos leídos, los intentos fallidos, las alternativas descartadas.

### Paso 4: Abrir nueva sesión

Abre un chat nuevo y ejecuta:

```text
/resume-phase
```

El agente lee el handoff y te presenta un resumen con:

- Qué se completó en la fase anterior
- Qué está pendiente
- Qué agente debería ejecutar la siguiente tarea
- Plan de trabajo propuesto

Ahora puedes invocar al agente correcto para la siguiente fase.

## Cuándo cortar la sesión

### Señales de que debes cortar

| Señal                                                                  | Qué hacer                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| **Cambio de fase**: terminaste spec y vas a implementar                | `/handoff`, cerrar, abrir nueva con `/resume-phase` |
| **Cambio de stream**: terminaste backend y vas a frontend              | `/handoff`, cerrar, abrir nueva con `/resume-phase` |
| **Correcciones repetidas**: le corriges lo mismo 2+ veces              | Cerrar y reformular con un prompt mejor             |
| **Olvido de instrucciones**: el modelo no sigue reglas que ya le diste | Sesión degradada, cerrar con `/handoff`             |
| **Sugerencias recicladas**: el modelo sugiere algo que ya descartaron  | Contexto contaminado, cerrar                        |

### Cuándo mantener la sesión

| Situación                                    | Por qué mantener                        |
| -------------------------------------------- | --------------------------------------- |
| **Iteración rápida en la misma fase**        | El contexto acumulado es relevante      |
| **Debug activo con feedback loop corto**     | Perder el contexto del debug es peor    |
| **Conversación de intake/spec**              | La conversación ES el contexto          |
| **Cambio trivial** (typo, rename, 1 archivo) | No vale la pena el overhead del handoff |

## Qué contiene un handoff

El template vive en `openspec/templates/handoff.md` y tiene estas secciones:

- **Change ID, fecha, fase completada, fase siguiente**: metadatos de trazabilidad
- **Objetivo del cambio**: 1-2 oraciones de qué se está haciendo
- **Alcance**: streams, archivos tocados, archivos relacionados
- **Estado actual**: completado, en progreso, pendiente, bloqueado
- **Riesgos abiertos**: lo que sigue vigente
- **Criterios de aceptación relevantes**: solo los que aplican a la siguiente fase
- **Cómo validar**: tests, comandos, verificación manual
- **Decisiones tomadas**: para evitar re-discusiones
- **Notas para el siguiente agente**: contexto informal pero importante

## Modelo recomendado por fase

No todas las fases requieren el mismo modelo. Usar un modelo más ligero cuando es suficiente ahorra tokens.

| Fase              | Modelo recomendado | Por qué                              |
| ----------------- | ------------------ | ------------------------------------ |
| Intake / Proposal | Sonnet / GPT-4o    | Conversacional, scope claro          |
| Design            | Opus / o1          | Decisiones arquitectónicas complejas |
| Implementation    | Sonnet / GPT-4o    | Alto volumen, sigue patrones         |
| Testing           | Sonnet / GPT-4o    | Mecánico, basado en patrones         |
| Security review   | Opus / o1          | Razonamiento adversarial             |
| PR review         | Sonnet / GPT-4o    | Sesión limpia, sin bias              |

## Tips adicionales para ahorrar tokens

### En VS Code + Copilot

- Usa `@file` para referenciar archivos en vez de pegar su contenido
- Sé específico en tus prompts: "agrega validación de email en `src/auth/login.ts`" consume menos que "mejora la autenticación"
- Usa los agentes especializados: saben qué archivos leer sin que se lo digas

### En Claude Code

- Usa `/compact Focus on modified files and test results` cuando el contexto crezca
- Usa `/clear` entre tareas no relacionadas
- Nombra sesiones con `/rename` usando el patrón `{change-id}-{phase}`
- Retoma sesiones con `claude --resume`
- Delega investigación de archivos a subagentes para no contaminar tu contexto principal

### General

- No pegues logs completos. Filtra antes: solo la línea del error y 5-10 líneas de contexto
- No pegues archivos enteros si solo importa una función
- Si el modelo necesita entender un patrón, refiérele a un ejemplo existente en vez de describir el patrón desde cero

## Relación con el flujo SDD

El handoff conecta cada fase del flujo de agentes. Cada flecha es una sesión nueva de chat:

**backend-only:**

```
@openspec (spec)
  --handoff--> @contracts-implementer (contratos, si aplica)
  --handoff--> @backend-implementer (implementación)
  --handoff--> @observability-implementer (logs/tracing, si aplica)
  --handoff--> @tester-backend (tests)
  --handoff--> @security (solo si risk=high)
  --handoff--> @reviewer (PR)
  --handoff--> @pr-comment-resolver (solo si hay feedback)
```

**frontend-only:**

```
@openspec (spec)
  --handoff--> @frontend-implementer (implementación)
  --handoff--> @tester-frontend (tests)
  --handoff--> @e2e-tester (journeys, si aplica)
  --handoff--> @reviewer (PR)
  --handoff--> @pr-comment-resolver (solo si hay feedback)
```

**fullstack:**

```
@openspec (spec)
  --handoff--> @contracts-implementer
  --handoff--> @backend-implementer
  --handoff--> @frontend-implementer
  --handoff--> @observability-implementer
  --handoff--> @tester-backend
  --handoff--> @tester-frontend
  --handoff--> @e2e-tester
  --handoff--> @security (solo si risk=high)
  --handoff--> @reviewer
  --handoff--> @pr-comment-resolver (solo si hay feedback)
```

Cada handoff es un archivo de 300-500 tokens que reemplaza 15,000-50,000 tokens de historial.

Los exit checklists de cada agente incluyen la generación de handoff como último paso cuando la fase se completa.
