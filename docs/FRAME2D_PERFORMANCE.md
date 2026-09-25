# Rendimiento inicial Frame2D Rust/WASM

Fecha: 2026-09-25. Estado: medicion inicial, no calificacion general de escala.

## Reproduccion

Ejecutar `bun run test:frame2d-performance` desde la raiz. Requiere el artefacto
WASM compilado en `structural_kernel/pkg`. El resultado completo se genera en
`test-results/frame2d-performance.json`, con hash SHA-256 del WASM, entradas y
salidas, entorno, muestras crudas, diagnosticos y memoria. Cada ejecucion reemplaza
ese informe local; esta tabla conserva la primera medicion de referencia.

## Metodologia

- Cuatro procesos Node independientes, uno por tamano. Reticulas planas rigidas
  de 4x5, 10x10, 10x25 y 20x25 nudos, incluyendo la fila de bases empotradas.
- Vanos de 5 m, alturas de 3 m, E=30 GPa, G=12.5 GPa, A=0.06 m2,
  I=0.00045 m4 y factor de corte 5/6. Cada nudo no basal recibe Fx=10 N y Fy=-100 N.
  Son modelos sinteticos de rendimiento, no edificios dimensionados.
- Una primera resolucion y siete repeticiones por proceso. Se registra la
  inicializacion aparte. Tiempo de llamada WASM incluye parseo interno, solver,
  estimador de condicionamiento, deformadas y serializacion de salida. Excluye
  serializacion JS de entrada, parseo JS de salida y comprobaciones posteriores.
- Todas las repeticiones deben producir el mismo hash de salida. Se comprueban
  respuestas nodales finitas, dimensiones del resultado, residuo/tolerancia <=1
  y equilibrio global Fx/Fy/Mz con tolerancia 1e-5 + 1e-7*suma absoluta de terminos.
  Estas comprobaciones no sustituyen las referencias mecanicas independientes.
- Modelos de 501 nudos y 5001 barras deben devolver KERNEL_INVALID_REQUEST.
  El caso de 5001 barras es exclusivamente una prueba de rechazo de entrada.
- Timeout de 120 s por proceso; error, fallo numerico o timeout impiden emitir
  un informe exitoso. No se imponen limites de tiempo fragiles como test de CI.

## Primera medicion

Windows x64, Node v24.19.0, Intel Core i7-12700KF.
WASM SHA-256: `c9f5811354f513f8ea27ae8860e484a1e60c2984fbe5e03f9c4a16ed6c17c6d6`.

| Nudos | Barras | GDL libres | Primera (ms) | Mediana repeticiones (ms) | WASM final (MiB) | Pico RSS proceso (MiB) |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | 28 | 48 | 7.09 | 0.44 | 1.31 | 55.98 |
| 100 | 171 | 270 | 10.90 | 2.12 | 1.88 | 59.51 |
| 250 | 456 | 720 | 16.29 | 4.27 | 3.38 | 63.10 |
| 500 | 936 | 1440 | 27.50 | 8.61 | 5.81 | 71.39 |

Los 32 calculos pasaron equilibrio, determinismo y diagnosticos. Ambos rechazos
por exceso de limites fueron confirmados. En el mayor caso, la salida JSON pesa
1,266,652 bytes, frente a 253,058 bytes de entrada: interesa medir el costo de
transferencia, parseo y presentacion, no solamente el calculo.

## Interpretacion y pendientes

Memoria WASM significa capacidad de memoria lineal, no asignaciones vivas ni
pico exacto del solver. RSS incluye runtime, inicializacion y validacion.
Los snapshots de heap no son picos; no se fuerza recoleccion de basura. Tampoco
deben sumarse campos de memoria que puedan solaparse. Siete repeticiones de una
sola sesion no definen un SLA ni demuestran ausencia de fugas.

