from pathlib import Path
from xml.sax.saxutils import escape
import json
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 595.276, 841.89
LEFT, RIGHT, TOP, BOTTOM = 48, 48, 65, 48
WIDTH = W - LEFT - RIGHT
STYLES = {
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=10.2, leading=14.1, textColor=colors.HexColor('#17212b'), spaceAfter=7),
    'small': ParagraphStyle('small', fontName='Helvetica', fontSize=8.8, leading=12, textColor=colors.HexColor('#394651')),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.black),
    'table': ParagraphStyle('table', fontName='Helvetica', fontSize=9, leading=11.8, textColor=colors.HexColor('#17212b')),
    'th': ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=9, leading=11.8, textColor=colors.white),
}


def p(text, style='body'):
    return Paragraph(text.replace('→', '&gt;'), STYLES[style])


class Document:
    def __init__(self, filename, title, short, total):
        self.path = OUT / filename
        self.pdf = canvas.Canvas(str(self.path), pagesize=(W, H))
        self.pdf.setTitle(title)
        self.pdf.setAuthor('ARM Structural')
        self.short, self.total, self.page = short, total, 0
        self.text_pages = []

    def new_page(self, heading, subtitle=''):
        if self.page:
            self.pdf.showPage()
        self.page += 1
        self.pdf.bookmarkPage(f'page-{self.page}')
        self.pdf.addOutlineEntry(heading, f'page-{self.page}', level=0, closed=False)
        self.text_pages.append({'heading': heading, 'blocks': []})
        self.pdf.setFillColor(colors.black)
        self.pdf.setFont('Helvetica', 8)
        self.pdf.drawString(LEFT, H - 32, 'ARM STRUCTURAL  /  ' + self.short)
        self.pdf.drawRightString(W - RIGHT, H - 32, '20 SEPTIEMBRE 2026')
        self.pdf.setFont('Helvetica-Bold', 19 if self.page == 1 else 17)
        self.pdf.drawString(LEFT, H - TOP, heading)
        self.y = H - TOP - 22
        if subtitle:
            self.add(subtitle, 'small', 10)
        self.pdf.setFont('Helvetica', 8)
        self.pdf.setFillColor(colors.HexColor('#56616b'))
        self.pdf.drawString(LEFT, 26, 'Uso técnico controlado  |  No acredita conformidad RNE')
        self.pdf.drawRightString(W - RIGHT, 26, f'{self.page} / {self.total}')

    def add(self, text, style='body', gap=7):
        obj = p(text, style)
        _, height = obj.wrap(WIDTH, 800)
        self.check(height + gap, text[:55])
        obj.drawOn(self.pdf, LEFT, self.y - height)
        self.y -= height + gap
        self.text_pages[-1]['blocks'].append(text)

    def heading(self, text):
        self.add(text, 'h2', 7)

    def table(self, headers, rows, widths):
        data = [[p(escape(str(x)), 'th') for x in headers]]
        data += [[p(escape(str(x)), 'table') for x in row] for row in rows]
        table = Table(data, colWidths=[WIDTH * x for x in widths])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34434a')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f4f5')]),
            ('GRID', (0, 0), (-1, -1), .5, colors.HexColor('#d9d9d9')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        _, height = table.wrap(WIDTH, 800)
        self.check(height + 12, headers[0])
        table.drawOn(self.pdf, LEFT, self.y - height)
        self.y -= height + 12
        self.text_pages[-1]['blocks'].append({'headers': headers, 'rows': rows})

    def picture(self, filename, caption, max_height=280):
        image = ImageReader(str(ROOT / 'test-results' / filename))
        iw, ih = image.getSize()
        scale = min(WIDTH / iw, max_height / ih)
        width, height = iw * scale, ih * scale
        self.check(height + 30, caption)
        self.pdf.drawImage(image, LEFT + (WIDTH - width) / 2, self.y - height, width, height)
        self.y -= height + 6
        self.add(caption, 'small', 12)

    def check(self, amount, label):
        if self.y - amount < BOTTOM:
            raise ValueError(f'{self.path.name} page {self.page} overflows at {label}: {self.y-amount}')

    def finish(self):
        assert self.page == self.total
        self.pdf.save()
        reader = PdfReader(self.path)
        assert len(reader.pages) == self.total
        for page in reader.pages:
            assert len(page.extract_text()) > 150
        (ROOT / 'docs' / (self.path.stem + '.json')).write_text(json.dumps(self.text_pages, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'{self.path}: {len(reader.pages)} pages')


def progress_report():
    d = Document('ARM_Informe_de_avances_y_pendientes.pdf', 'ARM Structural Informe de avances y tareas pendientes', 'AVANCES Y PLAN DE CIERRE', 7)
    d.new_page('Informe de avances y pendientes', 'Corte de avance al 20 de septiembre de 2026  |  Plan F0 a F10')
    d.add('Contamos con una base BIM operativa, metrados netos de concreto, vistas vinculadas y análisis lineal de pórticos 2D con cargas trazables. <b>El producto todavía no cubre el diseño integral de un edificio ni acredita cumplimiento del RNE.</b> El siguiente cierre técnico debe concentrarse en las cargas, la idealización y su validación antes de habilitar sismo o diseño resistente.')
    d.add('Este informe permite decidir el orden de desarrollo y la evidencia necesaria para completar cada fase. Los estados se refieren al alcance total de la fase: una función implementada o una prueba aprobada no equivale a una fase cerrada. No asignamos porcentajes globales sin estimación del esfuerzo y criterios de cierre aprobados.')
    d.add('<b>Prioridades:</b> P0 = condición crítica para habilitar el alcance; P1 = desarrollo posterior según dependencias. <b>Siglas:</b> PP = peso propio; FEM = elementos finitos; GUID = identificador único del elemento BIM.', 'small')
    d.table(['Fase', 'Situación', 'Condición principal para cerrar'], [
        ['F0 Normativa y alcance', 'Parcial', 'Matriz de artículos e interpretación revisadas'],
        ['F1 Datos e idealización', 'Parcial', 'Conexiones, excentricidades y contratos completos'],
        ['F2 Inventario de cargas', 'Parcial', 'Peso sin duplicaciones y composiciones trazables'],
        ['F3 Predimensionamiento', 'Pendiente', 'Propuestas verificables y reversibles'],
        ['F4 Motor espacial', 'Pendiente en 3D', 'Barras 3D, superficies y convergencia'],
        ['F5 Sitio y masas', 'Pendiente', 'Datos geotécnicos y masa conciliada'],
        ['F6 Análisis sísmico', 'Pendiente', 'Reglas E.030 y referencias independientes'],
        ['F7 Diseño de concreto', 'Pendiente', 'Combinaciones, resistencia, servicio y detalle'],
        ['F8 Cimentaciones', 'Pendiente', 'Terreno y concreto verificados por separado'],
        ['F9 Expediente final', 'Parcial en salidas', 'Planos, despiece y memoria coordinados'],
        ['F10 Validación y piloto', 'Inicial', 'Revisión independiente y piloto documentado'],
    ], [.29, .20, .51])
    d.add('<b>Lectura rápida:</b> avances en página 2; cierre de fases en páginas 3 y 4; próximas tareas en página 5; validación y responsabilidades en página 6; evidencias y fuentes en página 7.', 'small')

    d.new_page('Avances que ya podemos utilizar', 'Funciones disponibles y límites que permanecen abiertos')
    advances = [
        ('Modelo físico y edición', 'Columnas, vigas, losas y zapatas paramétricas; contorno de losas y huecos, edición numérica, desplazamiento paralelo de bordes y traslación sin deformación. Ctrl o Shift restringen el eje. Faltan placas, muros y otros sistemas; un sólido modelado no constituye un elemento diseñado.'),
        ('Metrados y uniones', 'Tabla con filtros, agrupación, edición de atributos y CSV. Booleanas con prioridad zapata > columna > viga > losa; se conserva volumen bruto, descuento y neto. El encofrado sigue estimado. Este descuento físico aún no reconcilia automáticamente el peso aplicado al solver.'),
        ('Modelo analítico y motor 2D', 'Grafo compartido de ejes centroidales, nudos, tramos y correspondencia GUID. Filtros XY y ZY; modelo de cálculo coincidente con el mostrado. Solver Timoshenko en worker, apoyos, liberaciones, cargas, reacciones, N/V/M y deformada. Límite de 500 nudos por plano; sin brazos rígidos ni solver espacial.'),
        ('Cargas y fuentes superficiales', 'PP de barras, D/L manuales y nodales separados. D adicional o D total con PP incluido. Fuentes de losa con área descontando huecos, propiedades declaradas, reparto porcentual a vigas horizontales y balance asignado/fuera/pendiente. Se bloquean repartos incompletos y conflictos con D/L manuales; no se valida la compatibilidad espacial del reparto.'),
        ('Normativa y persistencia', 'Perfil por proyecto, ediciones propuestas, evidencia y matriz de pendientes. Contrato con seis estados de verificación; ninguna regla RNE real está habilitada como comprobación validada. Guardado local y archivo de proyecto conservan geometría y entradas; los cambios invalidan resultados dependientes.'),
        ('Armadura y documentos', 'Jaulas manuales de vigas/columnas, transparencia y masa teórica. No hay diseño E.060 ni despiece constructivo completo. Memoria HTML del pórtico, balance CSV/JSON y proyecto exportable; no son todavía un expediente técnico coordinado.'),
    ]
    for title, text in advances:
        d.heading(title)
        d.add(text)
    d.add('<b>Evidencia de la última entrega de código:</b> 55 pruebas unitarias aprobadas, TypeScript y compilación correctos; cinco flujos de navegador aprobados. Se detalla su alcance en la página 7. Esta revisión documental no sustituye esas pruebas ni añade certificación.', 'small')

    d.new_page('Cierre de las fases F0 a F4', 'Prioridad P0 salvo F3  |  Responsables por asignar')
    phases = [
        ('F0 Base normativa y alcance', '<b>Falta:</b> confirmar tipología, exclusiones, revisor y proyecto piloto; revisar artículos, notas y aplicabilidad de cada edición de E.020/E.030/E.050/E.060. Confirmar oficio y anexos del solicitante. <b>Salida:</b> matriz artículo → requisito → datos → algoritmo → prueba, aprobada por el responsable técnico; reglas no revisadas bloqueadas. <b>Dependencia:</b> ninguna; condiciona la liberación de las demás fases.'),
        ('F1 Datos e idealización', '<b>Falta:</b> contratos de materiales, secciones, superficies, conexiones y restricciones; decisiones editables de excentricidad, brazos rígidos y transferencia entre revisiones. <b>Salida:</b> un único modelo analítico trazable, con pruebas de cruces, inclinados, cuerpos separados y mecanismos. Ninguna tolerancia debe ocultar una conexión incorrecta. <b>Dependencia:</b> alcance F0.'),
        ('F2 Inventario BIM de cargas', '<b>Falta:</b> conciliar PP por encuentros, verificar receptores espacialmente, registrar capas/usos/equipos/tabiques y revisar biblioteca E.020. Controlar el peso entre pórticos, no solo dentro de uno. <b>Salida:</b> nivel regular y nivel con huecos contra planilla independiente, sin omisiones ni doble conteo; fuerza y procedencia conciliadas. El neto físico no cambia la rigidez FEM. <b>Dependencia:</b> F0 y F1.'),
        ('F3 Predimensionamiento asistido', '<b>Falta:</b> métodos con dominio de uso, supuestos, alternativas e iteración del peso al cambiar secciones; distinguir heurística de comprobación normativa. <b>Salida:</b> propuesta preliminar reproducible, reversible y aceptada por el usuario, sin sustituir resistencia, servicio o sismo. <b>Dependencia:</b> F2; puede avanzar junto con F4 cuando sus datos estén controlados.'),
        ('F4 Solver espacial y superficies', '<b>Falta:</b> seleccionar motor y licencia, barras 3D, matrices dispersas, shells, mallado y diafragmas justificados. Conservar el motor 2D como regresión. <b>Salida:</b> referencias de axial/flexión/torsión, pórtico espacial, losa y muro; equilibrio, energía y convergencia. El reparto debe conservar fuerza y momento globales. <b>Dependencia:</b> F1 y F2; el reparto uniforme actual no cierra esta fase.'),
    ]
    for title, text in phases:
        d.heading(title)
        d.add(text)

    d.new_page('Cierre de las fases F5 a F10', 'Diseño integral y liberación del producto')
    phases = [
        ('F5 Sitio y fuente de masa', 'Contexto de ubicación, uso, sistema por dirección y estudio geotécnico trazable. Fuente de masa separada de combinaciones resistentes; pesos, masas, centros y exclusiones conciliados por nivel. No inferir suelo por ciudad o por presión admisible. <b>Depende de:</b> F0, F2 y F4.'),
        ('F6 Análisis y auditoría sísmica', 'Implementar métodos y reglas de la edición E.030 aplicable: modal/espectral, combinaciones, torsión, cortantes, irregularidades, derivas y estabilidad. Conservar resultados antes/después de ajustes. <b>Cierre:</b> casos normales, límites e incumplimientos con comparación independiente. <b>Depende de:</b> F0, F4 y F5.'),
        ('F7 Combinaciones y diseño E060', 'Combinaciones versionadas y esfuerzos concomitantes; resistencia, servicio y detallado por tipo de elemento y sistema. Anclajes, empalmes, confinamiento y constructibilidad cuando correspondan. <b>Cierre:</b> casos independientes favorables y desfavorables, sin mezclar máximos incompatibles. <b>Depende de:</b> F0, F4 y F6.'),
        ('F8 Cimentaciones E050 y E060', 'Primero zapatas; luego otras tipologías validadas. Separar servicio del terreno y diseño del concreto; contacto, presiones, asentamientos, estabilidad y punzonamiento. <b>Cierre:</b> carga centrada, excéntrica y pérdida de contacto contrastadas con hipótesis del estudio de suelos. <b>Depende de:</b> F4 a F7.'),
        ('F9 Detallado y expediente', 'Despiece real, mallas, partidas, memoria, planos y revisiones coordinadas. Definir exportación CAD efectivamente soportada y licencia; no prometer DWG o firma digital sin integración validada. <b>Cierre:</b> todos los entregables de una misma instantánea, con cantidades conciliadas y aprobación de revisión. <b>Depende de:</b> F7 y F8.'),
        ('F10 Validación independiente y piloto', 'Corpus versionado de ensayos; revisor distinto del implementador; piloto con expediente de referencia y discrepancias documentadas. Incluir rendimiento, recuperación y licencias. <b>Cierre:</b> resultados reproducibles, casos negativos detectados y límites publicados. <b>Dependencia:</b> transversal; condición obligatoria antes de liberar cada alcance.'),
    ]
    for title, text in phases:
        d.heading(title)
        d.add(text)

    d.new_page('Próximas tareas en orden de prioridad', 'Identificadores de seguimiento propuestos para las siguientes entregas')
    d.table(['Tarea', 'Entregable y prueba de aceptación', 'Dependencia'], [
        ['T01  P0\nF2 Peso propio', 'Asignar cada encuentro físico una sola vez a la ruta de cargas. Ensayo viga-columna-losa con hueco: peso de fuentes = peso asignado + exclusiones justificadas; sin modificar A ni I resistentes.', 'Base actual'],
        ['T02  P0\nF1/F2 Receptores', 'Comprobar ubicación, nivel, conectividad y cobertura de las vigas. Avisar incompatibilidades; conciliar porcentajes entre pórticos y preservar el residual y su sustento.', 'T01'],
        ['T03  P0\nF0 Normativa', 'Cerrar matriz E.020 y combinaciones E.060; revisar E.030 y transitorias aplicables. Cada regla requiere artículo, versión, datos, casos y aprobación técnica.', 'Puede avanzar junto a T01'],
        ['T04  P0\nF2 Composiciones', 'Capas, uso, densidad, espesor y fuente verificables. Bloquear datos ausentes y duplicaciones entre tabique modelado y carga equivalente. Comparar dos niveles con planilla.', 'T01-T03'],
        ['T05  P0\nF1/F4 Adaptador', 'Contrato de conexiones y superficies; decisión de motor 3D y licencia. Prototipo pequeño que conserve fuerzas y momentos; migración probada de proyectos.', 'Datos F1/F2'],
        ['T06  P0\nF10 Ensayos', 'Paquete independiente con datos, solución esperada, tolerancias y diferencias. Conservar regresiones 2D y criterios de rechazo, firmado por el revisor asignado.', 'Desde T01 y en cada entrega'],
    ], [.22, .60, .18])
    d.heading('Secuencia para llegar al producto integral')
    d.add('F0 y F1/F2 controladas → F4 espacial → F5 masas → F6 sismo → F7 concreto → F8 cimentaciones → F9 expediente. F3 puede desarrollarse después de F2; F10 acompaña toda la ruta y controla la liberación. Completar una demostración de una fase no elimina sus dependencias.')
    d.heading('Decisiones antes de comprometer fechas')
    d.add('Asignar responsable de cálculo y revisor independiente; fijar tipología y exclusiones del piloto; obtener expediente/estudio geotécnico autorizados; decidir motor y condiciones de licencia. Estimar cada tarea después de estos acuerdos. No hay una fecha ni un porcentaje global de finalización técnicamente sustentados todavía.')

    d.new_page('Control de calidad y responsabilidades', 'Qué debe acompañar cada entrega antes de considerarla cerrada')
    d.heading('Paquete mínimo de cierre')
    for text in [
        '<b>1. Especificación:</b> ID, fase, alcance, exclusiones, artículo/edición cuando corresponda, entradas con unidades y tratamiento de datos insuficientes.',
        '<b>2. Implementación:</b> versión de algoritmo y dependencias; errores explícitos, cancelación y bloqueo de resultados obsoletos; migración de datos existente.',
        '<b>3. Evidencia:</b> caso independiente con valores esperados, unidades y tolerancia fijada antes de ejecutar; casos límite, negativos y regresiones.',
        '<b>4. Revisión:</b> comparación documentada, discrepancias resueltas o excluidas con justificación y aprobación del responsable técnico.',
        '<b>5. Liberación:</b> manual, limitaciones y formatos reproducibles actualizados; respaldo y recuperación probados. Una salida preliminar no se etiqueta como expediente revisado.',
    ]:
        d.add(text)
    d.table(['Rol por asignar', 'Responsabilidad'], [
        ['Responsable del producto', 'Definir alcance, prioridades, piloto, exclusiones y recursos.'],
        ['Ingeniero calculista', 'Aprobar hipótesis, normativa aplicable, modelos y criterios técnicos.'],
        ['Desarrollo', 'Implementar contratos, motor, interfaz, migración y trazabilidad.'],
        ['QA y revisión independiente', 'Producir referencias, reproducir ensayos y registrar diferencias.'],
        ['Autor y revisor del expediente', 'Aprobar entregables del proyecto dentro de sus competencias.'],
    ], [.33, .67])
    d.heading('Estados que no deben confundirse')
    d.add('<b>Trabajo:</b> por especificar → especificado → implementado → probado → revisado → habilitado. <b>Comprobación:</b> no evaluado, datos insuficientes, no aplica justificado, cumple, no cumple u obsoleto. El contrato de estos estados existe; las reglas RNE reales permanecen pendientes. Ni el color de una vista ni un equilibrio numérico favorable certifican un edificio.')
    d.add('<b>Riesgos abiertos:</b> peso duplicado en encuentros del solver; idealizaciones no revisadas; distribución superficial sin control espacial/momento; ausencia de masa y solver 3D; licencia del motor; dependencia de datos y revisión profesional. Las mitigaciones son T01-T06 y las puertas de aceptación de cada fase.', 'small')

    d.new_page('Evidencia y referencias de seguimiento', 'Cómo comprobar el avance y mantener actualizado este informe')
    d.heading('Ejecución registrada en la última entrega')
    d.add('55 pruebas unitarias aprobadas; verificación TypeScript y compilación Vite correctas. Cinco flujos de navegador: superficies, balance de cargas, vistas duales, ejemplos y prueba general. Incluyen escritorio/móvil, persistencia, exportaciones e invalidación. Las advertencias de compilación sobre tamaño del paquete y externalización de node:module por Manifold permanecen como deuda técnica; no se presentaron como resueltas.')
    d.table(['Referencia', 'Resultado esperado o alcance'], [
        ['Viga biapoyada', 'L=6 m, q=10 kN/m, PP=0: Ry=30 kN en cada apoyo; |M|max=45 kN m.'],
        ['Declaración de D', 'L=6 m; PP=3.6, D=10 y L=2 kN/m: 93.6 kN con D adicional; 72 kN con D total que incluye PP.'],
        ['Fuente superficial', 'Área=23 m2; h=0.20 m; peso unitario=24 kN/m3; D adicional=1.2 y L=2 kN/m2: D=138 y L=46 kN. Al 50%: 69 y 23 kN.'],
        ['Oficinas de 8 niveles', '827 elementos; pórtico de 103 nudos y 136 tramos de 88 elementos BIM. Integración, no edificio certificado.'],
    ], [.27, .73])
    d.heading('Fuentes internas')
    d.add('Plan maestro: docs/PLAN_RNE_Y_REQUERIMIENTOS.md, secciones 6 y 11 a 14. Implementación: src/core/analysis, src/core/model, src/core/normative y src/ui. Evidencia reproducible: tests/surface-loads.test.ts, tests/load-ledger.test.ts y scripts de navegador declarados en package.json. La sección 4 del plan es un diagnóstico histórico; los avances posteriores y este corte evitan interpretarla como estado vigente.', 'small')
    d.heading('Fuentes oficiales para la revisión normativa')
    d.add('La publicación del MVCS identifica la modificación de E.030 mediante la <link href="https://www.gob.pe/institucion/vivienda/normas-legales/8081915-183-2026-vivienda" color="#155c7a">RM 183-2026-VIVIENDA</link>. La <link href="https://www.gob.pe/institucion/vivienda/normas-legales/8219609-217-2026-vivienda" color="#155c7a">RM 217-2026-VIVIENDA</link> modifica su disposición transitoria para proyectos en curso. El perfil debe justificar la edición aplicable; esta referencia no reemplaza la revisión integral del texto técnico.', 'small')
    d.add('<link href="https://www.gob.pe/institucion/vivienda/informes-publicaciones/2309793-reglamento-nacional-de-edificaciones-rne" color="#155c7a">Compendio oficial RNE del MVCS</link>: localizar E.020, E.030, E.050 y E.060 y revisar sus modificatorias. Consulta de publicaciones: 20 de septiembre de 2026. El historial atribuido al CIP es un insumo del proyecto; no constituye por sí solo homologación, norma ni autorización.', 'small')
    d.add('<b>Actualización sugerida:</b> al cerrar cada T01-T06 y cada fase, registrar versión, evidencia, fecha, responsable y aprobación; reemplazar el estado solo cuando se cumpla su puerta de aceptación.', 'small')
    d.finish()


def user_guide():
    d = Document('ARM_Guia_de_uso_actual.pdf', 'ARM Structural Guía de uso de funciones implementadas', 'GUÍA DE USO', 9)
    d.new_page('Guía de uso de ARM Structural', 'Funciones implementadas al 20 de septiembre de 2026')
    d.add('Esta guía describe el uso actual: modelado y edición, metrados, vistas físicas y analíticas, análisis 2D, fuentes superficiales y exportación. <b>Utilice copias de ensayo hasta que cada alcance haya sido validado profesionalmente.</b> Las cargas, materiales y factores introducidos son responsabilidad de quien define el modelo; los ejemplos no acreditan cumplimiento del RNE.')
    d.heading('Inicio seguro')
    d.add('<b>1.</b> Abra <link href="http://127.0.0.1:3015/" color="#155c7a">http://127.0.0.1:3015/</link> con el servidor local en ejecución. Si no responde, desde la carpeta del proyecto ejecute <font name="Courier">pnpm dev --port 3015</font>. No cambie de puerto u origen esperando recuperar automáticamente el mismo almacenamiento del navegador.')
    d.add('<b>2.</b> Antes de abrir otro proyecto o cargar un ejemplo, pulse <b>Guardar</b>. Se descarga proyecto.arm.json; conserve una copia identificada por fecha/revisión. El guardado automático local no sustituye este respaldo.')
    d.add('<b>3.</b> Para empezar una prueba, pulse <b>Ejemplos</b>, seleccione un caso y elija <b>Cargar modelo</b> o <b>Cargar y analizar</b>. Confirme el reemplazo solo después de respaldar su proyecto. Para el primer cálculo use la viga biapoyada.')
    d.table(['Control', 'Uso actual'], [
        ['Guardar / Abrir', 'Exportar el proyecto o importar un archivo y reemplazar el modelo con confirmación.'],
        ['Tablas', 'Metrados, filtros, agrupación y exportación CSV.'],
        ['Análisis', 'Definir el pórtico, apoyos, cargas, cálculo y memoria.'],
        ['Normativa', 'Registrar alcance, edición propuesta y evidencia; no ejecutar diseño normativo.'],
        ['Físico / Analítico', 'Cambiar representación; Comparar activa dos vistas vinculadas.'],
    ], [.31, .69])
    d.heading('Unidades que no deben mezclarse')
    d.add('Geometría: m. Fuerza: kN. Carga lineal: kN/m. Carga superficial: kN/m2. Peso unitario: kN/m3. Módulo E: MPa. Momento: kN m. Desplazamientos de resultados: mm. Resistencia del concreto en el catálogo: kgf/cm2. Masa teórica de acero: kg. No intercambie kg, kgf, toneladas de masa y toneladas-fuerza.')
    d.add('<b>PP</b> significa peso propio; <b>D</b>, carga permanente; <b>L</b>, carga viva. La letra L también puede representar longitud en las fórmulas de los ejemplos: la unidad m o kN/m permite distinguirla.', 'small')
    d.add('Contenido: geometría p. 2; metrados p. 3; vistas p. 4; análisis p. 5; superficies p. 6; ejercicios p. 7; respaldos y normativa p. 8; problemas frecuentes p. 9.', 'small')

    d.new_page('Modelar y editar sin deformar', 'Elementos soportados  |  Vigas, columnas, losas y zapatas')
    d.heading('Crear y revisar la geometría')
    d.add('Seleccione el nivel de trabajo y la herramienta estructural correspondiente. Defina puntos y dimensiones, y revise el elemento en planta y 3D. La edición paramétrica permite corregir posiciones/extremos y dimensiones. La geometría validada alimenta el metrado y el modelo analítico derivado; no introduzca un volumen manual para corregir una geometría errónea.')
    d.heading('Editar el contorno de una losa')
    for text in [
        '<b>1.</b> Seleccione la losa y pulse <b>Editar contorno</b>. Se abre un borrador; revise el anillo Exterior o el Hueco elegido, espesor y cota.',
        '<b>2.</b> Para desplazar un lado sin inclinarlo, arrastre el <b>control central del borde</b>, no una esquina. El lado se desplaza paralelo y conserva las direcciones de sus vecinos.',
        '<b>3.</b> Para restringir un arrastre o un segmento nuevo, mantenga <b>Ctrl o Shift</b>, o active <b>Ortogonal</b> en el editor. La restricción mantiene el eje dominante mientras esté activa.',
        '<b>4.</b> Para trasladar toda la losa sin cambiar forma, dimensiones ni huecos, use la cruz central o <b>Mover elemento completo</b>. En el modelo, el control central amarillo traslada el elemento completo.',
        '<b>5.</b> Para crear un hueco, use <b>Dibujar hueco</b>, marque sus vértices y pulse <b>Cerrar trazo</b>. Para reemplazar el anillo exterior use <b>Dibujar contorno</b>. Descartar trazo elimina únicamente el trazo en curso.',
        '<b>6.</b> Ajuste los vértices numéricamente cuando necesite precisión. Revise que los huecos estén dentro del exterior y no se crucen. Use Deshacer/Rehacer para corregir el borrador.',
        '<b>7.</b> Pulse <b>Finalizar</b> para aplicar, o <b>Cancelar</b> para descartar el borrador. Se rechazan contornos cruzados, huecos exteriores y dimensiones inválidas.',
    ]:
        d.add(text)
    d.heading('Diferencia entre esquina y borde')
    d.add('Una esquina modifica un vértice individual y puede inclinar los lados adyacentes: es un comportamiento de edición, no una traslación rígida. Use el punto medio del borde para cambiar un lado y el control de movimiento para mover todo el elemento. Escape cancela el arrastre activo en el modelo.')
    d.add('<b>Después de cambiar geometría:</b> espere la actualización del metrado y revise el análisis. La regeneración del plano reinicia apoyos, cargas, fuentes superficiales y liberaciones con confirmación. Registre o exporte las entradas antes de regenerar.', 'small')

    d.new_page('Cuantificación y armadura manual', 'Cantidades derivadas  |  No equivalen a un presupuesto o despiece definitivo')
    d.heading('Consultar y exportar metrados')
    for text in [
        '<b>1.</b> Abra <b>Tablas</b>. Espere que las cantidades netas estén disponibles; no interprete un cálculo pendiente o fallido como un volumen igual a cero.',
        '<b>2.</b> Filtre categoría, nivel, sector y texto. Agrupe por Ejemplar, Tipo y resistencia, Nivel o Categoría. Ordene con las cabeceras; cambie la cantidad de filas y navegue entre páginas.',
        '<b>3.</b> Revise volumen bruto, descuento de solapes y concreto neto. El total mostrado corresponde al filtro. Exportar CSV incluye todos los resultados filtrados, no solo la página visible.',
        '<b>4.</b> En filas de ejemplar, edite los atributos habilitados, como marca, sector y resistencia. Use selección múltiple para aplicar sector. Ver en modelo localiza el elemento; confirme cuidadosamente cualquier eliminación.',
    ]:
        d.add(text)
    d.table(['Dato', 'Interpretación'], [
        ['Concreto neto', 'Bruto menos intersecciones atribuidas a elementos con mayor prioridad: zapata, columna, viga y losa.'],
        ['Peso del análisis', 'No se obtiene automáticamente del volumen neto. Las barras y fuentes superficiales conservan sus convenciones declaradas.'],
        ['Encofrado', 'Estimación geométrica por categoría; no descuenta todas las caras de contacto.'],
        ['Costo', 'Estimación con precio unitario y volumen neto; la interfaz lo presenta en USD. Los ejemplos no contienen un presupuesto validado.'],
    ], [.27, .73])
    d.heading('Mostrar y editar armadura')
    d.add('Seleccione una viga o columna. Abra el botón <b>Armadura manual del elemento</b>; introduzca recubrimiento, diámetros, barras longitudinales y estribos en las unidades que indica cada campo. Pulse <b>Aplicar</b>. Active <b>Armadura</b> y, si necesita verla dentro del concreto, <b>Transparente</b>. Quitar elimina la especificación manual; Cancelar descarta el formulario.')
    d.add('<b>Límites:</b> jaulas geométricas sin diseño E.060, sin ganchos, radios de doblado, anclajes, empalmes ni despiece de taller. No hay mallas de losas/zapatas. La masa es teórica y no debe sumarse otra vez al peso cuando su convención de concreto armado ya incorpora el acero. Una jaula incompatible deja el metrado no disponible.', 'small')

    d.new_page('Vistas físicas y analíticas', 'La perspectiva del edificio no significa que exista un cálculo estructural 3D')
    d.table(['Opción', 'Qué representa y cuándo usarla'], [
        ['Físico', 'Sólidos, uniones, selección, transparencia y armadura manual. Útil para revisar geometría y metrados.'],
        ['Analítico con Ejes neutros 3D', 'Ejes centroidales y nudos geométricos. Filtre Todos los pórticos, X-Y por Z o Z-Y por X para inspeccionar un marco.'],
        ['Analítico con Plano de cálculo 2D', 'Idealización configurada en Análisis, apoyos y cargas del caso; resultados solo si están vigentes.'],
        ['3D / Planta / Frontal', 'Proyección de la vista. Frontal se orienta según el plano seleccionado. Encuadrar ajusta el modelo a la ventana.'],
        ['Comparar', 'Dos vistas con cámaras y selección vinculadas. Aislar selección permite concentrarse en elementos concretos.'],
    ], [.39, .61])
    d.heading('Evitar la apariencia de líneas duplicadas')
    d.add('Para ver un pórtico unifilar, seleccione Analítico, Ejes neutros 3D, el plano y su coordenada; desactive <b>Contornos de losas</b>. Estos contornos son geometría auxiliar, no otra viga ni una malla FEM. Varias estructuras pueden superponerse visualmente si muestra todos los pórticos en una vista frontal.')
    d.heading('Consultar cargas y resultados')
    d.add('Después de calcular, seleccione <b>Plano de cálculo 2D</b>. Active Nudos, Apoyos y Cargas según lo que desee inspeccionar. El selector de diagrama ofrece Axial N, Cortante V, Momento M y Deformada. Lea la unidad, máximo y escala gráfica; la deformada está amplificada, no es el desplazamiento real a escala geométrica.')
    d.add('Cambiar cámara o filtro visual no cambia los datos enviados al solver. Para analizar otro plano debe configurarlo y generarlo en Análisis. Si el modelo queda obsoleto, los diagramas no deben interpretarse como resultados vigentes.')
    d.heading('Control de conectividad')
    d.add('Un contacto entre sólidos no garantiza una unión analítica. Los ejes se cortan y se unen dentro de la tolerancia definida, sin crear brazos rígidos o prolongaciones automáticas. Revise nudos compartidos, conexiones reales, apoyos y liberaciones. Aumentar la tolerancia para hacer desaparecer un error puede conectar elementos que físicamente deberían estar separados.')

    d.new_page('Configurar y calcular un pórtico', 'Motor lineal elástico de barras Timoshenko  |  Máximo 500 nudos por plano')
    for text in [
        '<b>1.</b> Abra <b>Análisis</b>. Defina XY con Z constante o ZY con X constante, coordenada, tolerancia de unión, E en MPa y peso unitario de barras en kN/m3. Ambos extremos del eje deben pertenecer al plano.',
        '<b>2.</b> Pulse <b>Generar plano</b>. Si ya existía un modelo, la confirmación advierte el reinicio de sus entradas. Si el ejemplo ya trae un plano válido y desea conservarlo, no lo regenere sin necesidad.',
        '<b>3.</b> En <b>Nudos y cargas</b>, defina apoyos Libre, Empotrado, Articulado o Rodillo vertical. Empotrar bases es una asignación práctica a los nudos inferiores, no una justificación geotécnica. Ingrese Fh, Fy y momento con signos coherentes.',
        '<b>4.</b> En <b>Barras</b>, revise tramo, GUID/rango de origen, sección y liberaciones. Ingrese D/L manuales y su referencia. Si una viga está subdividida, cada fila es un tramo: no repita una fuerza total como si fuera una carga por metro.',
        '<b>5.</b> Defina nombre de caso y factores D, L y nodal. Son factores manuales, no combinaciones normativas automáticas. Las cargas distribuidas positivas actúan hacia abajo; Fy nodal positiva actúa hacia arriba. Momento y giro positivos son horarios en el plano H-Y.',
        '<b>6.</b> Revise <b>Balance de cargas</b> y resuelva los bloqueos. Pulse <b>Calcular</b>. Examine reacciones, desplazamientos y fuerzas; el residuo de equilibrio verifica el problema ingresado, no la idoneidad del sistema estructural.',
    ]:
        d.add(text)
    d.table(['Declaración de D', 'Carga permanente utilizada'], [
        ['D adicional', 'PP automático de barra + D manual. Es el modo exigido en receptores de fuentes superficiales.'],
        ['D total incluye PP', 'Solo D manual; excluye el PP automático de ese tramo. Requiere sustento antes de calcular; no comprueba por sí mismo que el total sea correcto.'],
    ], [.34, .66])
    d.add('Las superficies aportan D y L adicionales desde su registro separado, con los mismos factores del caso. Para evitar doble conteo, sus receptores no pueden conservar D/L manuales distintos de cero. No existe una elección automática de qué carga manual debe reemplazarse.')
    d.add('<b>Resultados y memoria:</b> modificar cargas, factores, apoyos o fuentes exige recalcular. Cambiar geometría o parámetros de generación exige regenerar y revisar entradas. No hay análisis modal, segundo orden, shells ni diseño resistente en esta pantalla.', 'small')

    d.new_page('Registrar cargas superficiales', 'Una fuente por losa  |  Reparto uniforme declarado hacia vigas horizontales')
    for text in [
        '<b>1.</b> Termine primero la geometría y genere un plano analítico vigente. Abra <b>Análisis → Superficies</b>. Si aparece Sin losas, incorpore una losa BIM; esta pestaña no dibuja geometría.',
        '<b>2.</b> Seleccione la losa. Compruebe el área con huecos y el espesor tomados de BIM. Ingrese peso unitario, D sobrepuesta y L; incluya cero cuando corresponda, sin dejar un campo numérico obligatorio vacío.',
        '<b>3.</b> En Sustento de cargas y reparto registre composición, uso, fuente y criterio de asignación. Una referencia escrita no convierte el valor en una carga normativa verificada.',
        '<b>4.</b> Ingrese el porcentaje de la fuente para cada viga receptora del pórtico. La lista admite vigas horizontales, pero todavía no verifica su compatibilidad espacial con la losa: revise ubicación, dirección, nivel y ruta de cargas.',
        '<b>5.</b> Si parte corresponde a otro pórtico, declare <b>Fuera del pórtico</b> y su sustento. Receptores + fuera deben sumar 100% para calcular. No use el campo fuera para ocultar una carga sin destino; el programa no comprueba que otro modelo la haya recibido.',
        '<b>6.</b> Pulse <b>Guardar fuente</b>. Un borrador incompleto puede guardarse; el cálculo permanece bloqueado. Una asignación mayor de 100% se rechaza. Use el lápiz para editar y la papelera para eliminar una fuente guardada.',
        '<b>7.</b> Si aparece Requiere conciliación en Barras, revise el origen de D/L manuales en todos los tramos receptores. Solo después de reconstruir las cargas sin perder componentes, deje D/L manual=0 y seleccione D adicional. En oficinas las cargas equivalentes ya representan losas; no agregue otra fuente encima.',
        '<b>8.</b> Abra Balance de cargas: revise D/L total, al pórtico, fuera y pendiente, y el detalle por receptor. Calcule nuevamente. Las cargas se contabilizan en las vigas una sola vez, no también como un segundo total en la fila de losa.',
    ]:
        d.add(text)
    d.heading('Qué calcula esta función')
    d.add('D de la fuente = área × (espesor × peso unitario + D sobrepuesta). L de la fuente = área × L superficial. Cada porcentaje se transforma en carga uniforme sobre la longitud analítica total de la viga y se distribuye entre sus tramos sin multiplicarla.')
    d.add('<b>Qué no calcula:</b> reparto tributario automático, rigidez de placa, momento resultante de la fuente, compatibilidad espacial ni reparto entre pórticos. Usa el volumen bruto de losa con huecos, sin descontar encuentros. Guardar fuente aplica el borrador; cambiar de losa o salir antes de guardarlo puede descartar lo que estaba escribiendo.', 'small')

    d.new_page('Ejercicios para comprobar el flujo', 'Datos de ensayo  |  No son cargas o dimensiones prescritas por el RNE')
    d.heading('Ejercicio A con la viga biapoyada')
    d.add('<b>1.</b> Respalde el proyecto. Abra Ejemplos, seleccione Viga biapoyada y Cargar y analizar. <b>2.</b> Conserve el plano y sus entradas; pulse Calcular si todavía no hay resultados. <b>3.</b> Compruebe L=6 m, q=10 kN/m y PP=0: reacción de 30 kN en cada apoyo y momento máximo absoluto de 45 kN m. <b>4.</b> Exporte Memoria. Cambie una carga: el resultado y la comparación de referencia dejan de estar vigentes hasta recalcular; ya no es el ensayo original.')
    d.heading('Ejercicio B sobre una fuente superficial')
    d.add('Para un ensayo controlado, prepare una viga horizontal biapoyada de 6 m y una losa rectangular de 6 × 4 m con hueco de 1 × 1 m. Complete la geometría antes de generar el plano. Configure PP de barras=0, D/L manual=0 y factores=1. En la fuente: espesor 0.20 m, peso unitario 24 kN/m3, D sobrepuesta 1.2 kN/m2, L=2 kN/m2; 50% al receptor y 50% fuera con sustento.')
    d.table(['Comprobación', 'Valor esperado'], [
        ['Área de losa con hueco', '24 - 1 = 23 m2'],
        ['D / L totales de la fuente', '138 / 46 kN'],
        ['D / L aplicadas al 50%', '69 / 23 kN'],
        ['Fy del caso y reacciones', 'Fy = -92 kN; Ry = 46 kN por apoyo'],
        ['Pendiente sin declarar el otro 50%', 'D = 69 kN y L = 23 kN; cálculo bloqueado'],
    ], [.52, .48])
    d.picture('surface-editor-desktop.png', 'Captura del ensayo automatizado: fuente guardada, propiedades y receptor. La marca de la losa puede variar.', 280)
    d.add('El 50% es una hipótesis de ensayo, no una regla de transferencia. La igualdad numérica valida la aplicación de la declaración; no demuestra que ese reparto sea estructuralmente correcto para un edificio.', 'small')

    d.new_page('Normativa respaldos y entregables', 'Qué se guarda y qué debe recalcularse')
    d.heading('Registrar el perfil normativo')
    d.add('<b>1.</b> Abra Normativa y describa el alcance del proyecto. <b>2.</b> Seleccione la edición propuesta de cada norma solo con sustento de aplicabilidad; complete justificación y referencia. <b>3.</b> Pulse Guardar perfil. Cancelar descarta el borrador. <b>4.</b> Matriz exporta el perfil guardado con sus fuentes y pendientes. Guarde antes de exportar para incluir la última edición.')
    d.add('Las reglas reales de E.020/E.030/E.050/E.060 siguen pendientes. Completar el perfil no ejecuta sismo, combinaciones ni diseño. La actualización E.030 de 2026 (<link href="https://www.gob.pe/institucion/vivienda/normas-legales/8081915-183-2026-vivienda" color="#155c7a">RM 183</link>) y su disposición transitoria (<link href="https://www.gob.pe/institucion/vivienda/normas-legales/8219609-217-2026-vivienda" color="#155c7a">RM 217</link>) requieren revisión de aplicabilidad; no seleccione una edición por preferencia para obtener un resultado favorable.')
    d.heading('Guardar y recuperar el proyecto')
    d.add('Espere Guardado local para confirmar la escritura automática. Cambios pendientes o Sin guardar requieren atención. Use Guardar para descargar proyecto.arm.json; Abrir permite importar con confirmación de reemplazo. El archivo conserva geometría, propiedades, niveles, ejes, armadura manual, configuración de análisis, fuentes superficiales y perfil normativo.')
    d.add('El proyecto guarda entradas, no un resultado FEM listo para reutilizar: después de recuperar, recalcule. Si la geometría o generación es incompatible, se conserva el plano como obsoleto y debe regenerarse. Exportar el Modelo analítico no equivale a respaldar todo el proyecto BIM. El guardado local depende del navegador/origen y puede perderse al limpiar sus datos.')
    d.table(['Salida', 'Procedimiento y alcance'], [
        ['Proyecto completo', 'Guardar: proyecto.arm.json. Es la copia para continuar el trabajo.'],
        ['Metrados', 'Tablas → Exportar CSV. Todas las filas filtradas, no solo las visibles.'],
        ['Balance de cargas', 'Análisis → Balance de cargas → CSV o JSON. Incluye factores, fuentes, receptores, pendientes y unidades.'],
        ['Modelo analítico', 'Análisis → Modelo. Datos del plano y resultados disponibles; no todo el modelo físico.'],
        ['Memoria de pórtico', 'Después de calcular, Análisis → Memoria. HTML imprimible; use imprimir a PDF en el navegador si necesita una copia de lectura.'],
        ['Matriz normativa', 'Normativa → Matriz. JSON documental del perfil guardado; no certificado de cumplimiento.'],
    ], [.30, .70])
    d.add('No emita la memoria de pórtico como expediente integral: faltan verificaciones sísmicas, diseño, cimentaciones y documentación coordinada. La revisión profesional no se sustituye con estas exportaciones.', 'small')

    d.new_page('Resolver problemas y cerrar una sesión', 'Diagnóstico práctico antes de modificar datos')
    d.table(['Mensaje o síntoma', 'Acción recomendada'], [
        ['No hay barras en el plano', 'Revise XY/ZY y coordenada; ambos extremos del eje deben estar en el plano. Un cruce proyectado no es pertenencia al pórtico.'],
        ['Plano no vigente o Calcular deshabilitado', 'Compruebe cambios de geometría o parámetros. Respalde las entradas y regenere cuando corresponda; reconstruya apoyos, cargas y fuentes.'],
        ['Restricciones insuficientes o mecanismo', 'Revise conectividad, apoyos y liberaciones. No agregue empotramientos arbitrarios para hacer pasar el cálculo.'],
        ['Tramos colapsados', 'Revise geometría y tolerancia; una unión excesiva puede eliminar longitud. No se omiten esos tramos silenciosamente.'],
        ['Reparto superficial incompleto', 'Complete referencia y porcentajes; receptores + fuera = 100%. Sustente todo porcentaje fuera.'],
        ['Conciliar cargas manuales', 'Reconstruya los componentes representados por D/L manuales antes de dejarlos en cero. El receptor superficial exige modo adicional.'],
        ['D total sin referencia', 'Ingrese el sustento del total, o corrija la declaración si D era adicional. No cambie el modo solo para evadir el bloqueo.'],
        ['Armadura o metrado no disponible', 'Verifique especificación, compatibilidad de jaula y estado de cantidades. Un dato pendiente no es cero.'],
        ['Cambios no reflejados en el balance', 'Guarde la fuente o confirme el editor; distinga borrador de datos aplicados. Luego recalcule para actualizar reacciones y memoria.'],
    ], [.36, .64])
    d.heading('Lista de cierre')
    d.add('Confirme ediciones; revise geometría y unidades; resuelva advertencias; compruebe balance y reacciones; identifique cargas fuera del alcance; exporte proyecto y salidas necesarias; espere Guardado local; registre qué verificaciones siguen pendientes. No continúe a una fase no implementada como si hubiera sido aprobada.')
    d.heading('Apoyo para mantenimiento y pruebas')
    d.add('Desde la carpeta del proyecto: pnpm lint, pnpm test, pnpm build. Con el servidor activo: pnpm test:surfaces, pnpm test:loads y pnpm test:dual. Estos ensayos son controles de software, no certificación RNE. El informe de avances adjunto desarrolla la ruta F0-F10 para completar y validar el producto.', 'small')
    d.finish()


if __name__ == '__main__':
    progress_report()
    user_guide()
