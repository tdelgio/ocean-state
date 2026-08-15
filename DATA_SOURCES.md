# Ocean State — fuentes de datos

Este documento es la referencia única para las fuentes ambientales de Ocean State. Explica qué usamos, para qué sirve cada fuente, cuánto confiar en ella y qué debe ver el usuario.

> Ocean State ayuda a interpretar condiciones, pero no reemplaza avisos oficiales, criterio local ni una evaluación de seguridad en el lugar. Una observación describe un punto; un modelo o forecast describe un área y puede no capturar aceleraciones, sombra de viento, refracción, corrientes costeras o cambios rápidos.

## Resumen operativo

| Fuente | Tipo | Uso principal | Confianza operativa | Estado en el producto |
| --- | --- | --- | --- | --- |
| NOAA/NWS Coastal Waters Forecast (CWF) | Pronóstico oficial por zona | Viento, ráfagas, mar combinado, swell y tiempo en aguas costeras/canales | Alta para el panorama de zona; media para un punto exacto | Integrado en `src/lib/ocean/marine.ts`; existe además un pipeline anterior con parsers `TODO` |
| NWS Alerts | Avisos oficiales | Warnings, watches y advisories terrestres y marinos activos | Muy alta para saber si hay un aviso oficial; no mide la condición local | Integrado vía `api.weather.gov/alerts/active` |
| NDBC buoys | Observación instrumental | Viento, ráfagas, altura/periodo/dirección de ola, temperatura y espectro | Alta cuando el dato es reciente y pasa QC; representatividad depende de ubicación | Integrado, con fallbacks explícitos |
| METAR PHOG | Observación aeroportuaria | Viento real cerca de Kahului/Kanaha | Alta para el aeropuerto; media para costa/agua cercana | Integrado para Kanaha; NWS grid como fallback |
| PacIOOS ROMS | Modelo oceánico | Velocidad y dirección de corriente superficial | Media; útil como guía espacial, no como medición in situ | Integrado mediante ERDDAP |
| NWS Surf Zone Forecast (SRFHFO) | Pronóstico oficial narrativo y por costa | Rango de surf, swell dominante, tendencia y peligros por orientación de costa | Alta para tendencia regional; media/baja para un spot exacto | Fetch conectado, parser de Maui todavía `TODO`; no presentarlo como live estructurado |

## 1. NOAA/NWS marine forecast

