# ARM Structural

Entorno BIM estructural en TypeScript, Three.js y Vite. La geometria parametrica es la fuente de los metrados y del modelo analitico derivado.

## Ejecutar

Requiere Node.js 20+ y pnpm.

```sh
pnpm install
pnpm dev --port 3015
pnpm lint
pnpm test
pnpm build
```

Para la prueba integral, iniciar el servidor y ejecutar `pnpm test:browser`. Usa Google Chrome instalado, perfil temporal y `http://127.0.0.1:3015`; se puede cambiar con `APP_URL`. Las capturas y exportaciones se guardan en `test-results/` (ignorado). No utiliza el perfil personal del navegador.

`pnpm test:contour` comprueba arrastres paralelos, bloqueo Ctrl, dibujo ortogonal, traslacion rigida, deshacer/rehacer y cancelacion en el editor y en los controles del modelo.

`pnpm test:dual` comprueba uniones de 827 solidos, vistas fisica/analitica, proyecciones, comparacion desktop/mobile, diagramas, invalidacion, armadura visible, seleccion vinculada y persistencia.

`pnpm test:frame-view` comprueba vista unifilar sin contornos de losas por defecto, aislamiento XY/ZY por coordenada, planos vacios, encuadre movil y conservacion de resultados FEM al cambiar filtros visuales.

## Modelos Fisico Y Analitico

- La barra del visor permite alternar Fisico/Analitico, elegir 3D/Planta/Frontal y comparar dos ventanas con camaras y seleccion vinculadas por GUID. La vista fisica conserva los estilos graficos existentes, transparencia, armadura y aislamiento de seleccion.
- **Ejes geometricos:** vista unifilar de centroides de barras; en vigas se descuenta medio peralte respecto de su directriz superior. Los ejes que se intersectan se subdividen en la representacion, con union de nudos a 1 mm. Los contornos de losas estan ocultos por defecto y pueden activarse; no son shells FEM. El selector de portico permite mostrar todo el edificio o aislar XY por Z / ZY por X, incluyendo solo barras cuyos dos extremos neutros pertenecen al plano (1 mm). El encuadre frontal sigue la orientacion del plano. En un portico aislado, la opcion de losas muestra solo bordes coplanares, no genera una seccion nueva. El filtro es visual: no mueve nudos, no modifica el modelo FEM ni inventa apoyos, diafragmas o enlaces rigidos.
- **Plano de calculo 2D:** muestra la idealizacion exacta configurada en el panel de analisis, sus apoyos y cargas factorizadas. Es distinta de la representacion geometrica de ejes neutros: el extractor actual sigue usando directrices de referencia, sin offsets rigidos automaticos. Los diagramas N/V/M y la deformada proceden del solver 2D, con escala grafica indicada. No representan un analisis 3D del edificio. Las magnitudes de cargas se editan en el panel de calculo.
- Las uniones de concreto se resuelven en un worker con **Manifold 3.5.3**, por diferencia booleana de solidos cerrados: zapata > columna > viga > losa. Dentro de una categoria tiene prioridad el menor Element ID (GUID como desempate). Las cajas envolventes solo descartan pares sin interseccion, no calculan el volumen.
- Se conservan geometria fuente, GUID, volumen bruto, descuento, volumen neto y GUIDs de los elementos que originaron cada descuento. La malla cortada es derivada y se regenera al editar/restaurar. Las intersecciones triples se descuentan una sola vez; los huecos se respetan. El costo de concreto usa volumen neto. Durante calculo o error no se publica un valor neto como valido. La actualizacion de cantidades no invalida resultados estructurales.
- **Armadura manual de vigas/columnas:** diametros, recubrimiento, barras longitudinales y estribos. Se conserva en el proyecto y sigue su geometria. La masa teorica procede de longitudes de ejes y areas de acero (7850 kg/m3); no de una proporcion del concreto. Las barras completas geometricamente identicas se contabilizan una vez. Intersecciones o tramos coincidentes de barras distintas no se recortan automaticamente: necesitan detalle y revision. Sin especificacion o con jaula incompatible el metrado de acero queda no disponible.
- Estas jaulas son **no verificadas por E.060**: no incluyen ganchos, radios de doblado, anclajes, empalmes, despiece de taller ni diseno resistente. No hay mallas de armadura de losas/zapatas. El aislamiento puede mostrar prolongaciones dentro de la union, pues descontar concreto del anfitrion no acorta automaticamente sus barras.

