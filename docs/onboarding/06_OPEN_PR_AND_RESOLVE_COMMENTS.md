# 06. Open PR and Resolve Comments

## Paso 1. Preparar el PR

Antes de abrir el PR, ejecuta localmente:

```bash
npm run validate
npm run openspec:validate
```

Opcionalmente, pide una pre-revisión a Copilot:

```text
/review-pr
```

## Paso 2. Abrir el PR en GitHub

```bash
git push origin <tu-branch>
```

Luego en GitHub:

1. Ve al repo → Pull requests → New pull request.
2. Selecciona tu branch como source y `main` como target.
3. Usa un título descriptivo con el Jira key: `feat(orders): add checkout endpoint [PROJ-123]`.

## Paso 3. Completar el PR template

El repo incluye un PR template. Complétalo por entero:

| Campo          | Qué poner                                 |
| -------------- | ----------------------------------------- |
| Jira           | Link al ticket                            |
| OpenSpec       | Link o referencia al change ID            |
| Qué cambió     | Resumen de los cambios                    |
| Riesgo         | low / medium / high y justificación       |
| Rollback       | Cómo revertir si sale mal                 |
| Contratos      | Qué cambió en OpenAPI/GraphQL (si aplica) |
| Evidencia      | Screenshots, logs, test output            |
| Docs/Storybook | Qué docs se actualizaron                  |

## Paso 4. Revisar labels automáticos

El workflow `risk-gate.yml` agrega un label de riesgo automáticamente:

- `risk:low` — cambio menor, sin impacto en datos ni contratos
- `risk:medium` — toca lógica de negocio o contratos (additive)
- `risk:high` — toca auth, permisos, PII, contratos (breaking), pagos, infra

Si el label no aparece, revisa `docs/onboarding/TROUBLESHOOTING.md`.

## Paso 5. Revisar comentarios de Qodo / Copilot

Los bots de revisión pueden dejar comentarios automáticos. Clasifica cada uno:

| Tipo              | Acción                                 |
| ----------------- | -------------------------------------- |
| Bug real          | Corregir                               |
| Mejora de calidad | Evaluar y aplicar si tiene sentido     |
| Seguridad         | Corregir siempre                       |
| Contrato          | Verificar contra spec                  |
| Observabilidad    | Agregar si falta tracing/logs          |
| Falso positivo    | Responder explicando por qué no aplica |

## Paso 6. Corregir y hacer push

Corrige lo que aplique, luego:

```bash
npm run validate
git add -A && git commit -m "fix(orders): address review comments"
git push
```

## Paso 7. Si un comentario se repite

No solo corrijas — actualiza la fuente para que no vuelva a pasar:

- Regla técnica → `docs/standards/`
- Patrón de implementación → skill en `.github/skills/`
- Instrucción para agente → agent en `.github/agents/`
- Template → `openspec/templates/`
- Procedimiento → runbook en `docs/runbooks/`

## Paso 8. Esperar checks

Confirma que todos los checks de CI pasan en verde. Si alguno falla:

- lee el log del workflow
- revisa `docs/onboarding/TROUBLESHOOTING.md`
- corrige y haz push de nuevo

## Paso 9. Antes de pedir merge

Confirma:

- [ ] Todos los comentarios resueltos
- [ ] Checks en verde
- [ ] Approvals requeridos obtenidos
- [ ] Risk label correcto
- [ ] Rollback definido en el PR

## Uso de `pr-comment-resolver`

Si el feedback de PR es abundante, cruzado o repetitivo, usa el agente `pr-comment-resolver`:

```text
@pr-comment-resolver hay 12 comentarios en el PR, clasifícalos y propón correcciones
```

Ver `docs/runbooks/QODO_COPILOT_COMMENT_FLOW.md` para el flujo completo.