**Fuente oficial:** Coastal Waters Forecast de NWS Honolulu (CWFHFO), incluyendo las zonas PHZ116–PHZ121 relevantes para Maui Nui. Referencias: [NWS Honolulu marine warnings and zone feeds](https://www.weather.gov/hfo/marineww), [NWS zone forecasts](https://www.weather.gov/hfo/zone).

### Qué usamos

- Dirección y velocidad del viento y ráfagas cuando están presentes.
- Altura de mares combinados.
- Altura, dirección y periodo de swell cuando el texto los informa.
- Lluvia/tiempo y resumen narrativo.
- Zonas principales: PHZ117 Maui County Windward Waters, PHZ118 Maui County Leeward Waters, PHZ120 Pailolo Channel, PHZ116 Kaiwi Channel y PHZ121 Alenuihaha Channel.

### Para qué

- Contexto oficial para las próximas jornadas.
- Forecast de aguas windward/leeward y canales.
- Evaluar exposición general antes de combinar con observaciones puntuales.

### Confiabilidad y límites

**Alta para la situación sinóptica y la zona; media para una ruta o launch específico.** Es un producto oficial editado por meteorólogos, pero una zona marina es extensa. No debe convertirse en una supuesta lectura exacta del launch. El viento acelerado en canales, la sombra de Haleakalā y West Maui, y la topografía costera pueden producir diferencias fuertes dentro de la misma zona.

### Qué mostramos al usuario

- Nombre humano de la zona y código PHZ en detalle.
- Viento/rangos, ráfagas, mares, swell y resumen.
- Hora de emisión/observación, hora de fetch y estado `live`, `stale`, `missing` o `mock`.
- Enlace al producto oficial.
- Etiqueta **Zone forecast**, nunca **Current conditions**.

## 2. NWS alerts

**Fuente oficial:** [NWS API](https://www.weather.gov/documentation/services-web-api) y [Alerts Web Service](https://www.weather.gov/documentation/services-web-alerts). El código consulta la zona terrestre/county correspondiente y las zonas marinas PHZ116–PHZ121.

### Qué usamos

- Evento, headline, severidad, descripción, vigencia y expiración.
- Avisos activos aplicables a Maui y aguas cercanas: por ejemplo Small Craft Advisory, High Surf Advisory/Warning, gale o eventos tropicales cuando NWS los emite.

### Para qué

- Elevar un peligro oficial por encima de cualquier score interno.
- Dar al usuario el texto y el acceso directo a la autoridad emisora.

### Confiabilidad y límites

**Muy alta como fuente de avisos oficiales.** La ausencia de alerta no significa que las condiciones sean seguras. Un aviso cubre un área y un periodo; tampoco reemplaza la evaluación del usuario en el lugar.

### Qué mostramos al usuario

- Banner prioritario con evento, severidad y vencimiento.
- Descripción resumida, zona afectada y enlace oficial.
- Nunca degradar silenciosamente una alerta por un score favorable.
- Si la consulta falla, mostrar **Alerts unavailable**, no **No alerts**.

## 3. NDBC buoys

**Fuente oficial:** NOAA National Data Buoy Center. Ocean State consume archivos HTTPS de realtime y espectro. NDBC explica que realtime contiene los últimos 45 días y que pasó controles automáticos de calidad: [Realtime data access](https://www.ndbc.noaa.gov/faq/rt_data_access.shtml), [measurement descriptions](https://www.ndbc.noaa.gov/faq/measdes.shtml).

### Qué usamos

- Viento y ráfagas, dirección verdadera.
- Altura significativa, periodo dominante, dirección media de ola y temperatura del agua cuando existen.
- Espectro para separar energía corta (**bump/wind swell**) de energía larga (**groundswell**).
- Estaciones usadas/configuradas: 51205 Pauwela, 51213 Lanai Offshore, 51001 Open Ocean NW, 51000 Northern Hawaii, 51002 Southwest Hawaii, 51004 Southeast Hawaii, 51WH0 WHOTS Offshore North y KLIH1 Kahului Harbor.

### Para qué

- Validar qué está ocurriendo ahora, antes de confiar en el forecast.
- Detectar llegada de swell y cambio de periodo/energía.
- Comparar condiciones offshore, north shore y harbor.

### Confiabilidad y límites

**Alta si la observación es reciente.** Es medición instrumental, pero puede faltar, quedar stale o no representar una costa protegida. Una boya offshore no es una medición del tamaño rompiente en playa: batimetría, refracción, dirección y periodo transforman el oleaje. El realtime tiene QC automático; no equivale al QC final del archivo histórico.

### Qué mostramos al usuario

- Nombre y station ID.
- Valor, unidad, dirección y `observedAt`.
- Edad del dato y badge de frescura.
- Distinción visual entre observación real y fallback/mock.
- Para olas: **buoy wave height**, no **surf height**.
- Si usamos particiones espectrales derivadas, etiquetarlas como **Derived from NDBC spectrum**.

## 4. METAR

**Fuente oficial:** AviationWeather.gov Data API, endpoint `/api/data/metar`; documentación: [AviationWeather Data API](https://aviationweather.gov/data/api/).

### Qué usamos

- METAR de PHOG (Kahului Airport): dirección, velocidad y ráfaga del viento.
- Tiempo de observación y reporte crudo como trazabilidad.

### Para qué

- Viento observado cerca de Kahului/Kanaha.
- Confirmación local frente al forecast NWS.
- Prioridad para el perfil nearshore de Kanaha; si no está disponible, se usa el grid horario NWS como forecast proxy.

### Confiabilidad y límites

**Alta para el aeródromo; media para la costa y el agua.** METAR es una observación aeronáutica de superficie, no una boya. Edificios, pista, distancia al agua y régimen local pueden hacer que el viento sobre el océano sea diferente. PHOG no debe reutilizarse como lectura de Kahului Harbor sin aclaración.

### Qué mostramos al usuario

- **Kahului Airport (PHOG) observation**.
- Viento, ráfaga, dirección, edad y enlace al METAR.
- Nota corta: **Airport observation; water conditions may differ**.
- Nunca llamar “live” a un METAR que exceda el umbral de frescura definido.

## 5. PacIOOS

**Fuente oficial:** PacIOOS Regional Ocean Modeling System (ROMS), servido por ERDDAP. Es un forecast de 7 días cada 3 horas, aproximadamente 4 km, con asimilación de observaciones en el nowcast: [dataset ROMS Main Hawaiian Islands](https://pae-paha.pacioos.hawaii.edu/erddap/griddap/roms_hiig.html), [descripción del modelo](https://www.pacioos.hawaii.edu/currents/model-hawaii/).

### Qué usamos

- Componentes `u` y `v` en superficie.
- Velocidad en knots y dirección calculadas en puntos de Maliko, Pailolo, Kaiwi y Alenuihaha.

### Para qué

- Orientación de corriente superficial para rutas y canales.
- Contexto donde no hay una estación de corriente in situ adecuada.

### Confiabilidad y límites

**Media.** Es una simulación, no una observación. La resolución aproximada de 4 km no resuelve todos los jets, remolinos, corrientes de borde, mareas locales ni efectos pegados a costa. PacIOOS advierte que, como cualquier forecast, no puede garantizar precisión. Además, el código actual marca el resultado como `stale` aunque sea la última salida; conviene renombrar el estado a `forecast/model` en una evolución del esquema.

### Qué mostramos al usuario

- **PacIOOS ROMS model current**, punto consultado y hora válida del modelo.
- Velocidad/dirección con precisión razonable (evitar falsa exactitud).
- Badge **Model**, nunca **Observed** o **Live current meter**.
- Nota: **Modeled surface current; local flow may differ**.

## 6. Surf report / NWS Surf Zone Forecast

**Fuente oficial:** SRFHFO, [Surf Forecast for the State of Hawaii](https://www.weather.gov/hfo/SRF) y [producto de texto NWS](https://forecast.weather.gov/product.php?issuedby=HFO&product=SRF&site=HFO).

### Qué queremos usar

- Rangos de surf por costa (north, west, south, east) para Maui.
- Swell dominante, dirección/periodo cuando se informa.
- Tendencia narrativa, timing de llegada/pico/declive y umbrales de advisory.

### Para qué

- Traducir el estado offshore a impacto costero esperado.
- Dar contexto humano que una sola boya no captura.
- Complementar —no duplicar— los High Surf Advisories de NWS Alerts.

### Confiabilidad y límites

**Alta para tendencia regional y orientación de costa; media o baja para un spot.** Los rangos son forecast, no lectura en playa. Un spot puede diferir por bathymetry, exposición, wrap, tide y viento local.

### Estado actual y qué mostramos

El fetch existe, pero `parseNwsSurfForecast()` devuelve una lista vacía y está marcado `TODO`. Hasta implementar y probar el parser:

- No mostrar rangos estructurados como si fueran live.
- Se puede mostrar un enlace **Official NWS surf forecast** y, si se presenta texto, etiquetarlo como producto oficial sin valores inventados.
- Los valores mock del pipeline anterior deben llevar badge **Mock/demo**.

## Jerarquía para decisiones

1. **NWS Alerts:** peligro oficial; siempre visible y prioritario.
2. **Observaciones recientes (NDBC/METAR):** qué está ocurriendo en estaciones concretas.
3. **Forecast oficial CWF/NWS:** evolución esperada por zona.
4. **PacIOOS ROMS:** guía modelada para corrientes y estructura espacial.
5. **Datos derivados por Ocean State:** scores, particiones y recomendaciones; deben mostrar de qué fuentes provienen.
6. **Mock/fallback:** sólo para continuidad visual o desarrollo; nunca indistinguible de datos reales.

No se deben promediar ciegamente fuentes que miden cosas distintas. Una boya offshore, un aeropuerto, una zona marina y un modelo de 4 km son complementarios, no intercambiables.

## Contrato de presentación al usuario

Cada dato visible debería incluir o permitir abrir:

- **Fuente:** NOAA/NWS, NDBC, AviationWeather/METAR o PacIOOS.
- **Tipo:** Observation, Official forecast, Official alert, Model o Derived.
- **Lugar:** nombre humano y station/zone ID.
- **Tiempo:** `observedAt` o tiempo válido, más edad; `fetchedAt` sólo como diagnóstico.
- **Estado:** live/fresh, stale, missing, error o mock.
- **Unidad y semántica:** kt, ft, sec, grados true; aclarar buoy wave versus breaking surf.
- **Enlace oficial.**

Reglas mínimas:

- `missing/error` no se transforma en cero.
- `mock` nunca participa silenciosamente en una recomendación real.
- Un fallback conserva el nombre de su fuente real; por ejemplo, NWS forecast proxy no se presenta como METAR.
- Si la edad supera el umbral de la fuente, el badge cambia a **Stale**.
- Una recomendación debe bajar su `dataConfidenceScore` cuando faltan observaciones críticas.

## Frescura recomendada

Estos umbrales son reglas de producto, no garantías del proveedor:

| Fuente | Fresh | Stale | Acción |
| --- | --- | --- | --- |
| NWS Alerts | consulta exitosa en los últimos 5 min | > 10 min o error de refresh | Mantener último aviso visible con edad; mostrar indisponibilidad |
| NDBC / METAR | observación ≤ 30 min | > 30 min; crítica > 90 min | Atenuar y excluir de afirmaciones “now” |
| NWS hourly/CWF | emisión/actualización ≤ 3 h | > 6 h | Mostrar edad y reducir confianza |
| PacIOOS ROMS | hora válida dentro de la corrida vigente | corrida retrasada o tiempo fuera de rango | Badge Model stale; no extrapolar |
| SRFHFO | producto vigente del ciclo actual | reemplazado o > 12 h sin actualización | Mostrar enlace/edad; no rellenar con mocks |

## Deuda técnica identificada

- Implementar y testear el parser de Maui de `src/lib/sources/nwsSurf.ts`.
- Retirar o consolidar el pipeline anterior de `src/lib/report/generateMauiReport.ts`, que todavía mezcla mocks con fuentes reales.
- Consolidar `src/lib/sources/*` y `src/lib/ocean/*` para evitar dos estados distintos de una misma fuente.
- Añadir `sourceUrl` a NWS Alerts y diferenciar explícitamente `forecast`/`model` en `DataSourceStatus`.
- Definir umbrales de frescura en código compartido y aplicarlos de forma uniforme.
- Hacer que el usuario vea **Alerts unavailable** cuando falla el endpoint, en lugar de confundir una falla con cero alertas.

## Archivos de implementación relacionados

- `src/lib/ocean/marine.ts` — CWF y canales.
- `src/lib/ocean/nws.ts` — forecast horario, proxies y alerts.
- `src/lib/ocean/ndbc.ts` — observaciones y espectro NDBC.
- `src/lib/ocean/metar.ts` — PHOG METAR.
- `src/lib/ocean/pacioos.ts` — corriente superficial ROMS.
- `src/lib/sources/nwsSurf.ts` — SRFHFO, parser pendiente.
- `src/lib/ocean/types.ts` — metadata, estados y contratos.

Última revisión documental: 2026-08-14.
