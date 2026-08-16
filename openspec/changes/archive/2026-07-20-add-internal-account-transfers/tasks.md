## 1. API y estado remoto

- [x] 1.1 `src/modules/accountBook/queries/useAccountBook.js`: agregar la función de POST y el hook `useCreateInternalAccountTransfer` con el contrato de `/Cuentas/transferencias-internas` - expect la mutación devuelva la respuesta del backend y use la autenticación central
- [x] 1.2 `src/modules/accountBook/queries/useAccountBook.js`: invalidar cuentas corporativas, sumatoria e historial relacionado al completar la mutación - expect los saldos y movimientos se vuelvan a consultar después del éxito
- [x] 1.3 `src/context/AuthContext.jsx` o la integración del formulario: resolver el identificador numérico del empleado desde la identidad autenticada - expect el request nunca envíe un empleado inventado ni permita operar si falta el dato

## 2. Flujo del Libro de Cuentas

- [x] 2.1 `src/pages/AccountBookPage.jsx`: agregar la acción visible “Transferencia interna” en la sección de cuentas corporativas - expect usuarios autorizados puedan abrir el formulario desde Libro de Cuentas
- [x] 2.2 `src/pages/AccountBookPage.jsx`: implementar el modal/formulario con origen, destino, monto y observaciones usando las cuentas corporativas cargadas - expect el formulario reutilice estilos y patrones de diálogo existentes
- [x] 2.3 `src/pages/AccountBookPage.jsx`: validar campos obligatorios, monto positivo y cuentas de origen/destino diferentes antes del POST - expect entradas inválidas no generen solicitudes y muestren mensajes accionables
- [x] 2.4 `src/pages/AccountBookPage.jsx`: conectar envío, estado de carga, cierre/reinicio y confirmación de éxito - expect el usuario vea el resultado de la operación y no pueda duplicarla durante el envío
- [x] 2.5 `src/pages/AccountBookPage.jsx`: mostrar errores del backend o errores normalizados sin perder el formulario - expect una transferencia rechazada sea corregible y no se anuncie como exitosa

## 3. Historial y verificación

- [x] 3.1 `src/pages/AccountBookPage.jsx`: incorporar la respuesta o fuente disponible de transferencias internas al modelo de historial sin etiquetarla como movimiento externo - expect los movimientos internos puedan distinguirse cuando el backend entregue esa información
- [x] 3.2 `tests/` o ubicación de pruebas existente: cubrir validaciones del formulario, payload del POST, bloqueo por empleado faltante y refresco tras éxito - expect los escenarios críticos de la especificación sean verificables
- [x] 3.3 Proyecto frontend: ejecutar diagnósticos, pruebas disponibles y `npm run build` - expect la integración compile y no introduzca errores de lint o build en los archivos modificados
