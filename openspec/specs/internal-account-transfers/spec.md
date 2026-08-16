# Spec: internal-account-transfers

## Purpose

Permite iniciar, validar, confirmar y visualizar transferencias entre cuentas corporativas internas desde el Libro de Cuentas del frontend administrativo.

## Requirements

### Requirement: Internal transfer action is available from the account book
The account book SHALL expose a clearly labeled action for starting a transfer between internal corporate accounts without requiring a separate navigation section.

#### Scenario: User opens the internal transfer form
- **WHEN** an authenticated user with access to Libro de Cuentas views the corporate accounts section
- **THEN** the user can activate a visibly labeled "Transferencia interna" action

#### Scenario: No eligible accounts are available
- **WHEN** the account book has no corporate accounts available
- **THEN** the transfer action SHALL remain unavailable or the form SHALL explain that two corporate accounts are required

### Requirement: Internal transfer form validates the operation
The form SHALL collect the source account, destination account, amount, and optional observations, and SHALL prevent submission when required values are invalid.

#### Scenario: Valid transfer data
- **WHEN** the user selects two different corporate accounts and enters a positive finite amount
- **THEN** the form permits submission and sends the selected values without display formatting in the numeric payload

#### Scenario: Same account selected twice
- **WHEN** the source and destination accounts are equal
- **THEN** the form rejects submission and explains that the accounts must be different

#### Scenario: Missing or invalid amount
- **WHEN** the amount is empty, zero, negative, non-finite, or otherwise invalid
- **THEN** the form rejects submission and displays an actionable validation message

### Requirement: The frontend submits the internal transfer contract
The account book SHALL submit a `POST` request to `/Cuentas/transferencias-internas` with `numeroCuentaOrigen`, `numeroCuentaDestino`, `monto`, `observaciones`, and the authenticated employee identifier in `empleado`.

#### Scenario: Successful submission
- **WHEN** the backend accepts the transfer request
- **THEN** the frontend shows a success confirmation, closes or resets the form, and refreshes account balances and book data

#### Scenario: Backend rejects the transfer
- **WHEN** the backend returns an error response
- **THEN** the frontend keeps the form available, stops the loading state, and shows the returned or normalized error message without reporting success

#### Scenario: Employee identifier is unavailable
- **WHEN** no numeric employee identifier can be resolved from the authenticated user
- **THEN** the frontend SHALL prevent submission and explain that the authenticated employee data is incomplete

### Requirement: The account book reflects completed internal transfers
The account book SHALL provide enough transaction feedback to distinguish a completed internal transfer from an external bank movement and SHALL refresh data from the backend after success.

#### Scenario: Completed transfer appears in refreshed data
- **WHEN** a transfer is accepted and the account book data is reloaded
- **THEN** the displayed balances and available history reflect the backend result and identify the movement as an internal transfer when the returned data supports that distinction

#### Scenario: User cancels the form
- **WHEN** the user closes or cancels the transfer form before submission
- **THEN** no request is made and the account book remains unchanged