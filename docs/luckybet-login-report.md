# Reporte: Login y validación de token en LuckyBet (`luckybet.site`)

> **Fecha de investigación:** 2026-09-13
> **Credenciales usadas (prueba):** `serrot99` / `991702`
> **Objetivo:** determinar cómo funciona el login de jugadores y cómo verificar la validez de un `access token` desde nuestro backend (luckybet-premios-backend) para almacenar información del usuario.

---

## 1. Resumen ejecutivo

- El sitio de jugadores (`https://luckybet.site/`) es una **SPA React** que consume una **API JSON de comandos** PHP alojada en `https://api.luckybet.site/`.
- El login del jugador se hace con un **`POST` JSON a `https://api.luckybet.site/?act=command&area=cmd`**:

```json
{
  "cmd": "authorization",
  "type": "login",
  "data": { "login": "serrot99", "password": "991702" },
  "version": 9,
  "domain": "luckybet.site"
}
```

- La respuesta exitosa contiene un **token opaco de 32 caracteres hex** (NO es un JWT):

```json
{
  "token": "0017721a1e84c5e524d5e5e89fd92f83",
  "microtime": "0.039057016372681",
  "datetime": "2026-09-13 17:20:14",
  "status": "success",
  "content": { "language": "es" }
}
```

- **El token no se puede verificar de forma offline** (no tiene firma ni claims decodificables). La única forma de validarlo es **consultar la API con el token en el body**: el comando `terminalInfo` devuelve el perfil del usuario si el token es válido, o `errorCode: "authorize_error"` si no lo es.
- Los tokens son **revocables** (`userLogout` los invalida inmediatamente) y están ligados a la sesión del servidor; el frontend los renueva consultando `terminalInfo` periódicamente (cada ~6 s).

---

## 2. Arquitectura y stack tecnológico

| Capa | Tecnología | Evidencia |
|---|---|---|
| CDN / proxy | **Cloudflare** (HTTP/2, `cf-ray`, `nel`) | Headers de todas las respuestas |
| Frontend | **SPA React** (bundle `main.4caf41a5.js`, ~690 KB minificado; CSS `main.367a7bd8.css`) | HTML de `https://luckybet.site/` |
| Frontend extras | PWA (`manifest.webmanifest`), Sentry (`o4509955622305792.ingest.de.sentry.io`), Google Analytics (`gtag`), Callbell chat, Sendx widget, chat Hivara (`chat-widget.hivara.ai`), **Telegram Mini App** (`window.Telegram.WebApp`) | Bundle JS |
| Backend API | **PHP** con router `?act=...&area=...` (front controller `index.php`) | `index.php?act=admin&area=login`, respuestas JSON del envelope |
| Servidor | **openresty** (nginx) en el dominio principal + **Apache/2.4.52 (Ubuntu)** tras `api.luckybet.site` | Páginas de error 404/405 y headers |
| Assets de juego | CDN externo `cdn.cdnpin.com` | `gameList` → `img: https://cdn.cdnpin.com/resources/...` |
| Sesiones | PHP `PHPSESSID` (panel admin) + tokens de sesión opacos (API jugadores) | Headers `set-cookie: PHPSESSID=...` |
| Detección de bots | El dominio principal devuelve 404/405 según User-Agent | Pruebas con/sin UA de navegador |

**Puntos de entrada del mismo backend PHP:**

| Host | Rol |
|---|---|
| `luckybet.site` | SPA React (jugadores). Rechaza POST directo al API (405). |
| `api.luckybet.site` | API de comandos JSON (`?act=command&area=cmd`) y panel admin (`?act=admin`). Es el host que debe usar nuestro backend. |
| `admin.luckybet.site` | Panel administrativo (login por sesión PHP: campos `login`/`password`). |

> ⚠️ La API de comandos **solo responde** en `api.luckybet.site`. En `luckybet.site/?act=command&area=cmd` el método POST da `405 Not Allowed` (openresty).

---

## 3. Flujo de login del jugador (reproducido)

### 3.1 Request