No se cambio Rust, el motor activo ni los limites de 500 nudos / 5000 barras.
Se midio hasta 936 barras: no se ha calificado una solucion con 5000 barras.
El costo del estimador esta incluido, pero no aislado mediante perfilado.
Esta medicion Node no compara la velocidad TS/Rust ni incluye latencia del Worker;
las mediciones posteriores cubren el recorrido en navegador.

## Recorrido real por Worker en Chrome

Medicion: 2026-09-25, Chrome Headless 154 en Windows x64. Ejecutar
`bun run test:frame2d-worker-performance`. La prueba crea una pagina aislada,
compila el Worker de produccion y usa `Frame2dKernelClient`. Cada caso mide una
primera llamada y seis llamadas secuenciales adicionales con el mismo Worker.
Los datos crudos quedan en `test-results/frame2d-worker-performance.json`.

| Nudos | Barras | Entrada (bytes) | Respuesta (bytes) | Primer recorrido (ms) | Mediana recorridos calientes (ms) |
| --- | --- | --- | --- | --- | --- |
| 20 | 28 | 8,040 | 39,328 | 28.3 | 1.0 |
| 100 | 171 | 46,759 | 236,562 | 5.0 | 4.1 |
| 250 | 456 | 123,729 | 615,680 | 8.7 | 8.8 |
| 500 | 936 | 253,019 | 1,262,488 | 20.1 | 18.8 |

La llamada caliente de 500 nudos vario de 17.8 a 20.4 ms en seis muestras.
Los resultados numericos fueron identicos entre repeticiones, excluyendo los
identificadores/revisiones de transporte. Respuestas, tamaños y diagnosticos
fueron validados por `Frame2dKernelClient`; no hubo errores de pagina.

El cronometro abarca serializacion/validacion JS de entrada, clon estructurado,
Worker, WASM y carga fria cuando corresponde, resolucion, conversion JSON,
clon de respuesta, validacion del cliente y entrega de la promesa. Asi, la
primera llamada no es comparable directamente con las calientes. La salida de
500 nudos ronda 1.26 MB y domina mas que la entrada.

Se registro tambien el intervalo maximo de `requestAnimationFrame` durante cada
lote: 57.7, 66.7, 31.7 y 16.8 ms respectivamente. Son observaciones de una pagina
aislada en Chrome headless, sensibles al arranque y planificacion del navegador;
no son una medicion de fluidez de la interfaz real ni se usan como criterio de
aprobacion. No se mide memoria privada del Worker mediante una API fiable.

Esta prueba confirma que la llamada se procesa mediante un Worker real y mide
su ida y vuelta para estos modelos sinteticos. No mide interaccion durante
edicion/modelado, rendimiento en moviles, memoria del Worker ni un SLA. Las
secciones posteriores cubren la sesion integrada y el ensayo sostenido.

### Ensayo sostenido del Worker

En la misma sesion de Chrome, el modelo de 500 nudos / 936 barras se resolvio
60 veces mas en el mismo Worker. Las medianas por bloques de diez fueron
17.7 / 15.6 / 15.3 / 15.1 / 15.3 / 14.9 ms; mediana general 15.2 ms y p95
18.0 ms. Hashes de respuesta numerica constantes; el intervalo RAF maximo
observado fue 16.8 ms en esta corrida.

No aparece una degradacion de latencia durante estos 60 casos; de hecho, los
ultimos bloques fueron algo mas rapidos. Esta muestra corta no prueba ausencia
de fuga de memoria porque no se pudo observar memoria privada del Worker.
Tampoco replica el uso concurrente de la interfaz real ni sesiones prolongadas.
El detalle de los 60 tiempos individuales y hashes se conserva en el JSON de
la corrida. Se mantiene pendiente memoria de Worker y prueba en sesion de app.

## Analisis integrado en ARM-Structural

