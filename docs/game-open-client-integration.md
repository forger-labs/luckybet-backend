# Guía de Integración y Análisis: Apertura y Lanzamiento de Juegos (`gameOpen`)

Este documento detalla el análisis técnico, comportamiento del comando `gameOpen` del proveedor LuckyBet y la arquitectura óptima recomendada para el lanzamiento y renderizado de juegos desde el cliente web/móvil.

---

## 1. Comando y Protocolo de Red (`gameOpen`)

Para iniciar una sesión de juego autenticada, se emite una solicitud `POST` al endpoint de comandos de LuckyBet:

- **Endpoint**: `https://api.luckybet.site/?act=command&area=cmd`
- **Método**: `POST`
- **Content-Type**: `application/json`

### 1.1 Payload de Entrada

```json
{
  "cmd": "gameOpen",
  "gameId": 29758,
  "mobile": 0,
  "demo": 0,
  "token": "28e5dad3d6ff1d071eb6c3903b2204e1",
  "version": 9,
  "domain": "https://luckybet.site"
}
```

#### Parámetros:
- `cmd` (*string*): `"gameOpen"`.
- `gameId` (*number | string*): Identificador numérico del juego obtenido en `getGameList` / `gameList`.
- `mobile` (*number*): `0` para vista desktop / horizontal o `1` para interfaces adaptadas a pantallas móviles.
- `demo` (*number*): `0` para modo dinero real o `1` para modo demo/práctica.
- `token` (*string*): Token de sesión activa del jugador (obtenido vía `authorization`).
- `version` (*number*): Versión de la API (`9`).
- `domain` (*string*): Dominio de origen (`https://luckybet.site`).

---

## 2. Radiografía de la Respuesta

El servidor de LuckyBet genera una sesión de juego remota y devuelve un status `200`:

```json
{
  "status": "success",
  "content": {
    "url": "https://luckybet.site/resources/xgames/aristox/checkered_flag/index.html?device=desktop&nogslang=ES&nogsmode=real&nogscurrency=ARS&lobbyurl=https%3A%2F%2Fluckybet.site%2Fclose.php&sessionid=9fdb89404a4718e17c4e1a58b93de81358962092%2Fea0d728fb6ab5ce26832&nogsserver=https%3A%2F%2Fluckybet.site%2Fresources%2Fxgames%2Fproto%2F5%2F&countrycode=ES&locale=es_ES&id_domain=sslgames&bbm=0",
    "iframe": 1,
    "system": "xgames",
    "name": "Checkered Flag",
    "session": "xgames:9fdb89404a4718e17c4e1a58b93de81358962092",
    "width": "0",
    "withoutFrame": "0",
    "exitButton": "1",
    "exitButton_mobile": "0",
    "disableReload": "0",
    "vertical": "0",
    "disable_ios_finger": "0",
    "bonus": "1"
  },
  "datetime": "2026-10-05 14:11:44",
  "microtime": 0.28635501861572266
}
```

### 2.1 Propiedades Clave de `content`
- **`url`**: URL completa del bundle HTML5/Canvas del juego con tokens de sesión inyectados (`sessionid`, `nogsserver`, `nogsmode`, `lobbyurl`).
- **`iframe`**: `1` indica que el slot soporta y está homologado para ejecutarse dentro de un `<iframe>`.
- **`vertical`**: `0` (apaisado/landscape) o `1` (vertical/portrait), útil para sugerir rotación en dispositivos móviles.
- **`exitButton`**: `1` indica que el juego posee botón nativo para salir al `lobbyurl`.

---

## 3. Estrategias de Apertura en el Cliente y Trade-offs

| Criterio | Opción A: Iframe Fullscreen In-App (Recomendada) | Opción B: Redirección (`window.location`) | Opción C: Popup / Nueva Pestaña |
| :--- | :--- | :--- | :--- |
| **Retención de Usuario** | **Alta**: El usuario no abandona la SPA de premios. | **Baja**: Abandona la plataforma. | **Media**: Abre una segunda ventana. |
| **Gamificación / Misiones** | **Soportada**: Permite overlays flotantes con progreso en vivo. | **No soportada**: Se pierde el contexto de la app. | **Limitada**: Difícil comunicación entre pestañas. |
| **Retorno al Salir** | **Inmediato**: Se desmonta el modal / iframe. | **Roto**: `lobbyurl` redirige al sitio base de LuckyBet. | **Manual**: El usuario debe cerrar la pestaña. |
| **Riesgo Bloqueadores** | **Nulo**: Renderizado dentro del DOM actual. | **Nulo**. | **Alto**: Safari/Chrome bloquean popups asíncronos. |

---

## 4. Patrón de Implementación Recomendado (Frontend)

### 4.1 Iframe Component con Sandbox y Loader

```tsx
import React, { useState } from 'react';

interface GameLauncherProps {
  gameUrl: string;
  gameTitle: string;
  onClose: () => void;
}

export const GameLauncherModal: React.FC<GameLauncherProps> = ({
  gameUrl,
  gameTitle,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Barra superior de control y retorno a la plataforma */}
      <header className="flex h-12 items-center justify-between px-4 bg-zinc-900 text-white border-b border-zinc-800">
        <span className="font-semibold text-sm">{gameTitle}</span>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-700 transition"
        >
          Cerrar Juego
        </button>
      </header>

      {/* Contenedor relativo para iframe y loader */}
      <div className="relative flex-1 w-full h-full">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm">Cargando juego...</p>
          </div>
        )}

        <iframe
          src={gameUrl}
          title={gameTitle}
          className="w-full h-full border-0"
          allow="fullscreen; autoplay; screen-wake-lock"
          allowFullScreen
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
};
```

---

## 5. Optimizaciones de Red y Rendimiento (Zero Latency)

1. **Preconnect y DNS-Prefetch**:
   Añadir en el `<head>` del cliente para agilizar la resolución TLS de los servidores de juego y CDN:
   ```html
   <link rel="preconnect" href="https://luckybet.site" crossorigin />
   <link rel="dns-prefetch" href="https://luckybet.site" />
   <link rel="preconnect" href="https://cdn.cdnpin.com" crossorigin />
   ```

2. **Detección de Móvil**:
   Evaluar `window.matchMedia('(max-width: 768px)').matches` o User-Agent en el cliente para enviar `mobile: 1` al solicitar la apertura, asegurando que el proveedor sirva la versión adaptada a pantallas táctiles.

3. **Arquitectura BFF (Backend for Frontend)**:
   Se recomienda intermediar la llamada a `gameOpen` a través del backend en NestJS para no exponer las credenciales y permitir auditoría y seguimiento en tiempo real de misiones.
