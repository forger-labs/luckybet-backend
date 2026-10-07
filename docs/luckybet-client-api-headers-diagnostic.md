# Diagnóstico Técnico: Peticiones del Cliente en `UserPanelService` (LuckyBet)

Este documento detalla el análisis de las llamadas HTTP salientes realizadas por `UserPanelService` hacia la API pública/jugador de LuckyBet (`https://api.luckybet.site/?act=command&area=cmd`), identificando por qué pueden fallar peticiones como `gameList`, `siteInitialize` o `terminalInfo` debido a cabeceras HTTP faltantes o rechazadas por Cloudflare/servidor web.

---

## 1. Petición Actual en `UserPanelService.executeCommand`

En `src/panelApi/adapters/driven/userPanel.service.ts` (líneas 34-42 y 89-109):

```typescript
private readonly headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

// ...
const body: LuckyBetRequest = {
    cmd,
    version: this.version, // 9
    domain: this.domain.startsWith('http') ? this.domain : `https://${this.domain}`,
    ...payload,
};

const response = await this.client.post<LuckyBetResponse<TResContent>>(
    this.apiUrl, // https://api.luckybet.site/?act=command&area=cmd
    body,
    { headers: { ...this.headers } },
);
```

---

## 2. Factores de Fallo Identificados del Lado Cliente

### 2.1 Ausencia de Cabeceras Obligatorias de CORS / Navegador (`Origin` y `Referer`)
La API de jugadores (`act=command&area=cmd`) de LuckyBet está protegida por políticas de CORS y WAF (Cloudflare):
- **Problema**: Cuando una petición POST con `Content-Type: application/json` no lleva las cabeceras `Origin` ni `Referer`, muchos WAFs o reglas del servidor PHP rechazan la petición directamente con `403 Forbidden`, `400 Bad Request` o `network_error`.
- **Cabeceras faltantes requeridas**:
  ```http
  Origin: https://luckybet.site
  Referer: https://luckybet.site/
  ```

---

### 2.2 User-Agent por Defecto de Axios
- **Problema**: Por defecto, Axios envía en Node.js la cabecera `User-Agent: axios/1.x.x`.
- **Efecto en LuckyBet**: La infraestructura de `api.luckybet.site` utiliza Cloudflare y reglas de filtrado anti-bot. Las solicitudes con User-Agent de librerías HTTP automatizadas (`axios`, `curl`, `python-requests`) son interceptadas o desafiadas con páginas de captcha HTML en lugar de procesar el JSON, provocando un fallo silencioso o un `JSON.parse` error.
- **Cabecera requerida**:
  ```http
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
  ```

---

### 2.3 Cabecera AJAX (`X-Requested-With`)
- Al igual que en el panel administrativo, el endpoint de comandos PHP de LuckyBet valida que las solicitudes asíncronas provengan de la SPA web mediante:
  ```http
  X-Requested-With: XMLHttpRequest
  ```

---

### 2.4 Formato del Campo `domain` en el Body
En `executeCommand`, se envía:
```json
{
  "cmd": "siteInitialize",
  "domain": "https://luckybet.site",
  "version": 9
}
```
- **Ojo con el valor de `domain`**: En algunos comandos (como `authorization` y `terminalInfo`), el backend PHP de LuckyBet espera el nombre de host puro (`luckybet.site`), mientras que en `siteInitialize` espera la URL completa con protocolo (`https://luckybet.site`). Enviar un formato inconsistente puede causar que el comando falle con `domain_error`.

---

## 3. Configuración de Cabeceras Recomendada para `AXIOS_USER_PANEL`

Para blindar todas las llamadas de `UserPanelService` (`siteInitialize`, `gameList`, `terminalInfo`, `authorization`), las cabeceras deben configurarse así:

```typescript
const userPanelHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://luckybet.site',
    'Referer': 'https://luckybet.site/',
};
```

---

## 4. Pruebas y Verificación
Se puede ejecutar una llamada de prueba mediante script verificando el código de estado devuelto por `https://api.luckybet.site/?act=command&area=cmd` ante diferentes combinaciones de `Origin`, `Referer` y `User-Agent`.
