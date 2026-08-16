# Contexto del proyecto

## Proposito

Frontend administrativo para gestionar transferencias interbancarias, depositos entrantes, cuentas, gastos bancarios, compensacion/reconciliacion, usuarios administrativos y notificaciones en tiempo real.

## Stack y herramientas

- React 19 con Vite 7.
- Axios para HTTP.
- TanStack Query para cache y estado remoto.
- SignalR para actualizaciones en tiempo real.
- Tesseract/OCR para validar comprobantes de transferencias.
- Tailwind CSS para estilos.
- Dependencias y scripts de Capacitor/Tauri identificados en `package.json`.

## Entrada de aplicacion

La aplicacion inicia en `src/main.jsx` con `StrictMode`, `QueryClientProvider`, `AuthProvider`, `NotificationProvider` y `App`.

La navegacion principal esta implementada en `src/App.jsx` mediante pestanas, no mediante un router identificado. Las pestanas revisadas incluyen interbank, bank-inbound, register-user, account-book, bank-expenses y compensation.

## Autenticacion y autorizacion

`src/context/AuthContext.jsx` administra el estado de autenticacion, normalizacion de token, decodificacion JWT, expiracion, logout e interceptores de Axios.

Claves de `localStorage` identificadas:

- `interbank-admin-auth`
- `interbank-admin-session-id`

Roles identificados en la navegacion de `src/App.jsx`:

- `admin`
- `superadmin`
- `desarrollador`

Roles identificados en opciones de registro de `src/pages/RegisterUser.jsx`:

- `Admin`
- `SuperAdmin`
- `Desarrollador`

La pestana de usuarios esta restringida en la navegacion a `superadmin` y `desarrollador`.

## Configuracion de API y entorno

Valores revisados en `.env`:

- `VITE_BASE_API_URL=https://red.coophispanica.com/api/v1`
- `VITE_AUTH_API_URL=https://red.coophispanica.com`
- `VITE_AUTH_API_PATH=/api/Authentication`
- `VITE_AUTH_PROXY_PATH=/auth-api`
- `VITE_TRANSFER_HUB_URL=https://red.coophispanica.com/transfer`

`src/lib/axiosInstance.js` define la instancia central de Axios. Los interceptores se configuran desde `src/context/AuthContext.jsx`.

`src/utils/api.js` contiene helpers de URL base, URL de autenticacion y URL del hub. `vite.config.js` contiene configuracion de proxy para autenticacion.

## TanStack Query

`src/lib/queryClient.js` configura valores por defecto revisados:

- `retry: 0`
- `staleTime: Infinity`
- `gcTime: Infinity`
- sin refetch automatico al enfocar ventana
- sin refetch automatico al reconectar

## Modulos funcionales

### Transferencias interbancarias salientes

Archivos principales revisados:

- `src/pages/InterbankDashboard.jsx`
- `src/modules/interbank/queries/useInterbankTransfers.js`
- `src/utils/interbank.js`
- `src/components/interbank/InterbankList.jsx`
- `src/components/interbank/ConfirmTransferModal.jsx`
- `src/components/interbank/CancelTransferModal.jsx`

`useInterbankTransfers.js` consulta `GET /InterBank/Transactions`. La paginacion se realiza internamente con `API_PAGE_SIZE=200` y `MAX_API_PAGES=100`, y luego se aplican filtros locales.

`InterbankDashboard.jsx` incluye filtros, filtros rapidos, resumen, listado, paginacion y modales para confirmar o cancelar transferencias.

`src/utils/interbank.js` contiene datos fallback, normalizacion y derivacion de estados a partir de booleanos como `isSubmit` e `isCancelled`.

`ConfirmTransferModal.jsx` usa OCR, seleccion de cuenta y validacion de monto hasta centavos. Se identifico `OCR_MIN_CONFIDENCE=70`.

`CancelTransferModal.jsx` incluye razones de cancelacion, incluida `Transferencia duplicada`.

`InterbankList.jsx` muestra imagenes mediante `/InterBank/image-socio?imageUrl=`.

### Depositos entrantes bancarios

Archivos principales revisados:

- `src/pages/BankInboundPage.jsx`
- `src/services/bankInbound.service.js`
- `src/modules/bankInbound/queries/useBankInbound.js`
- `src/components/bankInbound/BankInboundTable.jsx`

`BankInboundPage.jsx` incluye filtros rapidos `PENDIENTE`, `CONFIRMADO` y `CANCELADO`, ademas de modal de accion para confirmar o cancelar.

`bankInbound.service.js` consulta `GET /BankInbound` con parametros revisados: `PageNumber`, `PageSize`, `NameBank`, `SocioId`, `Amount`, `IsConfirm`, `UpdatedBy`, `CreatedAt` y `UpdatedAt`.

`useBankInbound.js` actualiza estado con `PATCH /BankInbound` mediante `updateBankInboundStatus`. El payload revisado incluye `id`, `isConfirm`, `updatedBy`, `updatedAt`, `comentario` y `recibo`.

`BankInboundTable.jsx` define estados `PENDIENTE`, `CONFIRMADO` y `CANCELADO`, y muestra imagenes mediante `/BankInbound/image-socio?imageUrl=`.