```
POST https://api.luckybet.site/?act=command&area=cmd
Content-Type: application/json
Origin: https://luckybet.site     (opcional; CORS permite cualquier origen)
```

```json
{
  "cmd": "authorization",
  "type": "login",
  "data": { "login": "serrot99", "password": "991702" },
  "version": 9,
  "domain": "luckybet.site"
}
```

Campos:

| Campo | Requerido | Notas |
|---|---|---|
| `cmd` | ✅ | `"authorization"` activa el login |
| `type` | ❌ | `"login"` (credenciales) u `"telegramMiniApp"` (Telegram). **Si se omite, el login con `data.login/password` igual funciona.** |
| `data.login` / `data.password` | ✅ | Credenciales del jugador |
| `version` | ✅ (efectivo) | Versión de protocolo del cliente (actual: `9`). Sin él la API no devuelve JSON. |
| `domain` | ✅ (efectivo) | Sitio (`"luckybet.site"`); el router toma la config del sitio. |

### 3.2 Respuesta exitosa

```json
{
  "token": "0017721a1e84c5e524d5e5e89fd92f83",
  "microtime": "0.039057016372681",
  "datetime": "2026-09-13 17:20:14",
  "status": "success",
  "content": { "language": "es" }
}
```

El campo `token` que devuelve el login es el **`ig_token`** que la SPA guarda en `localStorage`.

### 3.3 Respuestas de error (login)

```json
// Contraseña incorrecta
{ "errorCode": "password_not_correct", "error": "Contraseña incorrecta", "status": "fail", ... }

// Usuario inexistente: el login NO distingue entre usuario inexistente y otros errores de autorización
```

> El panel admin (otro flujo, operadores) sí distingue: `POST admin.luckybet.site/index.php?act=admin&area=login` con `login`/`password` devuelve HTML con *"Usuario no es encontrado"* (confirma que `serrot99` es jugador, no administrador). Ese flujo usa sesiones PHP (`PHPSESSID`), no tokens.

---

## 4. El access token: formato y ciclo de vida

| Propiedad | Valor |
|---|---|
| Formato | **Opaco** — 32 caracteres hexadecimales (16 bytes). Ej: `0017721a1e84c5e524d5e5e89fd92f83` |
| Tipo | **NO es JWT** (no tiene header/payload/firma, no es decodificable) — es un ID de sesión de servidor |
| Transporte | **Solo en el body JSON** (`"token": "..."`). No funciona ni como query param (`?token=`) ni como header `Authorization: Bearer ...` |
| Unicidad | Cada login genera un token distinto (verificado con 4 logins: `0017...`, `0ade...`, `008e...`, `9575...`) |
| Revocación | **Sí, inmediata**: `userLogout` con el token → `status: success`, y el mismo token deja de funcionar al instante (`authorize_error`) |
| Expiración | Controlada por el servidor (no documentada). El token sobrevive al menos ~100 s de inactividad; el frontend lo "mantiene vivo" consultando `terminalInfo` cada 6 s (`updateInterval: 6000`) |
| Renovación | No hay refresh token visible: el usuario vuelve a loguear (o el frontend interactúa con `terminalInfo`) |

**Conclusión para el backend:** un token verificado hoy puede dejar de ser válido mañana (o en minutos) por expiración o logout. **No cachear validaciones indefinidamente.**

---

## 5. Cómo verificar la validez del token desde nuestro backend

### 5.1 Método oficial (recomendado)

Consultar `terminalInfo` (el mismo comando que usa el frontend para cargar el perfil) incluyendo el token en el body:

```
POST https://api.luckybet.site/?act=command&area=cmd
Content-Type: application/json
```

```json
{
  "cmd": "terminalInfo",
  "first": true,
  "token": "<ACCESS_TOKEN_DEL_USUARIO>",
  "version": 9,
  "domain": "luckybet.site"
}
```

**Token válido** → `status: "success"` + perfil del usuario en `content`:

