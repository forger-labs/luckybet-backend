# Diagnóstico Técnico: Llamadas a `getGames` / `getPlayerHistory` en LuckyBet

Este documento analiza en profundidad el flujo de ejecución de `GET /players/me/games` y `getLastPlayedGames`, identificando por qué puede estar fallando la llamada HTTP hacia el panel administrativo de LuckyBet (`index.php?act=admin&area=history`) y qué cabeceras o parámetros exactos requiere el panel PHP.

---

## 1. Cadena de Invocación

```text
Cliente HTTP (Frontend)
   │  [GET /api/v1.0/players/me/games]
   │  Header: Authorization: Bearer <playerToken>
   ▼
PlayersController.getGames
   │
   ▼
PlayersCore.getPlayedGames
   │  identifier = player.luckyBetId ?? player.username
   ▼
PanelApiCore.getLastPlayedGames(identifier, options)
   │  1. resolveLuckyBetUserId(identifier) -> Obtiene ID numérico de LuckyBet
   │  2. userPanel.getGameList() -> Obtiene catálogo con CDN
   ▼
AdminPanelService.getLastPlayedGames(targetId, options)
   │
   ▼
AdminPanelService.getPlayerHistory(userId, options)
   │
   ▼
HTTP GET https://ag.luckybet.site/index.php?act=admin&area=history&id=<userId>&response=js&from=...&to=...&limit=1000
```

---

## 2. Hallazgos: Posibles Causas del Fallo en la Petición

### 2.1 Cabeceras en `getPlayerHistory` (Líneas 348-356 en `adminPanel.service.ts`)
Actualmente el código envía:
```typescript
return this.client.get<LuckyBetHistoryResponse>(url, {
    headers: {
        Accept: 'application/json',
        Cookie: `PHPSESSID=${String(sessionId)}`,
    },
});
```

#### Problemas detectados con el panel PHP de LuckyBet:
1. **Falta de Cabeceras de Navegador / AJAX (`X-Requested-With`)**:
   - LuckyBet usa `response=js` en los query params para retornar JSON en lugar de HTML completo.
   - En muchos scripts PHP legacy de este panel, si no detectan:
     ```http
     X-Requested-With: XMLHttpRequest
     ```
     o si detectan un `User-Agent` genérico de Axios (`axios/1.x`), el servidor web o Cloudflare devuelve un redirect `302 Found` hacia la página de login HTML o un `403 Forbidden`.
2. **Falta de `Referer` y `Origin`**:
   - Para las áreas administrativas (`area=history`, `area=useredit`, `area=balance`), el panel valida que la petición provenga del mismo host administrativo:
     ```http
     Referer: https://ag.luckybet.site/index.php?act=admin&area=history&id=<userId>
     Origin: https://ag.luckybet.site
     ```
3. **Formato de la Cookie `PHPSESSID`**:
   - Si la sesión administrativa en Redis expiró o fue cerrada por inactividad en el panel externo, LuckyBet no devuelve un error JSON con código 401; devuelve un redirect HTTP `302` hacia `index.php?act=admin&area=login` o un payload con HTML.
   - En `requestWithSession`, si el body devuelto no es JSON y contiene `<script>window.location...` o etiquetas HTML, el parser de Axios o JSON.parse revienta.

---

### 2.2 Inconsistencia del Identificador (`userId` vs `username`)
En `adminPanel.service.ts`:
```typescript
params.append('act', 'admin');
params.append('area', 'history');
params.append('id', String(userId));
```
- `area=history` en LuckyBet **exige estrictamente el ID numérico interno de LuckyBet** (`id=5043`), **NO el username**.
- Si `resolveLuckyBetUserId` no logra resolver el username contra `area=search` y pasa el username en string (o si el usuario no tiene `luckyBetId` en `playerAuthContext`), la URL se construye como:
  `index.php?act=admin&area=history&id=pepito123`
  El panel PHP hace un `(int)$_GET['id']` que se convierte en `0`, devolviendo historial vacío o error de base de datos.

---

### 2.3 Formato de Fechas en los Query Params
Actualmente se envía:
```typescript
from: "YYYY-MM-DD"
to: "YYYY-MM-DD"
```
En LuckyBet `area=history`:
- Algunos controladores PHP de LuckyBet esperan el formato con hora completa:
  `from=YYYY-MM-DD 00:00:00` y `to=YYYY-MM-DD 23:59:59` codificados con URL (`YYYY-MM-DD+00%3A00%3A00`).

---

## 3. Cabeceras Recomendadas para Blindar la Llamada

Para asegurar que LuckyBet responda con el JSON de historial sin bloqueos:

```typescript
headers: {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${this.panelHost}/index.php?act=admin&area=history&id=${userId}`,
    'Origin': this.panelHost,
    'Cookie': `PHPSESSID=${String(sessionId)}`,
}
```

---

## 4. Próximos Pasos para Verificación en Vivo
1. Probar la petición directa con el script `scripts/test-luckybet-credit.js` pasando `area=history` para observar exactamente qué devuelve el servidor ante diferentes combinaciones de cabeceras.
2. Si se confirma que el servidor requiere `X-Requested-With` o `Referer`, inyectar estas cabeceras por defecto en la instancia `AXIOS_ADMIN_PANEL` o en el método `requestWithSession`.
