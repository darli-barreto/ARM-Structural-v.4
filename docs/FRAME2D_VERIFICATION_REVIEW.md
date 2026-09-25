# Revision tecnica del solver de porticos 2D

Fecha: 2026-09-25. Alcance: analisis elastico lineal estatico de barras Timoshenko en un plano, con 3 grados de libertad por nudo. Se revisaron el solver activo `ts-fem`, la conversion de unidades y signos, el kernel Rust/WASM y la recuperacion de deformadas. Esta es una verificacion tecnica del software; no constituye firma, colegiatura ni aprobacion de un proyecto estructural.

## Dictamen

**Apto para ensayos y comparacion controlada de porticos 2D dentro del alcance declarado. No apto aun como motor principal de diseno estructural de edificios.** Los ensayos independientes siguientes pasaron en ambos motores. Se requiere ampliar la matriz de validacion, verificar las idealizaciones BIM y someter los resultados a revision de un ingeniero responsable antes de promover el kernel.

## Casos independientes

Ejecutar `bun run test:frame2d-validation`. Cada fila contrasta por separado los resultados de ARM y Rust con la formula cerrada indicada; la paridad ARM/Rust es una comprobacion adicional. Longitudes en m, fuerzas en kN y desplazamientos en mm. Tolerancias programadas: desplazamientos 1e-11 a 1e-12 m segun el caso y reacciones 1e-8 kN. Son tolerancias de regresion para estos modelos pequenos, no tolerancias normativas universales.

| Caso | Datos y resultado cerrado | Resultado |
| --- | --- | --- |
| Voladizo axial | L=3, P=12, E=30e6 kN/m2, A=0.06 m2. `u=PL/EA=0.02000 mm`; reaccion horizontal `-12 kN`. | ARM y Rust coinciden. |
| Voladizo con par extremo | L=3, M=8 kN m horario, EI=13,500 kN m2. `theta=ML/EI=0.00177778 rad`; `uy=-ML2/(2EI)=-2.66667 mm`; momento de apoyo `-8 kN m`. | ARM y Rust coinciden. |
| Viga biapoyada con P central | L=6, P=10, EI=78,125 kN m2, rigidez de corte `GA_s=1,302,083.33 kN`. `uy(L/2)=-PL3/(48EI)-PL/(4GA_s)=-0.58752 mm`; reacciones `5+5 kN`; `|M|max=15 kN m`. | ARM y Rust coinciden. |
| Viga biempotrada con q uniforme | L=6, q=10 kN/m, misma seccion anterior. `uy(L/2)=-qL4/(384EI)-qL2/(8GA_s)=-0.46656 mm`; reacciones `30+30 kN`; momentos extremos absolutos `30 kN m`. | ARM y Rust coinciden. |
| Voladizo inclinado | Vector del eje `(3,4)`, L=5; fuerza global `(4,-5)` kN. Proyeccion local axial `-1.6` kN y transversal `-6.2` kN. `ux=15.34566 mm`, `uy=-11.51480 mm`; reacciones `(-4,5)` kN y momento horario de apoyo `-31 kN m`. | ARM y Rust coinciden. |

Los cinco casos suman **480 comparaciones** nodales, de fuerzas de extremo y diagramas, y **252 componentes** de deformada entre nudos, todas dentro de la tolerancia de paridad configurada. Los ejemplos anteriores de voladizo transversal y viga biapoyada bajo carga uniforme siguen en `Benchmarks.ts` y en las pruebas nativas. El balance de fuerzas y momentos tambien se comprueba por separado en el resultado de la aplicacion.