```json
{
  "microtime": "0.062042951583862",
  "datetime": "2026-09-13 17:20:22",
  "status": "success",
  "content": {
    "id": 8744343,
    "login": "serrot99",
    "name": "",
    "cash": "0.00",
    "currency": "ARS",
    "updateInterval": 6000,
    "sessionMessage": "success",
    "bonus": false,
    "cash_bonus": "0.00",
    "wager": { "enable": true, "value": "0.00", "chargeable": "0.00", "wagering": "0.00", "percent": 50, "left": 0 },
    "sos": { "activ": false, "url": "index.php" },
    "buttons": { "transactions": false, "exit": 1, "changePassword": 1 },
    "promocodes": { "enable": false },
    "isActivePayments": false,
    "bad_password": false,
    "...": "..."
  }
}
```

Datos útiles para almacenar del usuario: **`content.id`** (id interno del casino), **`content.login`**, **`content.name`**, **`content.currency`**, **`content.cash`**, `content.cash_bonus`.

**Token inválido / expirado / revocado** → `status: "fail"` con error de autorización:

```json
{
  "errorCode": "authorize_error",
  "error": "Autorización fallida",
  "status": "fail",
  "datetime": "2026-09-13 20:20:35",
  "microtime": 0.0107269287109375
}
```

Esta firma (`errorCode: "authorize_error"`) es el criterio canónico de "token no válido" y aplica también para: token inexistente, token sin el prefijo/sesión correcta o token ausente.

### 5.2 Regla de decisión

| Respuesta | Interpretación |
|---|---|
| `status == "success"` y `content.id` presente | Token **válido**. Usar `content.id`/`content.login` como identidad del usuario. |
| `status == "fail"` y `errorCode == "authorize_error"` | Token **inválido/expirado/revocado** → rechazar (401). |

### 5.3 Esquema de integración sugerido (NestJS)

1. El frontend de GanaYa obtiene el `ig_token` (de `localStorage` del casino o de su propio flujo) y lo envía a nuestro backend al registrar/login.
2. Nuestro backend valida el token contra LuckyBet **en cada request crítico** (o con cache de TTL corto, p. ej. 60 s, porque el token puede revocarse en cualquier momento):

```typescript
// src/luckybet/* — sketch
async validateToken(token: string): Promise<LuckyBetUser | null> {
  const res = await fetch("https://api.luckybet.site/?act=command&area=cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "terminalInfo",
      first: true,
      token,
      version: 9,
      domain: "luckybet.site",
    }),
  });
  const json = await res.json();
  if (json.status === "success" && json.content?.id) {
    return { casinoId: json.content.id, login: json.content.login, ... };
  }
  return null; // authorize_error -> 401
}
```

3. Persistir el mapping `casinoId ↔ usuario local` para almacenar misiones/premios por usuario.

---

## 6. Catálogo de comandos descubiertos (`?act=command&area=cmd`)

| Comando | ¿Auth? | Respuesta / uso |
|---|---|---|
| `authorization` (type login / telegramMiniApp) | No | Login → `token` |
| `terminalInfo` | Sí | Perfil del usuario (id, login, saldo, moneda, bonos). **Es la verificación de token.** |
| `gameList` | Sí | Catálogo de juegos (ids, nombres, imágenes desde `cdn.cdnpin.com`). |
| `userLogout` | Sí | Revoca el token (`status: success`, luego `authorize_error`). |
| `casinoNRegister` | No (con validación de campos) | Registro de jugador (requiere `currency`; ej. error `currency_not_set`). |
| `currencySet` | Sí | Cambiar moneda (los errores de auth se ven al usar token revocado). |
| `casinoPasswordChange` | Sí | Cambio de contraseña (visto en bundle, `password`/`passwordNew`). |
| `passwordRecovery` | No | Recuperación vía `phone` o `e_mail` + `domain` (visto en bundle). |
| `config/getConfig` | No | Config del sitio; vía legacy `api.php?type=query`; puede devolver `content.before_token` (token pre-login para flujos previos a autenticar, p. ej. registros/languages). |
| `langs/getLanguages` | No | Idiomas; puede devolver `before_token`. |

**Despacho:** los comandos desconocidos responden `errorCode: "cmd_not_found"` **antes** de chequear auth; los conocidos pasan a validar token (por eso un comando conocido con token muerto da `authorize_error`). Útil para confirmar que un comando existe.