Se midio la compilacion de produccion con Chrome Headless 154 a 1440x900.
Ejecutar la app local y despues `bun run test:analysis-integrated-performance`
(`APP_URL` permite cambiar la URL). El navegador registra, sin modificar la
app, el clic, envio al Worker, recepcion en el hilo principal, cambio del DOM y
siguiente cuadro de animacion. Se ensayan el voladizo y el ejemplo de oficinas
de 8 niveles, primero con el motor activo TS y luego con la comparacion Rust.
Cada fase se mide una vez por sesion; se hicieron tres sesiones por version.
La ultima sesion se guarda en `test-results/analysis-integrated-performance.json`.

| Ejemplo / fase | Antes: Worker (ms) | Antes: recepcion a DOM (ms) | Despues: Worker (ms) | Despues: recepcion a DOM (ms) | Antes/despues: clic a cuadro (ms) |
| --- | --- | --- | --- | --- | --- |
| Oficinas, calculo TS | 189.4 | 10.7 | 187.1 | 10.8 | 216.0 / 216.9 |
| Oficinas, contraste Rust | 10.3 | 39.1 | 11.7 | 19.0 | 59.9 / 41.4 |

Los valores son medianas de tres sesiones. En el contraste Rust, los tiempos
desde recepcion hasta DOM fueron 39.1/38.4/39.8 ms antes y 18.9/19.0/22.6 ms
despues. El calculo TS y el contraste Rust son operaciones diferentes; los
tiempos de Worker no deben interpretarse como comparacion directa entre solvers.
La primera comparacion Rust del voladizo incluye arranque/carga inicial del
Worker; la de oficinas reutiliza el Worker ya cargado.

El perfil complementario `bun run test:analysis-stage-profile` usa el mismo
ejemplo de 103 nudos y 136 barras, con 15,714 filas de contraste. En Bun 1.2.4,
medianas de 30 muestras: conversion de entrada 0.36 ms, calculo de diferencias
2.17 ms, copia profunda del informe 10.78 ms y lectura tecnica 0.35 ms.
El informe crudo queda en `test-results/analysis-stage-profile.json`. Estas
etapas se midieron fuera de Chrome y sus medianas no se suman a la latencia UI.

La app publicaba el informe de comparacion al cambiar de pestana y otra vez al
terminar la solicitud. Ahora publica una sola vez tras finalizar. Las tablas
de comparacion cerradas tambien difieren el montaje de sus filas hasta abrirse.
Se conservan el resumen de cada seccion, paginacion de 50 registros, apertura
automatica de incongruencias y el informe exportado.

Verificaciones tras el cambio: build Next.js/TypeScript, seis pruebas de
comparacion y flujo real en Chrome, incluido abrir una seccion, paginarla y
cerrarla. El recorte de ~20 ms en recepcion a DOM para este modelo es una
observacion local, no un umbral aceptado de experiencia de usuario.

### Perfil del Worker TypeScript activo

La prueba integrada puede solicitar un perfil optativo al Worker TS. En una
sesion del ejemplo de oficinas (103 nudos, 136 barras), el recorrido inicial
del Worker tomo 194 ms, de los cuales 142.5 ms transcurrieron dentro de
`solveFrame`: validacion 0.8 ms, cargas 0.4 ms, construccion del dominio
1.0 ms, aplicacion de cargas 0.1 ms, `LinearStaticSolver.solve()` 122.6 ms,
recuperacion nodal 1.5 ms, recuperacion de barras 15.1 ms y comprobaciones
finales 1.0 ms. La diferencia de ~51.5 ms entre el recorrido y `solveFrame`
incluye arranque del Worker, clonacion de mensajes y planificacion; no se ha
aislado el costo de cada una de esas operaciones.

El mismo modelo se resolvio ocho veces en un Worker TS nuevo. La primera
llamada tomo 178.3 ms (135.7 ms en `solveFrame`). Las siete llamadas
posteriores tardaron entre 102.8 y 132.7 ms de ida y vuelta; la mediana fue
120.2 ms. En ellas, la resolucion lineal ocupo 92.6-120.6 ms y la
recuperacion de barras 7.6-10.0 ms. La reutilizacion evita parte del costo
de arranque, pero no elimina el trabajo dominante de `ts-fem`. Se trata de
una sesion local, no de un benchmark comparativo entre motores ni de un SLA.