Las expresiones de Timoshenko y la contribucion del corte se apoyan en [TU Delft, Timoshenko beam](https://teachbooks.tudelft.nl/computational-modelling/structural_linear/timoshenko.html) y su [ejercicio de voladizo](https://oit.tudelft.nl/Finite-Elements-in-CEG/main/structural_linear/Exercises/pyjive_timoshenko.html). Las expresiones clasicas de flexion para par extremo y viga biempotrada se contrastaron con [MIT OCW, formulas de vigas](https://ocw.mit.edu/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/4c41fc048425a6db74633c1da8a3d9cc_spring04_pset3.pdf). La aportacion por corte de los casos biapoyado y biempotrado procede de integrar `V/GA_s` con los apoyos indicados; es una deduccion de las ecuaciones de Timoshenko, no una cita literal.

## Hallazgos y limites

1. **Bloqueante para diseno de edificios:** el solver es 2D y estatico. No representa torsion espacial, diafragmas, muros/placas, interaccion con cimentacion, masas y modos, espectros, segundo orden ni combinaciones normativas. `Model.ts`, `Solver.ts` y `frame2d.rs` describen el alcance implementado; el ejemplo de ocho pisos no demuestra comportamiento sismorresistente ni conformidad RNE.
2. **Bloqueante para resultados de proyecto:** la idealizacion BIM conecta ejes centroidales por tolerancia sin brazos rigidos ni decisiones de conexion verificadas. La transferencia superficial conserva fuerza declarada, pero no verifica el momento de la fuente ni la distribucion espacial; `Report.ts` lo advierte. Hay que cerrar estas trazas antes de interpretar las demandas de barras como las de la estructura real.
3. **Cobertura de verificacion incompleta:** las ampliaciones cubren continuidad, una liberacion, discretizacion y porticos hiperestaticos laterales de 1, 2, 4 y 8 niveles mediante referencia independiente por metodo de fuerzas. Aun faltan referencias publicadas de terceros para edificios, porticos multivano laterales, rigideces heterogeneas, liberaciones combinadas, apoyos elasticos y casos limite mal condicionados. Los dos motores usan el mismo ensamblado de cargas de la aplicacion, por lo que su acuerdo no valida por si solo esa entrada.
4. **Diagnostico numerico parcial:** Rust comprueba factorizacion y residuos y devuelve error hacia atras por componente, proporcion del residuo respecto a su tolerancia y una estimacion del condicionamiento de la matriz escalada. Aun faltan umbrales de advertencia validados, sensibilidad ante perturbaciones y mediciones de rendimiento. El limite de 500 nudos/5,000 barras es una restriccion de entrada, no una calificacion de precision o rendimiento para ese tamano.
5. **Defecto de escala corregido durante la revision:** `compareFrame2dResults` usaba una expansion de todas las diferencias en `Math.max`. Podia desbordar la pila con modelos grandes. Ahora calcula ambos maximos mediante reduccion lineal, sin alterar los resultados individuales.

## Evidencia ejecutada

- `bun run test:frame2d-validation`: 28 escenarios, sin fallos; 12,456 comparaciones de respuesta y 6,972 componentes de deformada entre motores. Los valores de referencia independientes se comprueban adicionalmente en ambos motores. Ademas se verifica el rechazo de un modelo sin apoyos con `KERNEL_SINGULAR_SYSTEM`.
- `cargo test --workspace --locked` en WSL/Ubuntu: 25 pruebas nativas aprobadas (20 de biblioteca, 5 de geometria); Clippy sin advertencias.
- `bun run test:kernel-worker`: Worker real y WASM en Chrome, con curvas, reacciones, error singular y cancelacion aprobados en la revision anterior.
- Prueba de resultados en Chrome: informe exportado, paridad y paginacion aprobados en la revision anterior.

## Ampliacion de la matriz: continuidad, liberacion y discretizacion

Se incorporaron 12 escenarios adicionales en el mismo comando de verificacion:

- Viga continua: dos vanos de 3 m, q=10 kN/m, EI=78,125 kN m2 y GA_s=1,302,083.33 kN. Eliminando el apoyo intermedio y anulando su desplazamiento, `Rmedio = [5qL^4/(384EI)+qL^2/(8GA_s)] / [L^3/(48EI)+L/(4GA_s)]`, con L=6 m. Resulta **37.35294118 kN**; las reacciones extremas son **11.32352941 kN** cada una. Ambos motores coinciden.
- Voladizo apuntalado: L=6 m, q=10 kN/m y mismas rigideces. Se fija el nudo derecho pero se libera la rotacion de la barra en ese extremo. Por compatibilidad, `Rderecha = [qL^4/(8EI)+qL^2/(2GA_s)] / [L^3/(3EI)+L/(GA_s)] = 22.53731343 kN`. Se verifican reacciones, momento del empotramiento y momento nulo en el extremo liberado, tanto en el nudo como en la barra.
- Portico en L: columna H=4 m y viga L=3 m, union rigida, base empotrada, P=10 kN descendente en el extremo. Con EA=1,800,000 kN, EI=13,500 kN m2 y GA_s=625,000 kN en ambas barras, `ux=PLH^2/(2EI)=17.77777778 mm`; `uy=-PH/EA-PL^2H/EI-PL^3/(3EI)-PL/GA_s=-33.40355556 mm`. Se verifica ademas giro y equilibrio en la base. Es un portico abierto isostatico; no sustituye el ensayo de un edificio multinivel.
- Discretizacion y relacion corte/flexion: nueve voladizos, combinando L=0.5, 3 y 30 m con 1, 4 y 12 elementos. P=0.01 kN para mantener desplazamientos pequenos. El desplazamiento extremo, la reaccion y el momento de base coinciden con la solucion Timoshenko en todas las variantes. La geometria corta es un ensayo matematico del elemento, no una aprobacion de la teoria de viga para miembros profundos reales.

Las reacciones redundantes se dedujeron usando el [metodo de fuerzas y compatibilidad de TU Delft](https://oit.tudelft.nl/CEG-mechanics-BSc/NL/statically_inderminate/force_method/force_method.html), con las flexibilidades Timoshenko indicadas. Las formulas numericas son deducciones para los modelos de prueba; no son valores publicados de un benchmark comercial. La referencia del portico en L se obtiene sumando deformacion axial de columna, giro de la union, flexion y corte de viga.

## Porticos hiperestaticos bajo carga lateral

La referencia aislada `tests/fixtures/portal-force-reference.mjs` implementa el metodo de fuerzas para un portico de tres barras con ambas bases empotradas. No importa matrices FEM ni funciones de los motores de produccion. Se libera la base derecha y se calculan sus tres reacciones redundantes mediante `F R = -d`, donde `Fij = integral(Ni Nj/EA + Vi Vj/GA_s + Mi Mj/EI) ds`. Los esfuerzos del sistema liberado se obtienen por equilibrio de la cadena abierta; dos puntos de Gauss integran exactamente los productos cuadraticos para estas cargas nodales. Se comprueba tambien la compatibilidad de desplazamientos nulos en el apoyo recuperado.

Se ensayan (ancho, altura izquierda, altura derecha), en m: (5,3,3), (8,4,3) y (3,6,6). Fuerzas horizontales superiores: 5 y 7 kN, sin peso propio; EA=1,800,000 kN, EI=13,500 kN m2 y GA_s=625,000 kN en las tres barras. La segunda geometria incluye una viga inclinada. Se contrastan los tres desplazamientos de cada nudo y las tres reacciones de ambas bases por separado en ARM y Rust, con tolerancias de 1e-10 m/rad y 1e-7 kN/kN m. Los diagramas y deformadas internas solo se contrastan entre motores en estos tres casos; no se afirma una referencia independiente para cada estacion.

Para el portico (5,3,3), la referencia da desplazamientos horizontales superiores de 1.687062695 y 1.689830831 mm; reacciones horizontales -5.996528891 y -6.003471109 kN, y verticales -2.808423885 y 2.808423885 kN. Ambos motores pasan. Los valores son deducidos para este ensayo, no un benchmark comercial publicado. Fundamento metodologico: [TU Delft, metodo de fuerzas](https://oit.tudelft.nl/CEG-mechanics-BSc/NL/statically_inderminate/force_method/force_method.html).

Esta primera ampliacion verifica flexion lateral hiperestatica de un nivel. La ampliacion siguiente incorpora varios niveles; ninguna de ellas implementa el diagnostico del condicionamiento ni una validacion normativa sismica. No se modifico el codigo Rust ni el motor activo durante estas ampliaciones.

## Flexion lateral multinivel

Se incorporan tres porticos de un vano de 5 m, con 2, 4 y 8 pisos de 3 m; bases empotradas y uniones rigidas. Se mantienen EA, EI y GA_s del ensayo anterior. En el piso j se aplican fuerzas horizontales de 0.02j kN a la izquierda y 0.03j kN a la derecha, sin otras cargas. Se usan cargas pequenas para verificar la respuesta elastica lineal; no se representan fuerzas sismicas normativas.

La referencia se extiende a un arbol isostatico: se libera el apoyo derecho y se separa el extremo derecho de cada viga intermedia. Se imponen tres compatibilidades por separacion (dos traslaciones y giro) y tres en el apoyo, resolviendo 3n redundantes para n pisos. Los esfuerzos de cada rama se obtienen por equilibrio de sus descendientes. El trabajo virtual incluye axial, corte y flexion, sin ensamblar matrices de rigidez FEM ni reutilizar codigo de produccion. La funcion anterior de un piso conserva su interfaz y utiliza ahora esta misma integracion, por lo que los 25 escenarios anteriores se ejecutan de nuevo como regresion.

Se comprueban, por separado en ARM y Rust, desplazamientos y giros de todos los nudos (tolerancia absoluta 1e-9 m/rad), reacciones de ambas bases y las seis fuerzas locales de extremo de todas las barras (1e-7 kN/kN m). La referencia exige residuos de compatibilidad inferiores a 1e-10 m/rad en apoyos y cortes. Las curvas internas siguen contrastandose entre motores, no contra valores independientes en cada estacion. Los tres casos pasan; suman 3,102 comparaciones de respuesta y 1,764 componentes de deformada a la suite existente.

Este resultado cierra estos tres casos de flexion lateral multinivel, no la calificacion completa del solver: siguen pendientes condicionamiento numerico, escalabilidad, heterogeneidad de secciones y topologias adicionales. La referencia es una implementacion independiente del metodo de fuerzas dentro de las pruebas, no un certificado ni un resultado publicado de software comercial.

## Condicion para promover Rust

### Diagnosticos numericos incorporados

El resultado Rust/WASM incluye `diagnostics`: numero de grados de libertad resueltos, `maxComponentwiseBackwardError` y `maxResidualToleranceRatio`. El primero usa el residuo recomputado y el denominador `|K||u|+|f|` de la matriz global ensamblada, solo en ecuaciones libres. Fundamento: [LAPACK, error hacia atras por componente](https://www.netlib.org/lapack/explore-html/d0/df7/dla__lin__berr_8f_source.html). No es una llamada a LAPACK ni implementa sus correcciones de subdesbordamiento: 0/0 se define como cero y valores no finitos se rechazan. El segundo conserva el criterio previo `|r| / [1e-8 + 1e-9 (escala interna + |f|)]`; un valor superior a uno impide devolver resultado. Se rechazan ahora tambien escalas no finitas.

El cliente Worker valida estos campos cuando existen, conservando compatibilidad con artefactos v1 anteriores que no los incluyen. Esta etapa los expone en el contrato y la evidencia de pruebas; no agrega aun un indicador visual al panel ni estima condicionamiento. Las cuatro pruebas nuevas de Rust incluyen un sistema casi singular con pequeno error hacia atras pero error de desplazamiento de orden uno, para impedir interpretar el indicador como garantia de precision.

Los 28 escenarios pasan con el WASM recompilado. En los dos porticos axiales simetricos, el error relativo maximo es aproximadamente 0.00298 y 0.00239; las ecuaciones laterales teoricamente nulas hacen sensible el cociente al redondeo. Se conserva el valor bruto: la regresion usa limite 0.01 para esos dos casos y 1e-10 para los restantes, ademas del criterio absoluto previo y las referencias independientes. Estos limites son de ensayo, no normativos ni una regla general de aceptacion. La mayor proporcion residuo/tolerancia observada es 0.1863 en el portico en L, inferior a uno.

Verificacion de esta entrega: 21 pruebas Rust, Clippy, 156 pruebas de aplicacion, TypeScript, compilacion WASM, integracion WASM y Worker real en Chrome aprobados. Chrome verifica tambien la llegada de los diagnosticos. El siguiente paso sigue siendo estimar sensibilidad/condicionamiento y definir advertencias justificadas; no se cambio el motor activo.

### Estimacion de condicionamiento escalado

El modulo `analysis/conditioning.rs` estima `cond_1(D Kff D)`, con `Dii=1/sqrt(Kff_ii)`, y devuelve `scaledConditionEstimate`. No modifica la matriz usada para resolver la respuesta estructural. El escalado diagonal elimina el contraste de unidades por congruencia diagonal positiva; no hace al indicador invariante ante rotaciones de ejes ni detecta por si solo desplazamientos fisicos excesivos.

Se usa una iteracion tipo Hager con sondeo alternante, limitada a cinco iteraciones y como maximo once resoluciones adicionales con la misma factorizacion LLT. No se forma la inversa ni una matriz densa del sistema. Referencia metodologica: [LAPACK DLACON y estimacion de norma uno](https://www.netlib.org/lapack/explore-html/d7/db3/group__lacon_ga1a635889a2510c62b1d93480232bf8d5.html). Es una implementacion acotada inspirada en ese metodo, no una copia completa de DLACON. Puede subestimar el condicionamiento; no es una cota superior del error de desplazamientos ni debe multiplicarse sin mas por el error componente a componente para certificar precision.

Sin ecuaciones libres se devuelve `null`, no un condicionamiento ficticio. El cliente acepta ausencia del campo para compatibilidad con WASM anterior y valida tipo, finitud, rango y coherencia con el numero de ecuaciones cuando existe. Los errores numericos del estimador interrumpen el resultado con `KERNEL_NUMERICAL_FAILURE`; no se regulariza la matriz.

Pruebas nuevas: matriz diagonal con contraste 1e24 (condicion escalada 1), matriz 2x2 con condicion exacta 5/3 y su cambio de unidades, matriz casi dependiente con condicion aproximada 2e8, ausencia de ecuaciones y salidas invalidas. Las 25 pruebas Rust, Clippy, 156 pruebas de aplicacion, TypeScript, WASM, Worker Chrome y 28 escenarios pasan. En los porticos laterales de 2, 4 y 8 pisos se obtienen aproximadamente 1094.50, 4899.42 y 20996.91. Se registran como diagnostico, sin clasificacion automatica de seguridad estructural.

Pendiente inmediato: presentar estos diagnosticos en el panel y memoria con explicaciones, verificar sensibilidad mediante perturbaciones controladas y medir el costo adicional a escala. No se cambio el motor activo.

### Diagnosticos visibles y memoria exportada

El panel incorpora la seccion contraible "Diagnostico numerico Rust" despues de ejecutar el contraste. Muestra grados de libertad, condicionamiento escalado, error por ecuacion y residuo/tolerancia. Los cuatro indicadores incluyen su interpretacion y limites, sin declarar seguridad estructural ni extrapolar los diagnosticos al motor ARM. Se utiliza un componente separado y un generador compartido de textos/valores para que la memoria HTML y el panel no diverjan.

El informe de paridad conserva una copia de los diagnosticos de la respuesta Worker. Para artefactos anteriores se indica "No disponible"; sin ecuaciones libres se indica "No aplica" para condicionamiento y se advierte que los ceros de residuo no validan desplazamientos libres. Los resultados sin contraste mantienen el estado no verificado existente.

Verificacion de esta entrega: 159 pruebas en 58 archivos y TypeScript aprobados; build Next.js aprobado. Chrome confirma la seccion contraible, el valor del voladizo (1.359e+1), las limitaciones en el HTML descargado y la paginacion del modelo de 103 nudos. Verificacion responsiva a 1440x900 y 390x844: diagnosticos dentro del ancho del viewport y una sola columna en movil; capturas inspeccionadas. No se modifico Rust en esta entrega. Pendiente: sensibilidad mediante perturbaciones y mediciones de costo a escala, ademas de la matriz ampliada de casos.

### Sensibilidad con perturbaciones controladas

Comando reproducible: `bun run test:frame2d-sensitivity`. Se resolvieron 17 modelos (base y 16 variantes), con 2,091 comparaciones ARM/Rust de respuesta y deformada, y 16 comprobaciones independientes de derivada. Todos pasan. Tambien se reejecutaron los 28 escenarios previos sin fallos; no se modificaron los motores ni la interfaz en esta entrega.

Caso: voladizo horizontal L=3 m, P=-0.01 kN, E=30e6 kN/m2, A=0.06 m2, I=0.00045 m4 y nu=0.2. Se perturba un parametro a la vez por factores `1 +/- epsilon`, con epsilon=1e-3 y 1e-5 (0.1% y 0.001%). El cambio de E mantiene nu constante y cambia G; el de I mantiene A y G constantes, por lo que representa una variacion matematica de rigidez, no un redimensionamiento completo de una seccion rectangular.

La referencia independiente parte de `u=B+S`, `B=PL^3/(3EI)`, `S=PL/GA_s`, como en [TU Delft, voladizo Timoshenko](https://oit.tudelft.nl/Finite-Elements-in-CEG/main/structural_linear/Exercises/pyjive_timoshenko.html). Las derivadas respecto al incremento fraccional del parametro son: carga `B+S`; E `-(B+S)`; I `-B`; longitud `3B+S`. Sus valores base son respectivamente -6.714666667e-6, +6.714666667e-6, +6.666666667e-6 y -2.0048e-5 m. Estas derivadas son deducidas de la expresion, no cifras publicadas de un benchmark.

Para cada motor se usa diferencia central `(u+ - u-)/(2 epsilon)` y tolerancia `2 epsilon^2 |derivada esperada| + 1e-12 m`, que incluye truncamiento de segundo orden y redondeo. Cada modelo perturbado tambien contrasta flecha y reaccion vertical con la solucion cerrada. El condicionamiento escalado permanece aproximadamente 13.5904938064 al cambiar solo P o E, con tolerancia de regresion absoluta 1e-8.

Esto verifica sensibilidad local del voladizo lineal, no sensibilidad general de edificios, mecanismos cercanos, no linealidad, incertidumbre de materiales ni sismo. Pendiente: perturbaciones de rigidez localizada en porticos hiperestaticos y mediciones de tiempo/memoria a escala. La calificacion global sigue en curso.

### Rigidez localizada en portico hiperestatico

Comando: `bun run test:frame2d-portal-sensitivity`. La referencia por metodo de fuerzas ahora admite rigideces EA, EI y GA_s por barra mediante una opcion adicional, conservando el comportamiento uniforme y las firmas de uso anteriores. Se comprueban longitud del arreglo de rigideces y valores positivos finitos. La extension no reutiliza matrices FEM.

Caso: portico de un vano de 5 m y altura 3 m, dos bases empotradas, uniones rigidas, cargas horizontales superiores de 5 y 7 kN. Solo la columna izquierda cambia E o I, en +/-0.1% y +/-0.001%. E modifica tambien G manteniendo Poisson; I modifica solo flexion. Nueve modelos pasan la referencia independiente para desplazamientos, giros, ambas reacciones y todas las fuerzas locales de extremo. Se aprueban 3,213 comparaciones entre motores y 16 comparaciones de derivadas por diferencia central (desplazamiento superior derecho y reaccion horizontal izquierda, dos motores, dos parametros y dos pasos).

La derivada de la referencia tambien se calcula por diferencias centrales del metodo de fuerzas, no por una formula cerrada de derivada. Se verifica consistencia entre ambos pasos: tolerancia relativa 1e-5 mas absoluta 1e-10 m o 1e-7 kN. Para comparar cada motor con la referencia de derivada se usa 1e-6 relativa mas esas mismas tolerancias absolutas. Se exige respuesta derivada no nula para evitar un falso positivo por resultados constantes.

Resultados de referencia con paso 1e-5, por incremento fraccional: variacion de E, dUx=-5.853291672e-4 m y dRx=-1.659075014 kN; variacion de I, dUx=-5.698920023e-4 m y dRx=-1.623107376 kN. El desplazamiento base es 1.689830831 mm y Rx izquierda=-5.996528891 kN. La mayor rigidez de esa columna reduce desplazamiento y aumenta su participacion horizontal para este caso.

Regresion: vuelven a pasar los 28 escenarios generales y los 17 modelos de sensibilidad del voladizo. No hubo cambios en el solver ni en la interfaz. Sigue pendiente rendimiento/tiempo/memoria a escala, sensibilidad localizada multinivel y topologias multivano; no se acredita comportamiento no lineal ni normativo.

### Revision profesional posterior

Por decision del usuario, la revision profesional se realizara posteriormente y no bloquea el desarrollo ni las verificaciones automatizadas. Se mantiene separada de la aceptacion tecnica del software; no se considera cumplida por estos ensayos.

La ampliacion del 2026-09-25 incorpora porticos de 2 y 8 niveles, dos vanos y tres columnas identicas, con 10 kN verticales por nudo de cada piso. Para altura h=3 m y EA=1,800,000 kN, el desplazamiento del piso j es `uy(j)=-Ph/EA * [j(n+1)-j(j+1)/2]`. Cada base reacciona nP. Ambos motores verifican estos valores en todos los nudos, con desplazamiento horizontal y giro nulos. La igualdad de asentamientos deja las vigas sin deformacion; este ensayo multinivel no valida flexion lateral hiperestatica ni respuesta sismica.

Tres voladizos adicionales reducen I por factores 1e-2, 1e-4 y 1e-6, escalando la fuerza para mantener desplazamientos pequenos. Coinciden con la formula Timoshenko usando tolerancia absoluta 1e-10 m y reaccion 1e-12 kN. Es una prueba de contraste de rigideces, no una estimacion del numero de condicion ni una certificacion de estabilidad general. Un voladizo sin ninguna restriccion es rechazado por Rust con el codigo singular esperado.

No sustituir `ts-fem` como solver activo hasta disponer de una matriz de casos versionada con oraculos independientes para las topologias y cargas admitidas, pruebas de sensibilidad/escala, trazabilidad de cargas y apoyos BIM, criterios de aceptacion aprobados y revision documentada por un ingeniero estructural responsable ajeno a la implementacion. Mantener los resultados fuera de alcance identificados como no evaluados.