**Endpoint legacy:** `/api.php?type=query` (Solo en `luckybet.site` vía SPA; no existe en `api.luckybet.site` — 404 Apache). Usado por `config/getConfig` (con `"legacy": true`) y para QR de 2FA (`{"qrcode": ...}`).

---

## 7. Consideraciones de seguridad

1. **Sin verificación offline:** al ser token opaco de sesión, nuestro backend *tiene* que llamar a la API para validar. No hay firma pública ni JWKS.
2. **Revocación inmediata:** `userLogout` mata el token al instante. Una validación cacheada puede estar obsoleta.
3. **CORS abierto:** `Access-Control-Allow-Origin: *` y `Authorization` permitido, `withCredentials: false` — la API es consumible desde cualquier origen (pero exige el token en body, no en cookie).
4. **`type` opcional en `authorization`:** omitir `type` no impide el login con `login`/`password`; no usar `type` como control de seguridad.
5. **Credenciales en claro sobre TLS:** el login viaja en JSON por HTTPS; igual que cualquier formulario. Nuestro backend no debería almacenar la contraseña del casino.
6. **No mezclar con el JWT propio:** el backend actual (`src/auth`) emite sus propios JWT (`JWT_SECRET`/`EXPIRES_IN_TOKEN`) para el panel; el token de LuckyBet es **otra cosa** y debe verificarse contra `api.luckybet.site`, no contra nuestro secreto.
7. **Distinción de flujos:** existe un segundo login (admin/PHP sessions en `admin.luckybet.site`) que es operadores, no jugadores. `serrot99` es jugador (en el admin dice "Usuario no es encontrado").

---

## 8. Evidencias (requests reales)

```
POST https://api.luckybet.site/?act=command&area=cmd
{"cmd":"authorization","type":"login","data":{"login":"serrot99","password":"991702"},"version":9,"domain":"luckybet.site"}
→ 200 {"token":"0017721a1e84c5e524d5e5e89fd92f83","status":"success","content":{"language":"es"}}

POST ... {"cmd":"terminalInfo","first":true,"token":"0017721a1e84c5e524d5e5e89fd92f83","version":9,"domain":"luckybet.site"}
→ 200 {"status":"success","content":{"id":8744343,"login":"serrot99","currency":"ARS","cash":"0.00", ...}}

POST ... {"cmd":"terminalInfo","first":true,"token":"DEADBEEF...","version":9,"domain":"luckybet.site"}
→ 200 {"errorCode":"authorize_error","error":"Autorización fallida","status":"fail"}

POST ... {"cmd":"userLogout","token":"<token válido>","version":9,"domain":"luckybet.site"}
→ 200 {"content":[],"status":"success","datetime":"...","microtime":...}
  (el mismo token ya no funciona después)

POST ... {"cmd":"authorization","type":"login","data":{"login":"serrot99","password":"wrong"},"version":9,"domain":"luckybet.site"}
→ 200 {"errorCode":"password_not_correct","error":"Contraseña incorrecta","status":"fail"}
```

---

## 9. Anexo: metodología usada (resumen)

1. Devolución del HTML de `luckybet.site` — inicialmente 404, hasta que se detectó que **openresty filtra por User-Agent** (con UA de navegador responde 200).
2. Análisis del HTML → SPA React con bundle `/static/js/main.4caf41a5.js`.
3. Descarga del bundle y búsqueda de endpoints: se halló el transporte `POST {origin → api.}?act=command&area=cmd` con envelope `{status, content, error, datetime, microtime}` y los comandos (`authorization`, `terminalInfo`, etc.).
4. Enumeración de subdominios vía `crt.sh` y DNS (admin/api/www/gr19-21).
5. Reproducción del login con las credenciales de prueba → token opaco de 32 hex.
6. Validación del token con `terminalInfo`, pruebas de token inválido, logout, expiración y transporte (query/header vs body).
7. Documentación de errores (`authorize_error`, `cmd_not_found`, `password_not_correct`, `currency_not_set`).