## Controles De Edicion

- El control central de cada borde desplaza su recta paralelamente, conservando las direcciones de los lados vecinos. Los vertices intermedios colineales se desplazan juntos.
- Ctrl o Shift durante un arrastre fija el eje dominante hasta soltar la tecla. En el editor tambien esta disponible la casilla Ortogonal, y el bloqueo se aplica al dibujar segmentos nuevos.
- La cruz central o el boton Mover del editor trasladan la losa completa, incluidos sus huecos. El control central amarillo del modelo traslada vigas, columnas, losas y zapatas sin modificar sus dimensiones.
- Los controles de esquina siguen editando vertices individuales; para desplazar un lado sin ladearlo se utiliza su control central.
- Cancelar descarta el borrador del editor. Escape o la cancelacion del puntero revierten el arrastre activo en el modelo.

## Flujo disponible

- Cuantificacion: filtros por categoria, nivel, sector y texto; agrupacion, orden, paginacion, edicion de marca/sector/resistencia, seleccion multiple y CSV de todos los resultados filtrados. Volumen y costo se recalculan desde la geometria sin redondeo intermedio.
- Edicion de losas: contorno exterior y huecos, vertices numericos o arrastrables, dibujo de anillos, espesor/cota, deshacer/rehacer y confirmacion/cancelacion transaccional. Rechaza intersecciones, huecos exteriores y dimensiones invalidas.
- Vigas, columnas y zapatas: edicion parametrica de extremos, ubicacion y dimensiones. No incluye perfiles arbitrarios, muros ni bocetos con arcos.
- Proyectos: guardado automatico en IndexedDB y exportacion/importacion `.arm.json` versionada con geometria, atributos BIM, niveles, ejes y configuracion analitica. El almacenamiento local depende del navegador y no sustituye una copia exportada.
- Analisis: extraccion de un portico 2D XY o ZY, idealizacion explicita por tolerancia, apoyos, cargas nodales/distribuidas, articulaciones y factores manuales. Motor ts-fem ejecutado en un Web Worker; resultados, deformada, reacciones y memoria HTML imprimible con trazabilidad BIM.

## Ejemplos Y Referencias

El boton **Ejemplos** sustituye al generador fijo de 5 pisos. Cargar un ejemplo requiere confirmar el reemplazo cuando ya existe un modelo; exportar primero el proyecto para conservarlo.