Un perfil mas fino, obtenido en tres sesiones de Chrome sobre el Worker de
produccion, separa numeracion de grados de libertad, ensamblaje de matrices
y resto de `LinearStaticSolver.solve()`. En las llamadas iniciales de oficinas,
la numeracion tomo 0.3-0.4 ms, el ensamblaje 10.6-10.9 ms y el resto
111.0-114.9 ms. En las siete llamadas calientes de la ultima sesion, las
medianas respectivas fueron 0.1, 4.4 y 101.5 ms; la ida y vuelta mediana
fue 119.5 ms. El ultimo tramo incluye extraccion de submatrices, `lusolve`,
desplazamientos impuestos y reacciones: **no** es una medicion aislada de la
factorizacion LU. La prueba confirma que activar el perfil no altera el
resultado numerico y que la respuesta ordinaria conserva su formato.

El cliente de analisis TS actualmente crea un Worker por calculo y lo termina
al responder; reutilizarlo exigiria revisar cancelacion y cambios de modelo.
No se cambia ese ciclo de vida sobre la base de una sola sesion: primero hay
que confirmar la variacion en varias corridas y perfilar el solver lineal con
casos verificados. Tampoco se promueve Rust a motor principal antes de cerrar
la validacion mecanica independiente y la revision profesional pendiente.

### Muestras de CPU del Worker TS

`node tests/analysis-worker-cpu-profile.mjs` usa Chrome DevTools para muestrear
ocho resoluciones del mismo ejemplo de oficinas dentro del Worker empaquetado.
Escribe un resumen en `test-results/analysis-worker-cpu-profile.json` y el
perfil crudo en `test-results/analysis-worker-cpu-profile.raw.json`. La corrida
de referencia obtuvo 2.040 muestras a intervalo solicitado de 100 us; las
ocho llamadas tardaron entre 109.0 y 152.9 ms de ida y vuelta.

Las mayores agrupaciones de tiempo propio muestreado corresponden a `th`
(despacho de funciones tipadas de mathjs, 323 ms acumulados), `e_`
(multiplicacion escalar, 173 ms) y `d` (descomposicion LU densa con pivoteo,
155 ms). La identificacion se hizo con la ubicacion de cada marco dentro del
bundle minificado y el codigo fuente instalado de mathjs; esos nombres no son
API estable. Incluye arranque/JIT, pausas y ocho calculos; los tiempos propios
no son porcentajes exactos del tiempo de pared ni se deben sumar como fases.
En conjunto, las muestras son compatibles con el costo dominante de las
operaciones aritmeticas genericas de mathjs durante la factorizacion densa.
Para cuantificar cuanto se ganaria con otra implementacion hacen falta una
comparacion de algoritmos equivalentes, referencias mecanicas independientes
y mediciones en varios tamanos/equipos.

Pendientes de rendimiento: comparar algoritmos/implementaciones de resolucion
con matrices equivalentes y resultados verificados; medir memoria privada de
Workers y latencia durante edicion real, en mas equipos y modelos densos.

## Contraste controlado de API entre motores

`bun run test:frame2d-controlled-comparison` usa los mismos modelos fisicos y
factores de carga de voladizo, viga biapoyada y oficinas de 8 niveles. Antes de
medir exige paridad de respuesta y deformada entre los dos motores. Prepara la
entrada Rust una vez, hace cinco calentamientos y dieciseis pares alternados.
El informe conserva muestras crudas, hash del WASM y tamanos de salida en
`test-results/frame2d-controlled-comparison.json`. Las tres comparaciones
pasaron: en oficinas, 10.002 componentes de respuesta y 5.712 de deformada.

En Bun 1.2.4 / i7-12700KF, medianas de API completas (ms):

