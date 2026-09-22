# Plan de desarrollo y validacion RNE de ARM Structural

Fecha de revision: 2026-09-20. Estado: propuesta de requisitos, no implementacion ni certificacion.

## 1. Objetivo y alcance de esta revision

Convertir el historial proporcionado por el usuario en un backlog verificable: norma aplicable -> requisito -> datos -> algoritmo -> prueba -> resultado -> revision profesional.

Se leyo completo `HISTORIAL DE CORREOS -CIP-VERIFICACION-REQUERIMEINTOS-APP.txt` y se contrasto con el README y los modulos actuales del repositorio. El TXT contiene intervenciones rotuladas USER/CIP, pero no cabeceras de correo, oficio, firma ni anexos que permitan autenticar su caracter institucional. Se conserva como insumo del usuario, no como una norma, homologacion o autorizacion de construccion.

Esta revision identifica errores y dependencias; no constituye una auditoria exhaustiva de todos los articulos del RNE. Algunas descargas oficiales devolvieron 403/418; se verificaron publicaciones y pasajes indexados de fuentes oficiales. No se obtuvo el anexo tecnico completo de E.030-2026 en esta consulta. Descargarlo, contrastarlo y cerrar su matriz de articulos es un requisito bloqueante antes de implementar sus coeficientes.

Propuesta de primer alcance: edificaciones convencionales de concreto armado, inicialmente vivienda/oficinas. El numero de pisos no debe ser el unico limite de uso: definir sistemas, regularidad, suelo, diafragmas, cimentacion, tipos de carga y metodos efectivamente soportados. Hospitales, aislamiento, albañileria, acero, reforzamiento y otras tipologias requieren perfiles y validaciones adicionales; no deben aparecer como cubiertos por defecto.

No se promete aprobacion municipal sin observaciones ni cumplimiento de todas las normas. La revision y responsabilidad del ingeniero competente, colegiado y habilitado no se reemplazan por una salida del programa. El expediente estructural tampoco sustituye las otras especialidades.

## 2. Base normativa y control de versiones