- **Oficinas / 8 niveles:** 827 elementos, planta de 42 x 24 m, altura 27.30 m, podio de 4 niveles y retranqueo superior. Columnas de 0.70 y 0.55 m, vigas de 0.35 x 0.65 y 0.30 x 0.60 m, losas de 0.20 m con huecos, zapatas ilustrativas. Ninguna seccion ni cimentacion esta dimensionada o aprobada por RNE.
- **Portico central del edificio:** 88 elementos BIM generan 103 nudos y 136 tramos FEM, plano XY en Z=0, bases empotradas idealizadas, E=25000 MPa y peso unitario 24 kN/m3. Los 48 cruces entre centroides de vigas y columnas subdividen estas ultimas; se conservan sus tramos superiores, sin brazos rigidos automaticos. Las cargas gravitatorias equivalentes son entradas manuales del ensayo, no una transferencia automatica ni valores certificados de E.020: ancho tributario 6 m, D adicional=43.8 kN/m y L=18 kN/m; cubierta D=34.8 y L=6 kN/m. El peso propio de barras se agrega automaticamente. Se omite el descuento de huecos en estas cargas. El metrado fisico si descuenta solapes: bruto 2324.804 m3, neto aproximado 2268.866 m3; esta deduccion no cambia automaticamente las cargas del ensayo.
- **Voladizo:** L=3 m, seccion 0.20 x 0.30 m, E=30000 MPa, nu=0.2 y P=10 kN. Sin peso propio. Referencias: Ry=10 kN, |M|=30 kN m, Uy=-6.714667 mm, incluyendo deformacion por cortante con k=5/6. La ecuacion de referencia procede del [ejercicio Timoshenko de TU Delft](https://oit.tudelft.nl/Finite-Elements-in-CEG/main/structural_linear/Exercises/pyjive_timoshenko.html); los valores geometricos y materiales son propios de este ensayo, no una reproduccion de su archivo de ejemplo.
- **Viga biapoyada:** L=6 m, seccion 0.30 x 0.50 m, E=25000 MPa y q=10 kN/m, sin peso propio. Por equilibrio: Ry izquierda=derecha=30 kN y |M|max=45 kN m.

En Resultados y en la memoria se comparan valores esperados/calculados y errores, con tolerancia relativa 1e-6 mas absoluta 1e-8 en la unidad mostrada. Modificar geometria, cargas, apoyos, materiales o factores invalida la comparacion con el caso original. `pnpm test:examples` prueba este flujo, la persistencia y la confirmacion de reemplazo.

Estos son modelos demostrativos y referencias numericas. **No son edificios certificados, no prueban todas las normas ni validan por completo el software.** Faltan los analisis y verificaciones indicados en Alcance De Ingenieria. Los importes de costo se inicializan en cero porque no existe presupuesto de referencia.

## Arquitectura

- `src/core/model/Geometry.ts`: definiciones parametricas, validacion y cantidades.
- `src/core/database/`: documentos BIM, catalogo de tipos y revision del modelo.
- `src/tools/structural/ElementGeometry.ts`: adaptador de definicion a mallas Three.js.
- `src/core/model/Schedule.ts`: filas agrupadas y exportacion de metrados.
- `src/core/model/PhysicalJoins.ts`, `joins.worker.ts`, `PhysicalModelController.ts`: booleanas, concurrencia por revision y actualizacion de mallas/cantidades.
- `src/core/model/Reinforcement.ts`: jaulas manuales y registro de barras/masa.
- `src/core/analysis/AnalyticalGraph.ts`: generacion compartida de centroides y conectividad geometrica para vistas y adaptador FEM 2D; referencias GUID/parametro por nudo y rango de origen por tramo.
- `src/ui/DualModelController.ts`: representaciones vinculadas, camaras, cargas, diagramas y armadura.
- `src/core/model/Project.ts`: formato versionado y persistencia local.
- `src/core/analysis/`: extraccion, validacion, adaptador FEM, worker y reporte.
- `src/ui/`: tabla, editor de contornos, proyectos y panel analitico.

El nombre historico `WasmBridge` permanece, pero la geometria actual se genera en TypeScript/Three.js. El kernel Rust no es el motor de calculo activo.

## Alcance De Ingenieria

### Balance de cargas / primera entrega de REQ-CAR-001

En **Analisis > Balance de cargas** se concilian cargas de barras y nodales con el ensamblado del solver. Fuentes agrupadas por GUID, tramos de origen, nivel BIM, material declarado, volumen bruto/neto, peso unitario de las barras, peso automatico activo/excluido y D/L manuales. Los totales por nivel se refieren al nivel BIM del elemento, no a una distribucion de masas de piso; las cargas nodales se listan aparte. Exportacion CSV/JSON completa e inclusion en la memoria HTML.

En **Barras**, la declaracion de D tiene dos modos: `additional` (por defecto y compatible con archivos antiguos) suma PP + D manual; `includes-self-weight` utiliza D manual como total y excluye el PP automatico de ese tramo. El segundo modo exige una referencia antes de calcular, pero esa referencia no constituye una verificacion profesional. Cambiar el modo no altera el valor original del PP ni las cantidades BIM. D/L se ingresan por longitud real de tramo, positivas hacia abajo; las cargas nodales conservan su signo y factor independiente.

El volumen neto se muestra solo cuando esta disponible para la revision activa. La comparacion de peso bruto/neto usa el peso unitario declarado de las barras; no asigna densidades a losas ni cambia automaticamente cargas. Las losas sin fuente superficial vinculada aparecen pendientes aunque puedan estar representadas en cargas manuales no vinculadas. No hay fuente de masa sismica ni catalogo E.020 habilitado. No se detecta automaticamente que una carga manual haya sido declarada incorrectamente como adicional; tampoco se resuelven aqui solapes de peso propio entre elementos distintos.

`Loads.ts` centraliza las contribuciones para solver, diagramas y balance; `LoadLedger.ts` agrega las fuentes sin volver a contar el volumen de un elemento por cada subdivision. Una firma exacta de las entradas impide comparar reacciones o emitir memorias con resultados de otras cargas, factores o configuraciones. El indicador de guardado distingue cambios pendientes de escrituras completadas; una escritura anterior no marca guardada una edicion posterior.

### Fuentes superficiales / segunda entrega de REQ-CAR-001

**Analisis > Superficies** vincula una fuente por losa: area con huecos y espesor desde BIM, peso unitario, D sobrepuesta y L ingresados con sustento. El reparto se declara por porcentaje hacia vigas horizontales del portico, como carga uniforme sobre la longitud total de cada viga. Sus subdivisiones no multiplican la carga. La parte fuera del portico exige porcentaje y sustento; lo no asignado queda pendiente. Los borradores se guardan, pero el calculo requiere 100% contabilizado y referencias completas.

Para evitar mezclar cargas equivalentes existentes, los tramos receptores deben tener D/L manual cero y declaracion D adicional. No se borran cargas manuales automaticamente. En particular, el ejemplo de oficinas ya contiene cargas equivalentes: conciliarlas antes de registrar fuentes. El PP de barras sigue separado del PP de losa. El balance y sus exportaciones muestran D/L total, asignada, fuera, pendiente y cada receptor; las fuentes no se suman nuevamente a los totales de barras. Cambiar fuentes invalida resultados; guardar/restaurar conserva sus declaraciones y detecta geometria obsoleta.

`SurfaceLoads.ts` valida y compila contribuciones serializables para el worker. Balance JSON version 2; proyectos antiguos sin fuentes siguen compatibles. `pnpm test:surfaces` verifica navegador, persistencia, bloqueos, exportaciones y escritorio/movil. Las pruebas numericas usan una losa de 23 m2 con hueco y una viga biapoyada, incluyendo subdivision y factores.

**Limites:** reparto uniforme declarado, no metodo tributario automatico ni FEM de placas. Conserva fuerza asignada, no verifica momento de la fuente o compatibilidad espacial del reparto. Peso de losa bruto con huecos, sin conciliacion de solapes. El porcentaje fuera no acredita asignacion en otro portico. No determina cargas de uso normativas, masas sismicas ni cumplimiento del RNE.

`pnpm test:loads` comprueba ambos modos, sustento faltante, exportaciones, persistencia y formato movil. Las pruebas unitarias usan una viga de 6 m: PP=3.6 kN/m, D manual=10 kN/m y L=2 kN/m dan 93.6 kN con D adicional y 72 kN con D total. Son datos sinteticos, no minimos normativos. Tambien cubren signos/factores, fraccionamiento por GUID, losa con hueco y resultados obsoletos.

### Perfil normativo / primera entrega de REQ-NOR-001

El boton **Normativa** abre el perfil peruano: alcance del proyecto, edicion propuesta por E.020/E.030/E.050/E.060, justificacion y referencia de evidencia. Las fuentes oficiales y limitaciones quedan visibles. Ninguna edicion se asigna automaticamente, incluida E.030: su aplicabilidad requiere revision y sustento de las disposiciones transitorias cuando corresponda.

El perfil tiene revision propia y se conserva en el guardado local y `.arm.json`. Los proyectos antiguos reciben un perfil vacio sin alterar su geometria o configuracion analitica. Cancelar descarta el borrador; exportar Matriz genera JSON del perfil guardado con fuentes, pendientes y revision del modelo en la sesion. El reporte documental no contiene resultados de calculo ni certificacion.

`src/core/normative/` separa registro documental, perfil y contrato de verificaciones. El contrato distingue no evaluado, datos insuficientes, no aplica justificado, cumple, no cumple y obsoleto; comprueba procedencia por proyecto/revisiones/edicion/motor, entradas finitas y unidad/operador del criterio. Los adaptadores futuros deben validar las entradas y dimensiones especificas de cada regla. No se importan estados de cumplimiento desde el perfil de un archivo externo.

**Alcance pendiente:** todas las reglas RNE del registro siguen sin algoritmo validado; completar un perfil solo cambia de datos insuficientes a no evaluado. No se habilitaron cargas por uso, combinaciones automaticas, sismo ni diseno. Falta cerrar la matriz de articulos E.020/E.060 y revisar el anexo completo E.030-2026 con responsable tecnico. `pnpm test:normative` verifica la interfaz, persistencia, archivos antiguos, exportacion y vista movil; las pruebas del contrato usan un criterio sintetico, no un calculo RNE certificado.

La normativa objetivo es Peru: RNE E.020, E.030 y E.060. **Esta version no acredita cumplimiento normativo ni es un sustituto validado de un programa de diseno estructural.** Las cargas, propiedades y factores son entradas del usuario, no valores normativos certificados.

El analisis implementado es elastico lineal de barras 2D Timoshenko. No incluye shells/losas FEM, transferencia automatica de cargas tributarias, interaccion suelo-estructura, segundo orden, analisis modal/espectral, combinaciones normativas automaticas ni diseno de armaduras. La generacion divide las barras en los cruces de sus ejes centroidales y los convierte en extremos compartidos; modelos manuales con nudos interiores sin subdividir siguen rechazados. El limite preventivo es 500 nudos.

Las vigas se ubican analiticamente en el centro de su seccion, no sobre su linea superior de insercion. La tolerancia analitica es una idealizacion explicita que debe revisar el ingeniero: una tolerancia grande puede conectar elementos incorrectos. Los ajustes quedan registrados; si colapsa un tramo, se bloquea la generacion en lugar de omitirlo del calculo. No se crean extensiones, brazos rigidos ni conexiones por mero contacto de solidos. Los cruces se unen sin liberaciones automaticas; revisar la conexion fisica y las articulaciones por tramo.

Los planos guardados con otra generacion, geometria divergente o entradas pendientes quedan conservados pero no vigentes. Al regenerar se pide confirmacion porque se reinician apoyos, cargas y liberaciones; no se transfieren automaticamente a otra topologia. Los proyectos conservan incluso analisis obsoletos de elementos eliminados, marcados para regeneracion y sin resultados vigentes. Restaurar cantidades no incrementa las versiones de los elementos BIM.

`pnpm test:connectivity` comprueba correspondencia vista/calculo, trazabilidad de tramos, migracion explicita de analisis antiguos y lienzos de escritorio/movil. Las pruebas unitarias incluyen cruces XY/ZY, elementos separados, tolerancia, duplicados y conservacion de longitudes/cargas. El grafo 3D es geometrico: el solver sigue siendo 2D; las conexiones requieren revision profesional.

El metrado de concreto descuenta intersecciones de solidos. El encofrado sigue estimado por categoria, sin descontar caras de contacto: losa = area inferior menos huecos; viga = fondo y dos caras laterales; columna = perimetro por longitud; zapata = caras laterales. No sustituye un presupuesto definitivo. Unidades geometricas m, fuerzas kN, modulo elastico MPa; resistencia del concreto en el catalogo kgf/cm2. Los vertices de las mallas booleanas usan precision Float32; no es un kernel CAD de precision arbitraria.

Pendientes principales: restricciones asociativas de niveles, idealizacion/conectividad estructural mas completa, cargas tributarias, validacion normativa trazable, interoperabilidad IFC y expediente tecnico completo.

## Validacion Y Licencias

Las pruebas unitarias cubren poligonos/huecos, sincronizacion de tipos y cantidades, persistencia, exportacion, extraccion y contrastes analiticos de vigas/columnas. La prueba de navegador comprueba edicion, cancelacion, filtros, exportacion, persistencia, calculo y vistas desktop/mobile. Esta cobertura no constituye una certificacion del motor.

Manifold 3.5.3 se distribuye bajo Apache-2.0. Documentacion del motor: [Manifold](https://manifoldcad.org/docs/jsuser/classes/Manifold.html). Las pruebas adicionales cubren interseccion triple, duplicados, contactos, huecos, barras oblicuas, ejes cruzados, revision de cantidades y masa de armaduras.

ts-fem se fija al commit `b18694f42119de46c91cb37143896ca69e54d5a3`, version 0.2.0, licencia **GPL-3.0**. Antes de distribuir una version derivada, revisar las obligaciones de esa licencia y la estrategia de licenciamiento del producto. No se ha cambiado la licencia del repositorio. Ver [ts-fem](https://github.com/janvorisek/ts-fem).

Fuente oficial para revisar las normas y sus modificaciones: [Reglamento Nacional de Edificaciones, MVCS](https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne). No se fijan coeficientes normativos sin su implementacion y validacion correspondiente.
# ARM-Structural-v.2
# ARM-Structural-v.2
# ARM-Structural-v.2
# ARM-Structural-v.4
# ARM-Structural-v.4
