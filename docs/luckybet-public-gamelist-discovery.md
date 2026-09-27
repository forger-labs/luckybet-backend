# Diagnóstico y Descubrimiento: Acceso Autorizado al Catálogo de Juegos sin Usuario en LuckyBet

> Documento generado a partir de la ingeniería inversa del bundle de producción de `https://luckybet.site/` (`main.4caf41a5.js`) y pruebas en vivo contra `https://api.luckybet.site/?act=command&area=cmd`.

---

## 1. El Problema Identificado

Al intentar llamar al comando `gameList` enviando el `before_token` obtenido de `siteInitialize`, el servidor respondía con:
```json
{
  "errorCode": "authorize_error",
  "error": "Autorización fallida",
  "status": "fail"
}
```

Tanto si se enviaba como `token: beforeToken` como si se enviaba `before_token: beforeToken`, `gameList` fallaba de inmediato con error de autorización.

---

## 2. Descubrimiento Clave en el Frontend Oficial de LuckyBet

Al descargar e inspeccionar el bundle de producción de la SPA oficial (`https://luckybet.site/static/js/main.4caf41a5.js`), se encontraron dos detalles críticos en el interceptor de peticiones:

### A. El nombre del comando NO es `gameList`, sino `getGameList`
En el código fuente de la SPA de React:
```javascript
// main.4caf41a5.js
(async e => await (0, o.E)({ cmd: "getGameList" }, e))(e)
```
- El comando `gameList` está protegido y **requiere sesión activa de jugador** (`token` emitido por `authorization`).
- El comando **`getGameList`** es el comando público del frontend diseñado para clientes no autenticados.

### B. El interceptor inyecta `before_token` bajo su propia clave
```javascript
// Interceptor en main.4caf41a5.js
let o = localStorage.getItem("ig_token"),
    i = localStorage.getItem("before_token");

if (e.cmd && "terminalLogin" !== e.cmd && "beforeAuthorize" !== e.cmd) {
    if (o) {
        e.token = o;
    } else if (i) {
        e.before_token = i;
    }
}
```
Cuando el usuario no ha iniciado sesión (`!o`), la SPA envía la propiedad **`before_token: i`** en el cuerpo JSON (no `token`).

### C. La propiedad `domain` es OBLIGATORIA
Si se llama a `getGameList` omitiendo el campo `domain`, el servidor responde:
```json
{
  "errorCode": "settings_not_found",
  "error": "Settings not found",
  "status": "fail"
}
```
El backend PHP necesita saber qué sitio/marca está solicitando el catálogo. Por lo tanto, `domain` debe estar presente en el cuerpo JSON:
```json
{
  "domain": "https://luckybet.site" // o "luckybet.site"
}
```

---

## 3. La Solución Probada y Verificada al 100%

La combinación exacta que otorga **acceso autorizado exitoso** devolviendo los **1.065 juegos del catálogo** sin usuario logueado es:

### Paso 1: Inicializar el sitio para obtener el `before_token`
**POST** `https://api.luckybet.site/?act=command&area=cmd`
```json
{
  "cmd": "siteInitialize",
  "domain": "https://luckybet.site"
}
```
**Respuesta:**
```json
{
  "status": "success",
  "content": {
    "before_token": "6c6a4bf99d5a96ce83fc14346b18b22f"
  }
}
```

### Paso 2: Consultar `getGameList` con `before_token` y `domain`
**POST** `https://api.luckybet.site/?act=command&area=cmd`
```json
{
  "cmd": "getGameList",
  "domain": "https://luckybet.site",
  "before_token": "6c6a4bf99d5a96ce83fc14346b18b22f"
}
```

### Respuesta Exitosa del Servidor de LuckyBet:
```json
{
  "status": "success",
  "datetime": "2026-09-27 03:14:00",
  "content": {
    "games": {
      "512": {
        "id": 512,
        "name": "American Poker II",
        "flash": false,
        "img": "/resources/sitepics/games/tbs2/game_img/AmericanPokerII.avif",
        "demo": false,
        "fs": false,
        "bonus": true,
        "wager": true,
        "animation": { "vertical": false, "horizontal": false },
        "tags": ["cards", "casino", "poker"],
        "category": "slots",
        "label": "table_games"
      },
      ...
    }
  }
}
```
*(Total: 1.065 juegos obtenidos exitosamente)*.

---

## 4. Conclusiones y Puntos a Tener en Cuenta para el Backend
1. No se requiere enviar cookies (`Cookie: PHPSESSID=...` es completamente opcional para esta llamada, funciona idéntico sin ella).
2. El comando a usar cuando no hay jugador es **`getGameList`** con `{ cmd: 'getGameList', domain: 'https://luckybet.site', before_token: '<token>' }`.
3. La respuesta devuelve los juegos dentro de `content.games` como un diccionario/mapa de objetos indexados por su ID numérico (`Object.values(content.games)`).