La E.030 fue modificada mediante RM 183-2026-VIVIENDA. La RM 217-2026-VIVIENDA modifico su disposicion transitoria para determinados proyectos en curso. Por ello no corresponde fijar indiscriminadamente E.030-2018/2019 o E.030-2026 para todos los proyectos. Registrar la version, la justificacion de aplicabilidad y la evidencia temporal del expediente. [Publicacion MVCS](https://www.gob.pe/institucion/vivienda/normas-legales/8081915-183-2026-vivienda), [disposicion transitoria publicada en El Peruano](https://busquedas.elperuano.pe/dispositivo/NL/2521423-1).

| Marco | Uso en el producto | Trabajo obligatorio antes de habilitarlo |
| --- | --- | --- |
| E.020 Cargas | Catalogo de acciones y cargas por uso | Confirmar tabla, notas, unidades, excepciones y edicion del documento |
| E.030 Diseno Sismorresistente | Sitio, sistema, acciones, analisis y verificaciones sismicas | Matriz versionada del texto aplicable, anexos y transitorias; no reutilizar constantes antiguas sin revisar |
| E.050 Suelos y Cimentaciones | Datos del estudio geotecnico y verificaciones de cimentacion | Determinar informacion necesaria, procedencia y condiciones de validez de cada parametro |
| E.060 Concreto Armado | Resistencia, servicio y detallado | Separar requisitos generales de los condicionados por elemento y sistema resistente |
| Otras normas del RNE | Arquitectura, seguridad y sistemas especiales | Matriz de aplicabilidad por alcance; marcar no evaluado lo no implementado |
| Ley 29090, reglamento y modificatorias | Tramite y documentos del proyecto | Checklist por modalidad y autoridad competente, contrastado con su TUPA vigente y la normativa nacional |
| Ley 27269 y marco de firma digital | Firma verificable de documentos, cuando corresponda | Integracion con mecanismo valido; una imagen de firma no es firma digital |

La base para localizar textos oficiales es el [compendio del RNE del MVCS](https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne). El [DS 029-2019-VIVIENDA](https://www.gob.pe/institucion/vivienda/normas-legales/354318-029-2019-vivienda) aprueba el reglamento de licencias: revisar tambien sus modificatorias, sin asumir que el documento original basta. La [orientacion oficial sobre firma digital](https://www.gob.pe/firmadigital) diferencia el mecanismo criptografico de la simple imagen de una firma.

## 3. Correcciones al historial recibido

Las correcciones tecnicas siguientes son propuestas para la especificacion. Una cifra sin articulo, version y condiciones de aplicacion no pasara a produccion como regla normativa.

| ID | Afirmacion o simplificacion del historial | Requisito mejorado |
| --- | --- | --- |
| C01 | Aprobar sin observaciones por tener estos modulos | Producir evidencia revisable; no prometer aprobacion ni homologacion del software |
| C02 | Todas las losas requieren h=L/25 | Separar heuristica de predimensionamiento y comprobaciones de servicio. La tabla 9.1 de E.060 distingue elemento y continuidad; no establece ese cociente universal |
| C03 | Vigas L/10-L/12 y columnas P/(0.45 f'c) o P/(0.35 f'c) equivalen a diseno | Etiquetar como estimaciones iniciales con fuente y dominio de uso; completar resistencia, servicio y detallado antes de declarar conformidad |
| C04 | Un edificio de ocho pisos sin placas necesariamente colapsa; 1.5%-2% de muros es requisito general | No inferir falla ni cumplimiento por ese indicador. Evaluar sistema permitido, demanda, rigidez, estabilidad, regularidad y diseno; cualquier indicador preliminar se etiqueta como heuristico |
| C05 | Pasadizos y escaleras siempre 400 kg/m2; azotea siempre 100 kg/m2 | Clasificar ocupacion y uso real. La tabla 1 de E.020 diferencia usos; para vivienda incluye 2.0 kPa en corredores/escaleras. Las terrazas se clasifican por uso, no solo por estar en la cubierta |
| C06 | Acabados 100 y tabiqueria 100-150 son valores universales | Catalogar composiciones, espesores y fuentes; distinguir tabiques fijos/moviles y evitar sumar simultaneamente el muro modelado y su equivalente superficial |
| C07 | 1.25D+L +/- S como combinacion sismica | Corregir los parentesis: E.060, 9.2.3, incluye 1.25(D+L) +/- S y 0.9D +/- S. Completar las demas acciones y condiciones aplicables, no limitar el motor a estas expresiones |
| C08 | Siempre 100%D+25%L para masa sismica | Construir una fuente de masa separada de combinaciones resistentes; seleccionar las participaciones segun categoria, uso y version normativa |
| C09 | Diafragma rigido automatico para todos los nodos del piso | Proponer regiones conectadas por losa y permitir justificacion de diafragma rigido, semirrigido o ausencia de restriccion. No unir torres separadas por juntas o huecos sin criterio |
| C10 | Detectar caras y recortar vigas basta para resolver nudos rigidos | Diferenciar union de concreto, eje de barra, excentricidad, tramo rigido y liberacion. No deducir rigidez de una booleana de metrado |
| C11 | Un cociente de rigidez o torsion resuelve todas las irregularidades | Implementar cada condicion de la edicion aplicable con datos y evidencia; incluir restricciones al sistema y al metodo de analisis. No reducir todo a un semaforo |
| C12 | Escalar el espectro equivale a escalar todos los resultados | Separar espectro base, casos, resultados originales y factores de ajuste; verificar que magnitudes deben ajustarse en la version aplicable antes de usar desplazamientos y fuerzas |
| C13 | Una deriva verde permite dar por terminado el diseno | Exigir ademas estabilidad, resistencia, servicio, conexiones, detallado, cimentacion y constructibilidad dentro del alcance declarado |
| C14 | Estribado tipico fijo y criterio unico para todas las vigas/columnas/placas | Resolver los requisitos del sistema correspondiente. No convertir una secuencia comercial en salida calculada; documentar Mn/Mpr y los criterios de capacidad que realmente correspondan |
| C15 | qadm con sismo siempre aumenta 30% | No programar ese multiplicador universal. Solicitar al estudio geotecnico las condiciones de presion admisible, asentamiento, profundidad, geometria y acciones consideradas; justificar cada verificacion |
| C16 | DWG, E-01 a E-06 y escalas citadas son un unico estandar CIP obligatorio | Solicitar plantilla y sustento oficial. Usar nomenclaturas/configuraciones de entrega adaptables, sin presentar convenciones de oficina como ley nacional |
| C17 | Geometria 3D permite resolver todo en milisegundos o menos de tres segundos | Exigir datos completos, cancelacion y control de resultados obsoletos. Definir rendimiento por tarea, hardware y tamano de prueba; nunca por una promesa universal |
| C18 | kg, kgf, t y tf son intercambiables | Separar masa y fuerza, con unidades internas documentadas y conversiones verificadas. No confundir peso sismico con masa de la matriz dinamica |

Soporte para C02/C07/C14: [E.060 oficial](https://cdn.www.gob.pe/uploads/document/file/2366660/55%20E.060%20CONCRETO%20ARMADO%20DS%20N%C2%B0%20010-2009.pdf) y [publicacion SENCICO del texto E.060](https://cdn.www.gob.pe/uploads/document/file/2686419/E.060%20Concreto%20Armado%20DS%20N%C2%B0%20010-2009.pdf). La distincion entre combinaciones, reglas de servicio y requisitos segun sistema debe conservarse en la implementacion.

Soporte para C05/C06: [E.020 oficial, tabla 1 y articulos 6-7](https://cdn.www.gob.pe/uploads/document/file/2366640/50%20E.020%20CARGAS.pdf). C08-C12 y C15 requieren completar la revision del texto aplicable antes de fijar umbrales; no se validan aqui los numeros del historial.

## 4. Estado actual comprobado en el repositorio

| Area | Estado | Evidencia / brecha |
| --- | --- | --- |
| Modelo fisico parametrico | Parcial | `src/core/model/Geometry.ts`: columnas, vigas, losas y zapatas; faltan ambientes, muros/placas, familias de losas y otros elementos |
| Cuantificacion de concreto | Implementacion inicial | `PhysicalJoins.ts`: union por prioridad, bruto/neto y trazabilidad. No equivale a metrado automatico de cargas ni encofrado definitivo |
| Vistas analiticas | Parcial | `AnalyticalGraph.ts` y `FrameView.ts`: centroides y filtros. La representacion geometrica y el modelo FEM siguen siendo distintos |
| FEM | Parcial | `Model.ts` / `Solver.ts`: barras Timoshenko 2D, limite de 500 nudos, cargas manuales, equilibrio y resultados; faltan 3D, shells, dinamica y segundo orden |
| Cargas / masa | Parcial muy limitado | Peso lineal de barras y entradas manuales. No hay transferencia BIM completa ni fuente de masa sismica normativa |
| Normativa / geotecnia | Pendiente | El codigo de proyecto `RNE-PE` no es un registro de versiones, articulos o comprobaciones |
| Armaduras | Parcial ilustrativo | `Reinforcement.ts`: jaulas manuales no verificadas y masa teorica; sin diseno resistente ni despiece completo |
| Predimensionamiento | Pendiente | Secciones de ejemplos/catalogos no constituyen un algoritmo validado |
| Reportes | Parcial | Memoria HTML de portico, CSV y archivo de proyecto; falta expediente coordinado de ingenieria |
| Validacion | Inicial | Ultima ejecucion de la etapa anterior: 26 pruebas unitarias y flujos de navegador. No prueba conformidad integral con RNE ni certifica un edificio |

No se ejecuto nuevamente la suite ni se modifico el codigo durante esta revision documental.

## 5. Reglas comunes de todo requisito nuevo

Cada requisito tendra: ID, tipo (normativo / administrativo / criterio de ingenieria / mejora de producto), fuente y version, condiciones de aplicacion, entradas con unidades, algoritmo, salidas, tratamiento de errores, prueba independiente, tolerancia justificada y responsable de revision.

Cada comprobacion tendra uno de estos estados: NO EVALUADO, DATOS INSUFICIENTES, NO APLICA JUSTIFICADO, CUMPLE, NO CUMPLE u OBSOLETO. Un valor ausente, una funcion no implementada o una excepcion del solver nunca seran CUMPLE.

Cada resultado guardara la revision de geometria y datos, version del motor y del perfil normativo, caso/combinacion, parametros, unidad, demanda, capacidad o limite, metodo, referencia normativa, advertencias y decision del revisor. La conclusion solo cubre esa comprobacion, no todo el edificio.

Propuestas geometricas y predimensionamientos se presentan como borradores comparables; el ingeniero confirma su aplicacion. Cada cambio relevante invalida dependencias posteriores. Los expedientes emitidos son instantaneas reproducibles: no se alteran silenciosamente cuando cambia el modelo.

## 6. Hoja de ruta, en orden de dependencias

Las duraciones se estimaran despues de cerrar alcance, motor y equipo. No se propone una fecha de producto completo sin ese trabajo. Cada fase termina en una revision con evidencia, no solo en una demostracion visual.

### F0. Base normativa y alcance autorizado del producto - P0

**Entregables:** perfil de aplicabilidad, registro de normas/fuentes, matriz articulo-requisito, catalogo de estados y restricciones de uso. Confirmar con el solicitante el oficio/checklist original y municipio/modalidad del piloto. Clasificar cada C01-C18 como corregido, pendiente de fuente o criterio por validar.

**Aceptacion:** cada regla que se pretenda ejecutar tiene version, fuente oficial y condiciones; toda regla no revisada permanece bloqueada. Un proyecto guarda el perfil exacto y no migra automaticamente de edicion. El ingeniero responsable valida la interpretacion; la procedencia del correo no sustituye esa revision.

### F1. Datos, unidades y un unico modelo analitico - P0; depende de F0

**Entregables:** contratos `ProjectContext`, `Material`, `Section`, `AnalyticalNode`, `AnalyticalMember`, `AnalyticalSurface`, `Connection`, `Constraint` y mapa GUID uno-a-varios. Unificar lo representado y lo enviado al solver mediante un adaptador; conservar por separado geometria fisica y decisiones de idealizacion. Preparar migracion del archivo de proyecto con pruebas de ida/vuelta.

**Aceptacion:** casos de viga-columna excentrica, encuentro interior, elemento inclinado y cuerpos separados sin falsas uniones; avisos de elementos duplicados, nudos libres, mecanismos, ejes locales y tolerancias. Todo offset se ve, se explica y puede revisarse. Cambiar la camara no cambia el modelo de calculo.

### F2. Inventario BIM de cargas y materiales - P0; depende de F0-F1

**Entregables:** usos estructurados de ambientes/zonas, tipos de losa, capas, equipos, acabados y tabiques; biblioteca revisada E.020; casos permanentes/variables y cargas puntuales, lineales y superficiales. Admitir ingreso manual trazable antes de disponer de toda la arquitectura.

**Aceptacion:** un nivel regular y otro con huecos reproducen una planilla independiente. Se conserva peso total y su origen por GUID; no se suman a la vez carga equivalente y elemento modelado. Catalogos sin uso, espesor o densidad confirmados generan DATOS INSUFICIENTES. Separar cantidad de concreto, peso del material y seccion resistente.

**Precaucion central:** el volumen neto de uniones puede servir al balance fisico, pero no debe recortar automaticamente la seccion o rigidez FEM. El peso de cada interseccion debe asignarse una sola vez a la ruta de cargas, sin perderlo ni duplicarlo con el peso propio del solver. No sumar otra vez masa de barras si la convencion de peso del concreto armado ya la incorpora.

### F3. Predimensionamiento asistido - P1; depende de F2

**Entregables:** propuestas de losas, vigas, columnas y disposicion inicial de muros dentro de familias soportadas. Mostrar datos, metodo heuristico/normativo, supuestos, rango de aplicacion y alternativas. Recalcular iterativamente el peso al cambiar secciones, con parada y aviso de falta de convergencia.

**Aceptacion:** propuestas repetibles y reversibles; sin modificar automaticamente el modelo aprobado. La salida siempre queda como PRELIMINAR hasta completar las comprobaciones pertinentes. Un criterio de area tributaria no se presenta como una comprobacion de flexocompresion ni de deriva.

### F4. Solver espacial, superficies y transferencia de cargas - P0; depende de F1-F2

**Entregables:** seleccionar e integrar un motor contrastable con barras 3D, matrices dispersas, superficies/meshes y restricciones; evaluar licencia, mantenimiento y limites antes de comprometer distribucion. Incorporar formulacion de losas/placas, refinamiento y diafragmas justificados. Mantener el adaptador 2D como referencia de regresion.

**Aceptacion:** casos cerrados de axial/flexion/torsion, portico espacial, losa y muro; pruebas de mecanismos, energia/equilibrio y convergencia de malla. Transferir cargas conserva fuerza y momento globales. Comparaciones independientes usan iguales secciones, rigideces, ejes, apoyos y discretizacion, no solo una captura de ETABS.

### F5. Sitio y fuente de masa - P0; depende de F0, F2, F4

**Entregables:** contexto georreferenciado con ubigeo versionado, categoria/uso, sistema por direccion y geotecnia con archivo de respaldo, autor, fecha y restricciones. Fuente de masa distinta de las combinaciones resistentes, con posiciones y masa rotacional cuando corresponda. No inferir propiedades del suelo a partir de la ciudad o de qadm.

**Aceptacion:** tabla independiente por nivel reconcilia pesos, masas, centros y componentes excluidos. Cambiar uso o version normativa modifica solo lo aplicable y deja registro. Suelo especial o informacion insuficiente obliga a revision, no a escoger por defecto un perfil favorable.

### F6. Analisis y auditoria sismica E.030 - P0; depende de F0, F4-F5

**Entregables:** metodos admitidos por el perfil, espectros, casos direccionales, modal, combinacion modal/direccional, torsion accidental, participacion modal, cortantes, irregularidades, desplazamientos y derivas; estabilidad/segundo orden y otras exigencias aplicables. Parametros derivados y decisiones de clasificacion deben quedar auditables.

**Aceptacion:** cada rama normativa tiene casos normales, de limite y de incumplimiento. Conservar resultados anteriores/posteriores a ajustes y justificar a que magnitudes se aplican. Probar edificio regular y casos de torsion, retranqueo, piso flexible/debil y discontinuidades. Una comprobacion favorable no oculta otras pendientes. Una propuesta de rigidizacion genera una alternativa y requiere recalculo completo.

### F7. Combinaciones y diseno de concreto E.060 - P0; depende de F0, F4, F6

**Entregables:** combinaciones versionadas, envolventes con concomitancia de esfuerzos, diseno y comprobacion de vigas, columnas, losas, placas, nudos y conexiones dentro del alcance. Separar resistencia, servicio y detallado. Incorporar rigideces apropiadas al analisis y a la verificacion que se efectua.

**Aceptacion:** contrastes independientes por tipo de elemento; un diagrama P-M-M preserva combinaciones y signos, no mezcla maximos incompatibles. Verificaciones de capacidad, confinamiento, separacion/recubrimiento, anclaje, empalme y disposicion fisica de barras segun aplicabilidad. Cambiar una seccion o armado relevante devuelve el flujo al analisis cuando corresponda.

### F8. Cimentaciones E.050 + E.060 - P0; depende de F4-F7

**Entregables:** zapatas primero, luego combinadas/plateas y otras tipologias validadas. Separar acciones de servicio para terreno y acciones de diseno para concreto. Presiones/contacto, asentamientos, estabilidad y punzonamiento, con hipotesis de suelo visibles y limites del estudio. Incluir sostenimiento/excavaciones como requisito aplicable independiente o exclusion explicita.

**Aceptacion:** carga centrada, excentrica y perdida de contacto; estudio de suelos y parametros coherentes con la cimentacion. No usar resortes, empotramientos o incrementos de presion admisible sin justificacion. La aplicacion no sustituye el estudio geotecnico.

### F9. Detallado, metrados finales y expediente - P1; depende de F7-F8

**Entregables:** barras identificadas con forma, ganchos, dobleces, longitudes y empalmes; mallas de losas/zapatas y muros; partidas y unidades; memoria, planos, listas, observaciones y revisiones coherentes. PDF revisable y formato CAD realmente soportado; evaluar SDK/licencia antes de prometer DWG. Plantillas segun alcance y tramite, no una numeracion nacional inventada.

**Aceptacion:** modelo, despiece, planillas y planos pertenecen a la misma instantanea y concilian cantidades. Incluir datos del autor/revisor, limitaciones y comprobaciones pendientes. Permitir exportar borradores con marcas claras; bloquear su etiquetado como expediente revisado si faltan verificaciones necesarias. Firma digital solo mediante mecanismo validado y autorizado por el firmante.

### F10. Validacion independiente y piloto profesional - P0 para liberar; transversal

**Entregables:** protocolo de verificacion numerica, validacion de modelos y auditoria normativa; corpus de casos versionado y revisado por un ingeniero que no haya implementado el algoritmo. Piloto con expediente conocido y observaciones reales, sin usarlo como unica prueba del motor.

**Aceptacion:** resultados reproducibles en otro equipo, casos negativos detectados, dependencias/licencias revisadas, respaldo/recuperacion probados y limitaciones publicadas. Registrar discrepancias y sus causas. Una coincidencia global de cortante no basta si reacciones, desplazamientos, fuerzas locales o detalles difieren sin explicacion.

## 7. Pruebas y condiciones de liberacion

Los limites numericos de QA no son limites del RNE. Se fijaran antes de ejecutar cada ensayo segun magnitud, condicionamiento, precision y discretizacion; no se relajan despues para hacer pasar un caso. Conservar valores de referencia, unidades, error absoluto/relativo y evidencia de revision.

| Familia | Evidencia minima propuesta |
| --- | --- |
| Geometria | Huecos, encuentros triples, inclinados, duplicados, cambios de unidades y escala; preservacion de GUID y cantidades |
| Cargas | Balance por fuente y nivel, ausencia de doble conteo, signo/direccion, efectos de huecos y pesos no estructurales |
| Modelo analitico | Conectividad real frente a mera superposicion visual; excentricidades y liberaciones; componentes desconectadas |
| Solver | Soluciones cerradas, equilibrio de fuerzas/momentos, convergencia, singularidad y sensibilidad |
| Dinamica | Modelos simples con referencia independiente; frecuencias, modos/masas y combinaciones; casos de modos cercanos |
| Normativa | Regla aplicable/no aplicable, dato ausente, umbral inferior/igual/superior, cambio de version |
| Diseno | Elementos con resultado favorable y desfavorable; cuantias/detalles, interaccion, anclajes y constructibilidad |
| Reportes | Correspondencia con la revision calculada; formulas, unidades y referencias; ausencia de resultados obsoletos |
| Producto | Cancelacion, proyectos grandes, errores de worker, migracion y recuperacion; una carga incompleta nunca figura como validada |

No usar el edificio de ocho niveles como certificado de correccion: sirve de prueba de integracion. Mantener referencias pequeñas y trazables ademas de casos complejos.

## 8. Primeras tres tareas ejecutables

1. **REQ-NOR-001 - Registro normativo y contrato de verificaciones.** Crear esquema versionado de perfil, evidencia y estado; completar inicialmente E.020 y las combinaciones revisadas de E.060; registrar E.030-2026 como pendiente hasta revisar el anexo. Salida: matriz revisada y pruebas que bloquean reglas sin fuente/aplicabilidad. No declarar el proyecto conforme por estar configurado como RNE-PE.
2. **REQ-MOD-001 - Consolidar el modelo analitico.** Unificar representacion, generacion y adaptador de calculo; introducir mapa GUID/nudos/tramos y decisiones explicitas de conexion. Salida: fixtures de nudo viga-columna, excentricidad y componente separada; el plano mostrado coincide con el enviado al solver.
3. **REQ-CAR-001 - Balance de cargas gravitatorias trazable.** Materiales, composiciones/usos y libro de fuentes; reconciliar cantidades fisicas con peso propio del solver. Salida: un nivel con hueco y un portico reproducen una planilla independiente; no hay peso duplicado y cada contribucion se puede localizar en el modelo. No fabricar automaticamente masa sismica normativa mientras falte su perfil revisado.

Estas tareas no necesitan rehacer primero toda la arquitectura tipo Revit. Permiten ingresar/importar datos verificados y construir una base fiable para automatizar despues.

## 9. Informacion que debe confirmarse con el solicitante y el revisor

- Oficio o correo original con remitente, fecha, anexos y alcance de lo solicitado por el CIP; distinguir opinion tecnica, checklist de proyecto y eventual evaluacion del software.
- Distrito, modalidad de licencia y autoridad del proyecto piloto; plantilla oficial o checklist administrativo que corresponda.
- Tipologia/material/sistema, regularidad, pisos/sotanos y exclusiones aceptadas para la primera version.
- Estudio geotecnico y datos arquitectonicos del piloto, con autorizacion para utilizarlos.
- Ingeniero calculista responsable y revisor independiente; definicion de quienes aprueban reglas, casos y entregables.
- Expediente y archivos de referencia legalmente utilizables; mismas hipotesis para comparaciones.
- Estrategia de licencia del producto: revisar la dependencia actual ts-fem GPL-3.0 antes de distribuir; no asumir que puede sustituirse por otro motor sin costo tecnico o contractual.

## 10. Seguimiento

Para cada tarea registrar: ID, fase, responsable, estado, dependencias, evidencia, fecha de revision y bloqueo. Estados de trabajo: por especificar, especificado, implementado, probado, revisado y habilitado. Implementado no equivale a revisado ni a normativamente conforme.

En cada iteracion: seleccionar un requisito pequeño, revisar fuente y ejemplo esperado, implementar, ejecutar pruebas, revisar el informe de diferencias y obtener conformidad tecnica. Solo entonces habilitarlo para el alcance aprobado y actualizar la matriz. Conservar un historial de cambios normativos y del motor.

## 11. Avance de implementacion - primera entrega REQ-NOR-001

Actualizacion posterior a la revision documental, 2026-09-20. La seccion 4 conserva el diagnostico anterior; esta seccion registra los cambios nuevos.

- Implementado: registro documental versionado de ediciones candidatas, perfil por proyecto con alcance/sustento y revision propia; importacion de proyectos antiguos con perfil vacio; guardado/exportacion y panel Normativa con matriz JSON de pendientes.
- Implementado y probado a nivel de contrato: seis estados, procedencia por proyecto/revisiones/edicion/motor, rechazo de entradas ausentes/no finitas y de unidades/operadores incompatibles. Pruebas sinteticas, no reglas resistentes certificadas. El perfil importado no admite estados de cumplimiento como evidencia.
- Todas las reglas normativas reales permanecen pendientes: elegir edicion y escribir sustento no verifica calculos ni aprueba la aplicabilidad. El panel muestra datos insuficientes o no evaluado, nunca cumplimiento automatico.
- Pendiente para completar REQ-NOR-001: matriz de articulos revisada de E.020 y combinaciones E.060, revision integral E.030-2026, adaptadores con validacion especifica de datos, casos independientes y conformidad del revisor tecnico. No se integraron factores normativos al solver.
- REQ-MOD-001 y REQ-CAR-001 no se implementaron en esta entrega. Mantienen las dependencias y criterios de aceptacion de la seccion 8.

## 12. Avance de implementacion - base de REQ-MOD-001

Actualizacion posterior a la primera entrega normativa, 2026-09-20.

- La vista de ejes y la generacion FEM 2D comparten `AnalyticalGraph`: ejes centroidales, cortes en intersecciones y union dentro de tolerancia. El filtro de plano exige ambos extremos en el plano, no un cruce proyectado.
- Cada tramo registra ID, GUID BIM y rango sobre el eje original; los nudos registran elementos incidentes, parametros y ajustes. Tabla y memoria muestran el rango de origen. Orden determinista por elemento.
- Politica explicita: cruces unidos sin liberaciones automaticas; no hay extension de barras, brazos rigidos ni diafragmas inferidos de contactos fisicos. Un extremo separado sigue desconectado. Los tramos colapsados por tolerancia bloquean la generacion.
- El ejemplo de oficinas pasa de 55 nudos/88 barras de insercion a 103 nudos/136 tramos centroidales de los mismos 88 elementos BIM. Pruebas verifican conservacion de longitudes, cargas y equilibrio; no constituye validacion normativa.
- Los analisis antiguos o divergentes se conservan en el archivo como pendientes de regeneracion, sin habilitar calculo o memorias vigentes. La regeneracion pide confirmacion antes de reiniciar entradas. Restaurar un proyecto conserva las versiones de los elementos.
- Quedan pendientes: decisiones editables de conexion por nudo, excentricidades/brazos rigidos calculables, transferencia revisable de cargas/apoyos entre revisiones, solver 3D y validacion profesional de las idealizaciones. Se mantiene el limite de 500 nudos FEM por plano.
- Proximo bloque: REQ-CAR-001, inventario de fuentes de peso/carga y balance trazable. Las cargas actuales siguen siendo manuales y el peso propio de barras sigue siendo bruto; no se usa el volumen neto de metrados como si ya resolviera la fuente de masa.

## 13. Avance de implementacion - balance inicial de REQ-CAR-001

- Ensamblado de cargas compartido entre solver, diagramas y balance. Contribuciones automaticas, D/L manuales y nodales separadas, con factores, fuerzas y momento global. Tramos agrupados por GUID sin repetir cantidades fisicas.
- Declaracion por tramo: D adicional o D total que ya incluye su PP. El segundo modo excluye el PP automatico de ese tramo y requiere referencia antes de calcular. La declaracion es del usuario; no prueba por si misma que los datos sean correctos o que no existan otras duplicaciones.
- Balance navegable por fuente, nivel BIM y material declarado; volumen bruto/neto y peso comparativo donde hay datos. Losas sin transferencia BIM vinculada quedan pendientes, no resueltas; no se inventan sus densidades ni se suman automaticamente al portico.
- CSV/JSON con contribuciones, referencias y unidades; resumen y detalle en memoria. Firma de entradas para no reutilizar resultados al cambiar cargas, factores, apoyos o modelo. Persistencia de declaraciones y referencias; indicador de guardado corregido para cambios aun pendientes.
- Verificacion numerica con una viga de 6 m y datos sinteticos: PP 3.6 kN/m, D 10 kN/m, L 2 kN/m; total 93.6 kN en modo adicional y 72 kN en modo total. Se contrastan reacciones, signos, factores, nudos, subdivisiones y tratamiento explicito de una losa con hueco sin transferencia implementada. No se presenta esta ultima como un metrado completo de cargas del piso.
- REQ-CAR-001 sigue parcial: faltan catalogo de materiales/composiciones/usos, vinculacion de fuentes manuales a losas/muros, transferencia revisable con descuento de huecos y conciliacion de peso propio neto por encuentros. El volumen neto sigue siendo comparativo, no una carga aplicada. No se habilito fuente de masa ni comprobaciones E.020/E.030/E.060.
- Siguiente entrega propuesta: fuentes superficiales vinculadas con propiedades declaradas, asignacion explicita a elementos receptores y balance de conservacion, antes de automatizar metodos de reparto o avanzar a masas sismicas.

## 14. Avance de implementacion - fuentes superficiales de REQ-CAR-001

- Implementado: pestaña Superficies, una fuente por GUID de losa con version y firma geometrica; area descontando huecos, espesor, peso unitario y D sobrepuesta/L declarados. Ningun valor de densidad o uso se adopta como normativo por defecto.
- Reparto uniforme declarado hacia vigas horizontales del portico por porcentajes. Cada aporte se divide por la longitud total del receptor y se ensambla una sola vez entre sus tramos. No altera D/L manuales. Varias fuentes pueden alimentar una viga sin duplicar su peso propio.
- El balance separa fuente total, asignado, fuera del portico y pendiente para D y L. El porcentaje fuera exige sustento. Borradores incompletos se guardan, pero no se calculan; porcentajes negativos, mayores de 100%, fuentes/receptores repetidos o inexistentes se rechazan. El calculo exige sustento de cargas/reparto y conciliacion de D/L manuales de receptores (cero y modo adicional).
- Las cargas llegan al solver, flechas, CSV/JSON y memoria mediante el mismo ensamblador. Las filas de losa son informativas; los totales aplicados se cuentan en los receptores, no nuevamente en la fuente. Firma de entradas incluye configuracion superficial; cambiarla invalida resultados. Restaurar compara geometria/version/area y tipo de receptor. Regenerar descarta las fuentes previa confirmacion.
- Prueba independiente: losa 6 x 4 m con hueco 1 x 1 m, espesor 0.20 m, peso unitario declarado 24 kN/m3, D sobrepuesta 1.2 kN/m2 y L 2 kN/m2. Resultan D=138 y L=46 kN. Con 50% al portico: D=69, L=23 kN; viga de 6 m sin PP, reacciones 46 kN por apoyo. Se verifica igualdad antes/despues de subdividir la viga, factores, persistencia, invalidacion, exportacion y bloqueos. Datos sinteticos, no valores de uso certificados.
- Limites: conserva la fuerza explicitamente asignada, no el momento geometrico de la fuente ni la compatibilidad espacial/rigidez del reparto. No infiere areas tributarias ni reacciones de shells. La losa utiliza geometria bruta con huecos; no descuenta encuentros con vigas. La declaracion fuera del portico no acredita que otro modelo haya recibido esa carga. No hay conciliacion entre porticos, fuente de masa ni certificacion E.020/E.030/E.060.
- Siguiente bloque: conciliacion de peso propio por encuentros y revision espacial de receptores; separar los casos completos de los parciales, contrastarlos con una planilla independiente y mantener trazabilidad del residuo. Despues: composiciones/usos con articulos normativos revisados y metodos de reparto automatico verificados.
