# BAS-01 | Informe interno de referencia y comparacion

**Estado:** referencia tecnica de software; no es dictamen ni certificacion
profesional. **Fecha:** 25-09-2026. **No enviar este archivo al revisor antes
de recibir su calculo independiente.** El pliego de entrada esta en
`docs/BAS-01_ENCARGO_REVISION_INDEPENDIENTE.md`.

## Modelo ensayado

Viga de `L = 6 m`, `b = 0.30 m`, `h = 0.50 m`, apoyo articulado en A y rodillo
vertical en B. Carga uniforme descendente `q = 10 kN/m`. Peso propio excluido.
`E = 25 000 MPa = 25 000 000 kN/m2`, `nu = 0.20`, `kappa = 5/6`.

| Propiedad derivada | Valor |
| --- | ---: |
| Area `A = b h` | 0.150 m2 |
| Inercia `I = b h^3 / 12` | 0.003125 m4 |
| Modulo de corte `G = E/[2(1+nu)]` | 10 416 666.6667 kN/m2 |
| Rigidez a flexion `EI` | 78 125 kN m2 |
| Rigidez de corte `kappa G A` | 1 302 083.3333 kN |

## Referencia analitica independiente

Equilibrio global: `qL = 60 kN`, `Ax = 0`, `Ay = By = qL/2 = 30 kN`.
Con momento positivo flector y cortante segun la cara izquierda:

```text
V(x) = 30 - 10x             [kN]
M(x) = 30x - 5x^2           [kN m], 0 <= x <= 6 m
Mmax = qL^2/8 = 45 kN m     en x = 3 m
N(x) = 0                   [kN]
```

| `x` (m) | `V(x)` (kN) | `M(x)` (kN m) |
| ---: | ---: | ---: |
| 0.0 | +30 | 0 |
| 1.5 | +15 | +33.75 |
| 3.0 | 0 | +45 |
| 4.5 | -15 | +33.75 |
| 6.0 | -30 | 0 |

En los extremos, el cortante tabulado es el limite **dentro de la barra**;
el salto por la reaccion del apoyo lleva el diagrama exterior a cero.

Flecha central descendente con deformacion por flexion y corte:

```text
delta_flexion = 5 q L^4 / (384 EI)       = 2.16000 mm
delta_corte   = q L^2 / (8 kappa G A)    = 0.03456 mm
delta_total   = delta_flexion + delta_corte = 2.19456 mm
uy(L/2) = -2.19456 mm con y positivo hacia arriba
```

La solucion Euler-Bernoulli (`2.16000 mm`) omite el termino de corte. Esa
diferencia de `0.03456 mm` es esperable y **no** indica por si sola un error.
La teoria de Timoshenko incorpora rigidez de corte; esta separacion es
coherente con la formulacion universitaria de [Timoshenko en TU Delft]
(https://oit.tudelft.nl/Finite-Elements-in-CEG/main/structural_linear/Exercises/pyjive_timoshenko.html)
y la descripcion de [teoria de vigas de Jönköping University]
(https://mechanics.ju.se/SolidMechanics/BeamTheory.html).

## Resultados registrados por software

Ejecutado con `bun run test:basic-beam-review`. El JSON local queda en
`test-results/basic-beam-review.json`; contiene entrada, hashes de modelo y
WASM, resultados y comprobaciones de paridad.

| Magnitud | Referencia | TypeScript (`ts-fem`) | Rust/WASM |
| --- | ---: | ---: | ---: |
| Reaccion vertical A (kN) | +30.00000 | +30.00000 | +30.00000 |
| Reaccion vertical B (kN) | +30.00000 | +30.00000 | +30.00000 |
| Momento central (kN m) | +45.00000 | +45.00000 | concordante por paridad de diagrama |
| Flecha central `uy` (mm) | -2.19456 | -2.19456 | -2.19456 |

La comparacion automatica TS/Rust paso 81 componentes de respuesta y 42 de
deformada; la maxima diferencia de deformada fue `2.87e-18 m`. El residuo
global informado por TS fue cero para este caso. Rust informo 3 grados de
libertad resueltos y razon maxima de residuo/tolerancia `1.21e-7`.

Estas cifras verifican el caso definido, **no** la correccion general del
solver ni cumplimiento de E.020/E.030/E.060. La viga es un modelo idealizado;
no representa una seccion disenada ni un elemento listo para construir.

## Protocolo al recibir el informe del ingeniero

1. Confirmar que modelo, apoyos, carga y unidades coincidan con BAS-01. Si
   incluye peso propio o mayoraciones, separar ese resultado; no compararlo
   directamente.
2. Normalizar signos antes de contrastar diagramas y giros.
3. Comparar equilibrio, reacciones y momento. Para una calculadora o informe
   con tres decimales, diferencias de hasta `0.01 kN` y `0.02 kN m` permiten
   redondeo; una diferencia mayor requiere explicacion, no rechazo automatico.
4. Comparar flecha Timoshenko con `0.01 mm` como umbral de investigacion. Si
   el revisor uso Euler-Bernoulli, comparar su resultado con `2.16000 mm` y
   tratar el termino de corte por separado.
5. Registrar discrepancias, causa, documento/version revisados y dictamen del
   ingeniero. Ninguna tolerancia automatica reemplaza su juicio profesional.

**Pendiente:** adjuntar el informe independiente firmado, resolver eventuales
diferencias y documentar el alcance exacto que el revisor acepte validar.
