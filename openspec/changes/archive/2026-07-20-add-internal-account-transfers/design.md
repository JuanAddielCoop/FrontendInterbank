## Context

La aplicación concentra la operación administrativa en pestañas y el Libro de Cuentas ya carga cuentas corporativas, sumatorias e historial mediante TanStack Query. El nuevo flujo debe integrarse con esos patrones, reutilizar la instancia central de Axios y evitar duplicar la lógica de autenticación. El backend expone `POST /api/v1/Cuentas/transferencias-internas` y espera `numeroCuentaOrigen`, `numeroCuentaDestino`, `monto`, `observaciones` y `empleado`.

## Goals / Non-Goals

**Goals:**

- Hacer descubrible la operación desde Libro de Cuentas sin crear una nueva sección de navegación.
- Permitir seleccionar cuentas corporativas cargadas por el libro y completar la operación con confirmación clara.
- Mantener la mutación encapsulada en `src/modules/accountBook/queries/useAccountBook.js`.
- Invalidar las consultas de cuentas y del resumen/historial después del éxito para mostrar saldos y movimientos actualizados.
- Proporcionar validaciones de monto, cuentas distintas, campos obligatorios y estados de carga/error.

**Non-Goals:**

- No modificar el endpoint ni el contrato del backend.
- No implementar transferencias interbancarias, aprobaciones, reversos ni programación futura.
- No agregar una nueva ruta o pestaña global.
- No resolver reglas financieras que el backend no documenta, como límites de saldo o permisos adicionales.

## Decisions

### Integración de la mutación

Se agregará una mutación TanStack Query junto a las operaciones existentes del módulo accountBook. La mutación hará `POST` con el payload exacto del contrato y, tras una respuesta exitosa, invalidará las claves de cuentas, sumatoria y consultas relacionadas del libro. Esto mantiene el cache consistente y evita actualizar saldos localmente con cálculos potencialmente distintos a los del backend.

Alternativa descartada: llamar Axios directamente desde `AccountBookPage.jsx`, porque rompería la separación existente entre página y consultas y dificultaría la invalidación coordinada.

### Ubicación y presentación del formulario

Se agregará un botón de acción en el encabezado de la tarjeta de cuentas corporativas y un modal/diálogo reutilizando los patrones visuales y de portal ya presentes en `AccountBookPage.jsx`. Los campos de origen y destino usarán las cuentas corporativas disponibles; observaciones será opcional y el monto será numérico con precisión de centavos.

Alternativa descartada: una pestaña independiente, porque la operación pertenece al contexto de libros de cuentas y la navegación principal no usa router.

### Identidad del empleado

El formulario no pedirá manualmente el empleado. La implementación tomará el identificador numérico disponible en la identidad autenticada o en sus claims y lo enviará como `empleado`. Si el frontend no dispone de un claim numérico compatible, la tarea deberá dejar explícito el bloqueo en lugar de enviar un valor inventado.

### Validación y feedback

Antes de enviar se exigirá origen, destino y monto positivo; origen y destino no podrán ser iguales. El modal se bloqueará durante el envío, mostrará el mensaje de error del backend cuando exista y, tras éxito, se cerrará y mostrará una confirmación con las cuentas y el monto. La respuesta se usará para presentar el estado de la transacción cuando sea necesario, mientras las consultas invalidadas serán la fuente de saldos actualizados.

## Risks / Trade-offs

- [El claim de empleado puede no existir o no ser numérico] → Inspeccionar `AuthContext` y documentar el mapeo; bloquear el envío con un error accionable si falta.
- [La clave exacta de las consultas del libro puede variar] → Reutilizar las claves definidas por `useAccountBook.js` y probar la invalidación después de la mutación.
- [El endpoint puede devolver errores de validación con formatos distintos] → Normalizar el mensaje usando el patrón de errores existente sin ocultar la respuesta del servidor.
- [El historial actual combina únicamente entradas y transferencias interbancarias] → Incorporar la transferencia interna mediante el contrato de respuesta o la fuente de historial disponible, sin atribuirla erróneamente a un banco externo.

## Migration Plan

No requiere migración de datos ni cambios de infraestructura. Se despliega el frontend con la nueva mutación y formulario; si el endpoint no está disponible, el botón seguirá mostrando el error del backend y no se alterarán los datos locales. El rollback consiste en retirar la acción y el hook nuevos del frontend.

## Open Questions

- Confirmar cuál claim del usuario autenticado contiene el entero esperado por `empleado`.
- Confirmar si el endpoint responde siempre con el objeto de transacción documentado o si el historial de cuentas internas se obtiene mediante un endpoint separado.
