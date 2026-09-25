# BAS-01 | Encargo de calculo independiente

**Objeto:** viga biapoyada idealizada, de un vano, sometida a carga uniforme.
**Version del caso:** 1.0, 25-09-2026. **Unidades de entrega:** m, kN, kN/m, kN m y mm.

Este documento contiene solo datos de entrada y entregables solicitados. Los
resultados obtenidos por ARM-Structural no se proporcionan antes de recibir el
informe independiente.

## Geometria y ejes

- Barra recta horizontal, longitud entre ejes de apoyo `L = 6.000 m`.
- Seccion rectangular constante: ancho `b = 0.300 m`, peralte `h = 0.500 m`.
- Area `A = 0.150 m2`; inercia para flexion en el plano `I = 0.003125 m4`.
- Eje global `x` hacia la derecha; eje global `y` hacia arriba. Nudo A en
  `(0, 0) m`, nudo B en `(6, 0) m`.

```text
       q = 10.000 kN/m hacia abajo, en toda la luz
       v v v v v v v v v v v v v v v v v v v v
       =======================================
       A                                     B
       apoyo articulado                      apoyo movil vertical
       ux = uy = 0                          uy = 0; ux libre
       giro libre                            giro libre
                  <------ 6.000 m ------>
```

## Material y modelo de calculo

- Modulo de elasticidad `E = 25 000 MPa`.
- Coeficiente de Poisson `nu = 0.20`; obtener `G = E/[2(1+nu)]`.
- Factor de correccion de corte `kappa = 5/6` para el modelo Timoshenko.
- Comportamiento lineal elastico, primer orden, deformaciones pequenas.
- Una sola barra prismatica 2D. No hay excentricidades, brazos rigidos,
  diafragmas ni conexiones semirrigidas.
- Carga vertical uniformemente distribuida `q = 10.000 kN/m` hacia abajo,
  aplicada a lo largo de la barra como caso de carga independiente.
- **Excluir** peso propio, cargas puntuales, acciones horizontales, sismo,
  temperatura, asentamientos y factores de mayoracion. Los desplazamientos
  iniciales son cero.

## Entregables solicitados al revisor

1. Esquema de equilibrio y convencion de signos empleada.
2. Reacciones `Ax`, `Ay`, `By` y verificacion de equilibrio global de fuerzas
   y momentos.
3. Funciones y diagramas de cortante `V(x)` y momento `M(x)` para `0 <= x <= L`.
   Informar valores en `x = 0, 1.5, 3.0, 4.5 y 6.0 m`, aclarando el lado del
   corte en los apoyos.
4. Momento maximo, su ubicacion y fuerzas axiales en la barra.
5. Desplazamiento vertical en el centro (`x = 3.0 m`), separando contribucion
   por flexion y por corte Timoshenko. Si se usa Euler-Bernoulli, reportar
   tambien esa solucion y explicar la diferencia de modelo.
6. Giro de seccion y desplazamientos en los extremos segun su convencion.
7. Hipotesis, formulas o herramienta independiente utilizada, precision
   numerica, unidades y cualquier discrepancia o ambiguedad detectada.
8. Nombre, especialidad, numero CIP, condicion de habilitacion, fecha y firma
   del responsable si el informe se emitira como revision profesional formal.

No se solicita dimensionamiento, verificacion de capacidad, armado ni
declaracion de cumplimiento del RNE. BAS-01 es exclusivamente un ensayo de
respuesta mecanica idealizada. Si algun dato de entrada necesita aclaracion,
el revisor debe indicarlo antes de calcular en lugar de suplirlo tacitamente.
