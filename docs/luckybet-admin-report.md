# Reporte: Acceso al panel admin de LuckyBet y endpoints de consulta

> **Fecha de validación inicial:** 2026-09-13
> **Actualización arquitectónica:** 2026-09-21
> **Credenciales admin verificadas:** `Tigreee4` — **login exitoso**

---

## 1. Resumen

- El panel admin de LuckyBet funciona en `https://ag.luckybet.site/` (para operaciones globales y agentes) y en `https://admin.luckybet.site/` sobre el backend PHP (`index.php` con router `?act=...&area=...`), **autenticando por sesión PHP** (`PHPSESSID`), no por token.
- **`Tigreee4` tiene acceso válido.** Grupo `6`, moneda `ARS`, balance de operador `700 000 ARS`.
- Toda la información del panel (usuarios, balances, historial de operaciones, transferencias, sesiones de juego) se obtiene por **GET/POST con la cookie de sesión**; los principales datos vienen en **JSON** usando `response=js`.

---

## 2. Login y Gestión de Sesión

```http
POST https://ag.luckybet.site/index.php?act=admin&area=login
Content-Type: application/x-www-form-urlencoded

login=Tigreee4&password=<contraseña>
```

**Respuesta de éxito:** `HTTP 302` con `Location: index.php` y `Set-Cookie: PHPSESSID=<id>; path=/` (se emiten dos cookies; la **segunda** es la sesión utilizable).

**Sesión en Redis:** Administrada por `AdminPanelService` con TTL de 4 minutos (240 s) bajo `luckybet:admin:phpsessid`. Cuenta con auto-login transparente ante respuestas con `noMain: true`, `redirect: "login"` o código `302`.

---

## 3. Endpoints de Consulta

> Base: `https://ag.luckybet.site/index.php?act=admin&area=<AREA>`
> Formato de fecha del panel: `YYYY-MM-DD HH:MM:SS` (hora del servidor).

### 3.1 Búsqueda Global de Jugadores (`area=search`)

```http
POST https://ag.luckybet.site/index.php?act=admin&area=search&response=js
Content-Type: application/x-www-form-urlencoded
Cookie: PHPSESSID=session_xyz

search_login=serrot99&page=1
```

Respuesta JSON:
```json
{
  "users": [
    {
      "id": "8744343",
      "login": "serrot99",
      "group": "5",
      "name": "",
      "weight": "2",
      "create": "8745704"
    }
  ],
  "next_page_enable": false,
  "prev_page_enable": false,
  "page_start_num": 1,
  "page_end_num": 1
}
```

### 3.2 Historial de Rondas y Sesiones de Juego (`area=history`)
**Endpoint nativo para auditar sesiones reales de slots por ID de jugador.** Límite de hasta **1.000 registros**.

```http
GET https://ag.luckybet.site/index.php?act=admin&area=history&id=8744343&response=js&limit=1000&from=2026-09-14%2000:00:00&to=2026-09-21%2023:59:59
Cookie: PHPSESSID=session_xyz
```

Respuesta JSON:
```json
{
  "sessions": [
    {
      "id": "1849204",
      "game": "sweet_bonanza",
      "game_name": "Sweet Bonanza",
      "datetime": "2026-09-21 12:30:15",
      "wager": "250.00",
      "win": "500.00",
      "session": "sess_89431"
    }
  ]
}
```

### 3.3 Libro Contable de Balances y Movimientos (`area=balance`)

```http
GET https://ag.luckybet.site/index.php?act=admin&area=balance&id=8744343&response=js&limit=1000
Cookie: PHPSESSID=session_xyz
```

Respuesta JSON:
- `currencies`: Saldo actual por moneda (`{ "ARS": "5000.00" }`).
- `operationsData`: Movimientos contables (`id`, `user`, `from`, `uid`, `operation`, `currency`, `cash`, `cash_before`, `datetime`, `system`, `initiator`, `wager`, `ip`).

---

## 4. Operaciones de Saldo (Depósitos y Retiros)

```http
POST https://ag.luckybet.site/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=8744343
Content-Type: application/x-www-form-urlencoded
Cookie: PHPSESSID=session_xyz

balance_currency=ARS&amount=2000&send=true&all=false&operation=in|out
```

- `operation=in` $\rightarrow$ Carga (depósito).
- `operation=out` $\rightarrow$ Retiro.
- `all=true` $\rightarrow$ Retiro total (vaciar cuenta); `all=false` $\rightarrow$ Retiro/depósito por monto nominal.
- Parámetros de bonos soportados en `operation=in`: `bonus`, `promocode`, `cashier_bonus`, `balance_type`.

### Aclaración sobre Paridad Nominal 1:1 y Bonos de Bienvenida
> ℹ️ **Aclaración sobre el Factor 2:** El incremento observado en pruebas (donde cargar 2.000 mostraba un saldo total de 4.000) se debió a la activación automática del **Bono de Bienvenida del 100% (`BonusIntern.OneHundred`)**, que suma el saldo en efectivo real ($2.000 cash) y el saldo de bonificación/wager ($2.000 bono).
> Las operaciones se ejecutan en **paridad nominal 1:1**.

---

## 5. Notas para la Integración en `luckybet-premios-backend`

1. **Sesión de Admin**: Gestionada en Redis con TTL de 4 minutos y auto-relogin ante expiración.
2. **Historial de Juegos**: Priorizar `area=history` para obtener las sesiones reales de juego, deduplicar semanalmente y enriquecer con las imágenes del catálogo CDN (`https://cdn.cdnpin.com/resources/...`).
3. **Identificador Canónico**: El `id` de la API de jugadores (`terminalInfo`) coincide exactamente con el `id`/`uid` del panel de agentes (`8744343` para `serrot99`).