### Libro de cuentas

Archivos principales revisados:

- `src/pages/AccountBookPage.jsx`
- `src/modules/accountBook/queries/useAccountBook.js`

`AccountBookPage.jsx` usa fecha seleccionada, historiales, cuentas bancarias/admin y modal para crear cuenta corporativa.

Endpoints revisados en `useAccountBook.js`:

- `GET /Cuentas/banco-reservas`
- `GET /Cuentas/admin/inter-externa`
- `GET /InterBank/Sumatoria`
- `POST /Cuentas/corporativa`

### Compensacion y reconciliacion

Archivos principales revisados:

- `src/pages/CompensationPage.jsx`
- `src/modules/compensation/queries/useReconciliationBatches.js`

Estados de lote revisados:

- `COMPLETED`
- `OPEN`
- `PROCESSING`
- `FAILED`

Estados de item revisados:

- `MATCH`
- `MISMATCH`
- `PENDING`

`useReconciliationBatches.js` consulta `GET /InterBank/reconciliation-batches` con parametros `limit`, `batchId` y `businessDate`.

### Gastos bancarios

Archivos principales revisados:

- `src/pages/BankExpensesPage.jsx`
- `src/modules/bankExpenses/queries/useBankExpenses.js`

`BankExpensesPage.jsx` normaliza payloads de gastos con multiples formas posibles, usa cuentas bancarias y presenta UI para crear y eliminar gastos.

Endpoints revisados en `useBankExpenses.js`:

- `GET /GastoBancario`
- `POST /GastoBancario`
- `DELETE /GastoBancario/{id}` con `notaDeleted`

### Usuarios administrativos

Archivos principales revisados:

- `src/pages/RegisterUser.jsx`
- `src/modules/users/queries/useUsers.js`

Endpoints revisados en `useUsers.js`:

- `/list-admin-user`
- `/register`
- mutaciones de rol, estado y contrasena

### Autenticacion

Archivo principal revisado:

- `src/modules/auth/queries/useAuthMutations.js`

`useAuthMutations.js` realiza peticiones directas con `axios.post` hacia la URL base de autenticacion, incluyendo flujos de login, forgot-password y reset-password.

### Historial de transacciones

Archivos principales revisados:

- `src/pages/TransactionHistorial.jsx`
- `src/modules/transactions/queries/useTransactions.js`

`TransactionHistorial.jsx` existe con filtros, `TARGET_TRANSACTION_TYPE=5` y `TARGET_ACCOUNT_NUMBER='INTER-BANCARIO-001'`.

`useTransactions.js` consulta `GET /HistorialTransacciones/listar`.

No se identifico referencia de `TransactionHistorial.jsx` desde `src/App.jsx` ni en la navegacion revisada.

## Tiempo real y notificaciones

Archivos principales revisados:

- `src/services/signalR.service.js`
- `src/context/NotificationContext.jsx`

`signalR.service.js` usa `HubConnectionBuilder`, actualiza caches de transacciones, cuentas y transferencias interbancarias, y mantiene `cachedToken` y `startingPromise`.

`NotificationContext.jsx` persiste notificaciones en `localStorage` con la clave `interbank-admin-notifications` y define `MAX_NOTIFICATIONS=50`.

## Formatos y localizacion

`src/utils/transactions.js` usa `Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })` para montos en pesos dominicanos. Tambien contiene helpers de fecha/hora, normalizacion de transacciones y datos fallback.

## Riesgos y observaciones tecnicas identificadas

- Inconsistencia de casing en roles: la navegacion usa `admin`, `superadmin`, `desarrollador`, mientras que el registro y algunas comprobaciones usan `Admin`, `SuperAdmin`, `Desarrollador`.
- `src/hooks/useFetch.jsx` referencia `axios.isCancel` sin importar `axios`.
- `src/services/ocr.service.js` contiene `console.log`, `console.warn` y `console.error` relacionados con el flujo OCR, texto crudo y resultados.
- El hook de temporizador de inactividad existe, pero su uso revisado en `src/App.jsx` aparenta estar deshabilitado mediante timeout nulo.
- En depositos entrantes se identifico riesgo en la logica de siguiente pagina si depende de longitud de pagina llena, sin total confirmado en el codigo revisado.

## Pruebas y calidad

No identificado en el codigo revisado.

## Build, despliegue e infraestructura

Scripts y dependencias de Vite, Capacitor y Tauri fueron identificados en `package.json`.

Configuracion especifica de despliegue productivo: No identificado en el codigo revisado.

## Convenciones de arquitectura

- Paginas en `src/pages` coordinan pantallas principales.
- Modulos en `src/modules/*/queries` encapsulan consultas y mutaciones por dominio.
- Servicios en `src/services` encapsulan integraciones como SignalR, OCR y algunos accesos HTTP.
- Utilidades en `src/utils` normalizan datos, URLs y formatos.
- Contextos en `src/context` administran autenticacion y notificaciones.

## Limites de lo documentado

Este documento refleja solo hechos confirmados en archivos revisados del repositorio. Donde no se encontro evidencia suficiente, se usa la frase requerida: No identificado en el codigo revisado.
