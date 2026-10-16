# Especificación Técnica: Simulador / Cotizador de Préstamos (Sesión 1)

## 1. Objetivo
Implementar un módulo de Simulación/Cotización de Préstamos en Mifos X Web App que calcule y visualice el calendario de pagos exacto usando el motor nativo de Apache Fineract (`POST /loans?command=calculateLoanSchedule`), cumpliendo `AGENTS.md` y `skills/SKILL.md`.

## 2. Ubicación, Enrutamiento y Resolver
- **Módulo anfitrión:** `src/app/loans/loans.module.ts` y `src/app/loans/loans-routing.module.ts`.
- **Ruta objetivo:** `/loans/simulator`.
- **Directorio del componente:** `src/app/loans/loan-simulator/`.
- **Configuración de entorno:** Agregar `defaultSimulatorClientId: 1` en `src/environments/environment.ts` y `src/environments/environment.prod.ts`.
- **Precarga con Route Resolver (Regla Sección 4 de `skills/SKILL.md`):**
  - No cargar el catálogo inicial de productos mediante llamadas HTTP pesadas dentro de `ngOnInit`.
  - Crear o reutilizar un Resolver en la ruta `/loans/simulator` (por ejemplo, `LoanSimulatorTemplateResolver` o reutilizar el resolver de productos existente en `src/app/loans/` o `src/app/products/`) que obtenga la lista de productos de préstamo (`GET /loanproducts` o `GET /loans/template?templateType=individual&clientId={defaultSimulatorClientId}`) y la entregue al componente vía `ActivatedRoute.data`.

## 3. Flujo Reactivo e Integración con Apache Fineract
Todo el formulario debe construirse inyectando `FormBuilder` en el `constructor` (Regla Sección 2 de `skills/SKILL.md`):

### Paso A: Selección de Producto y Autocompletado
Cuando el usuario cambia el `productId` en `<mat-select>`:
1. Determinar `effectiveClientId`: usar el `clientId` ingresado por el usuario o, si está vacío, `environment.defaultSimulatorClientId`.
2. Invocar `loansService.getLoanAccountTemplate(effectiveClientId, productId)` (`GET /loans/template?clientId={effectiveClientId}&productId={productId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`).
3. Actualizar con `patchValue` los controles del `FormGroup` con los valores por defecto del producto (`principal`, `numberOfRepayments`, `repaymentEvery`, `repaymentFrequencyType`, `interestRatePerPeriod`, `amortizationType`, `interestType`, `interestCalculationPeriodType`).

### Paso B: Construcción del Payload para `calculateLoanSchedule`
Al enviar el formulario, invocar `loansService.calculateLoanSchedule(payload)` (`POST /loans?command=calculateLoanSchedule`):
- Calcular `loanTermFrequency = numberOfRepayments * repaymentEvery`.
- Asignar `loanTermFrequencyType = repaymentFrequencyType`.
- Formatear `submittedOnDate` y `expectedDisbursementDate` usando `Dates` / `moment` con `settingsService.dateFormat` y `settingsService.language.code`.
- Incluir dinámicamente `transactionProcessingStrategyCode` o `transactionProcessingStrategyId` según cuál propiedad venga presente en la plantilla del producto.

## 4. Estructura Visual (Reglas Sección 1 y 3 de `skills/SKILL.md`)
- Usar exclusivamente componentes de Angular Material (`<mat-card>`, `<mat-form-field appearance="fill">`, `<mat-select>`, `<mat-table>`, `<button mat-raised-button>`).
- Espaciado basado estrictamente en el sistema de grilla de 8px mediante clases utilitarias (`class="m-b-16"`, `class="m-t-16"`). Prohibido usar medidas arbitrarias como `10px` o `15px`.
- Mostrar resumen en `<mat-card>` (`totalPrincipalDisbursed`, `totalInterestCharged`, `totalFeeChargesCharged`, `totalRepaymentExpected`) y el detalle de cuotas (`periods`) en `<mat-table>` siguiendo el esquema de `src/app/loans/loans-account-stepper/loans-account-schedule-step/`.
- Usar el pipe `| translate` con la convención de llaves del proyecto (`labels.inputs.*`, `labels.heading.*`, `labels.buttons.*`) y ejecutar `npm run translations:extract`.
- Ejecutar `npm run headers:add` y `npm run headers:check` para garantizar la cabecera MPL-2.0 en todos los archivos nuevos.