| Caso | TS `solveFrame` | Rust WASM + JSON |
| --- | ---: | ---: |
| Voladizo, 2 nudos / 1 barra | 0.803 | 0.082 |
| Biapoyada, 2 nudos / 1 barra | 0.683 | 0.066 |
| Oficinas, 103 nudos / 136 barras | 550.8 | 3.25 |

En Chrome, el ensayo integrado de oficinas capturo los dos Workers reales:
tras cinco calentamientos y dieciseis solicitudes alternadas por motor, la
mediana de ida y vuelta fue 282.4 ms para TS y 7.3 ms para Rust en una sesion.
La salida TS rondo 474 kB y la Rust 212 kB. **No** se trata de una medicion de
factorizacion sobre matrices identicas: TS ejecuta validacion, cargas, LU densa
y recuperacion de 20 estaciones; Rust recibe una entrada ya convertida y
ejecuta parseo, Cholesky disperso, estimacion de condicionamiento, deformadas
y serializacion. Bun y Chrome muestran ademas latencias TS muy distintas; no
es valido extrapolar los cocientes de Bun a la app.

Una serie diagnostica de dieciseis llamadas TS ordinarias en un Worker nuevo
paso de unos 104-150 ms en las primeras diez a 267-331 ms en las seis finales.
En otra serie con muestreo de CPU y heap, el salto aparecio desde la llamada
trece: 115-136 ms antes y 304-373 ms despues. El heap usado cayo de 33.8 a
3.0 MiB tras una recoleccion, sin recuperar la latencia; no basta atribuir
el salto a una unica pausa de GC. La causa precisa (JIT, gestion de memoria u
otro efecto de runtime) sigue abierta. El cliente de produccion ya termina el
Worker tras cada calculo; estos ensayos **desaconsejan asumir** que conservarlo
mejoraria el rendimiento sostenido. No demuestran una fuga ni un SLA.

Antes de sustituir el motor activo hacen falta referencias mecanicas
independientes adicionales, equivalencia del modelo analitico/BIM, comparacion
de matrices y condiciones de contorno, ensayos multimaquina y revision
profesional. Rust permanece como contraste optativo.

## Verificacion cruzada del sistema ensamblado

`bun run test:frame2d-cross-residual` ensambla la matriz completa `K` y el
vector de cargas con la API real de `ts-fem`, sin usar la solucion TS para
comprobar las ecuaciones. Convierte desplazamientos y giros calculados por
Rust a los signos de `ts-fem`, evalua `K u - f` en cada grado libre y contrasta
el mismo residuo con las reacciones Rust en los grados restringidos. Comprueba
tambien simetria y finitud de `K`, cantidad de grados libres y paridad normal
de respuestas y deformadas.

Pasaron siete casos: voladizo, biapoyada, barra inclinada, portico, viga
continua con liberacion rotacional, portico de rigideces heterogeneas y el
ejemplo de oficinas de ocho niveles. En total: 10.863 componentes de respuesta
y 6.174 de deformada; el mayor cociente residuo/tolerancia de una ecuacion
libre fue 0.00000236 y el mayor error de reaccion 4.55e-13 en unidades de la
app. En oficinas fueron 288 grados libres, 21 restringidos y 1.907 entradas
no nulas de la matriz completa. El informe reproducible queda en
`test-results/frame2d-cross-residual.json`, con hash del WASM ensayado.

Esto demuestra que, en esos modelos, la solucion Rust satisface el sistema
ensamblado por TS y reproduce sus reacciones. **No** demuestra que cada
coeficiente de la matriz que ensambla Rust sea identico al de TS; sistemas
distintos pueden compartir solucion para una carga concreta. Falta comparar
matrices/cargas directamente con varios patrones de carga y restricciones.
El ensayo usa el artefacto WASM existente; en esta sesion no se encontro
`cargo`, por lo que no se recompilo ni valido codigo fuente Rust nuevo. No
quedo ningun cambio de fuente Rust pendiente de compilar.
