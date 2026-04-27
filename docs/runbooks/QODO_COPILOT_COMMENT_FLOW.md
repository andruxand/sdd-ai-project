# Qodo / Copilot Comment Flow

## Cuándo aplica este runbook

Cuando tu PR recibe comentarios automáticos de Qodo, Copilot, o cualquier bot de revisión.

## Flujo paso a paso

### 1. Leer y clasificar cada comentario

| Categoría      | Ejemplo                                       | Acción                                                         |
| -------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Bug real       | "Este null check no cubre el caso X"          | Corregir siempre                                               |
| Calidad        | "Extraer esta lógica a una función separada"  | Evaluar — corregir si mejora legibilidad o mantenibilidad      |
| Seguridad      | "Este campo expone PII en el log"             | Corregir siempre                                               |
| Contrato       | "Este campo no está en el schema"             | Verificar contra `packages/contracts/` — corregir si hay drift |
| Observabilidad | "Falta tracing en este endpoint"              | Agregar si la función es pública o crítica                     |
| Falso positivo | "No debería usar any" (pero es un type guard) | Responder explicando por qué no aplica                         |

### 2. Corregir

Haz los cambios necesarios y ejecuta:

```bash
npm run validate
```

### 3. Convertir la corrección en conocimiento permanente

**Si el comentario es sobre el uso de una librería o paquete específico** → actualizar el skill de ese paquete **inmediatamente** (sin esperar una segunda ocurrencia):

1. Buscar el skill del paquete: `ls .github/skills/ | grep -i <nombre-del-paquete>`
2. Si existe: agregar una entrada en `## Anti-patterns — from PR feedback`.
3. Si no existe: crear un stub con el protocolo de `dependency-vetting` sección 7.
4. Registrar en `docs/runbooks/AI_FEEDBACK_LOG.md`.

**Si el comentario es sobre una convención general** (arquitectura, naming, tests) → actualizar la fuente cuando aparezca **2+ veces** en PRs distintos:

| El problema es...              | Actualiza...                     |
| ------------------------------ | -------------------------------- |
| Una regla técnica que falta    | `docs/standards/`                |
| Un patrón de implementación    | `SKILL.md` en `.github/skills/`  |
| Una instrucción para el agente | `.agent.md` en `.github/agents/` |
| Un step recurrente             | Prompt en `.github/prompts/`     |
| Un procedimiento de equipo     | Runbook en `docs/runbooks/`      |

### 4. Responder en el PR

- Si corregiste: marca como "resolved"
- Si es falso positivo: responde con la justificación y marca como "resolved"
- Si aplazaste: agrega un TODO con ticket de follow-up

## `pr-comment-resolver`

Para PRs con muchos comentarios (>5) o feedback cruzado entre archivos, usa el agente `pr-comment-resolver`:

```text
@pr-comment-resolver clasifica los comentarios del PR y propón correcciones agrupadas
```

El agente:

1. Lee todos los comentarios
2. Los clasifica por categoría
3. Propone correcciones agrupadas por archivo
4. Sugiere qué standards/skills actualizar si hay patrones repetidos
