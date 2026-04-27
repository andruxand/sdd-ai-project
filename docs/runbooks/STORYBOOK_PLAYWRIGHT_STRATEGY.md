# Storybook + Playwright Strategy

## Cuándo usar cada uno

| Herramienta    | Propósito                                                   | Cuándo aplica                                                              |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Storybook**  | Desarrollo y documentación de componentes UI en aislamiento | Siempre que el proyecto tenga frontend y el módulo `storybook` esté activo |
| **Playwright** | Tests end-to-end sobre la aplicación real en el navegador   | Siempre que el módulo `playwright` esté activo                             |

## Storybook

### Para qué sirve

- Catálogo visual de componentes
- Documentación interactiva de props y estados
- Tests de accesibilidad (a11y addon)
- Interaction tests (simulan clicks, inputs)
- Revisión visual antes de implementar en pages

### Estructura esperada

- Stories junto al componente: `Button.stories.tsx` al lado de `Button.tsx`
- Un story por estado relevante (default, loading, error, disabled, etc.)

### Cómo usarlo

```bash
# Iniciar Storybook
npm run storybook

# Build estático (para CI/deploy)
npm run build-storybook
```

### Cuándo agregar stories

- Cada componente compartido en `packages/shared/ui/`
- Componentes complejos en `apps/web/src/components/`
- Componentes con múltiples estados o props condicionales

### Agente y skill

- Agente: `@frontend-implementer` (crea stories como parte del feature)
- Skill: `storybook-component` — guía para crear stories correctos

## Playwright

### Para qué sirve

- Tests end-to-end (journeys de usuario completos)
- Smoke tests (la app carga, login funciona)
- Regression tests (features existentes no se rompen)
- Visual tests (opcional, con snapshots)

### Estructura esperada

- Tests en `apps/web/e2e/` o `tests/e2e/`
- Un archivo por journey o feature
- Page Object Model recomendado para pages complejas

### Cómo usarlo

```bash
# Instalar browsers (primera vez)
npx playwright install --with-deps

# Correr tests
npx playwright test

# Correr con UI
npx playwright test --ui

# Ver reporte
npx playwright show-report
```

### Cuándo agregar tests e2e

- Flujos críticos de usuario (login, checkout, onboarding)
- Features con múltiples pasos
- Integraciones con APIs externas
- Regresiones de bugs reportados

### Agente y skill

- Agente: `@e2e-tester`
- Skill: `playwright-e2e` — guía para crear tests Playwright correctos

## Relación entre ambos

| Nivel      | Herramienta | Qué valida                                            |
| ---------- | ----------- | ----------------------------------------------------- |
| Componente | Storybook   | El componente se ve y se comporta bien en aislamiento |
| Página     | Playwright  | El journey de usuario funciona de principio a fin     |

No son excluyentes. Un componente puede tener stories en Storybook (desarrollo) y también aparecer en un test e2e (validación integrada).
