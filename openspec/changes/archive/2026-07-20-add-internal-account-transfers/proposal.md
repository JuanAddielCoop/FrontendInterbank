## Why

El Libro de Cuentas actualmente permite consultar movimientos y registrar cuentas corporativas, pero no ofrece una forma visible de mover fondos entre dos cuentas internas administradas por la cooperativa. Esto obliga a realizar la operación fuera del frontend y dificulta su trazabilidad; se necesita incorporar la transferencia interna como una operación explícita del libro.

## What Changes

- Agregar una acción visible de “Transferencia interna” dentro de la vista Libro de Cuentas.
- Incorporar un formulario para seleccionar o introducir cuenta de origen y cuenta de destino, indicar monto y observaciones.
- Enviar la operación mediante `POST /api/v1/Cuentas/transferencias-internas` con el empleado autenticado.
- Validar en el frontend que las cuentas sean distintas, el monto sea válido y los campos requeridos estén completos.
- Mostrar estados de carga, éxito y error, y actualizar la información del libro después de una transferencia exitosa.
- Representar la transferencia interna en el historial con sus cuentas, monto, fecha, estado y notas cuando la respuesta o el historial disponible lo permita.

## Capabilities

### New Capabilities

- `internal-account-transfers`: Permite iniciar, validar, confirmar y visualizar transferencias entre cuentas corporativas internas desde el Libro de Cuentas.

### Modified Capabilities

- Ninguna. No existen especificaciones de capacidades previas en `openspec/specs/`.

## Impact

- Frontend: `src/pages/AccountBookPage.jsx` y el módulo de consultas de `src/modules/accountBook/queries/useAccountBook.js`.
- API: nuevo consumo del endpoint `POST /api/v1/Cuentas/transferencias-internas`.
- Datos usados: cuentas corporativas de `/Cuentas/banco-reservas`, identidad/empleado autenticado y consultas del libro.
- Estado remoto: invalidación o actualización de las consultas relacionadas con cuentas, sumatorias e historial después de completar la operación.
- No se requieren cambios de dependencias ni modificaciones al backend dentro de este cambio.
