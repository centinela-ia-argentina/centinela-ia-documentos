// 📝 Biblioteca de modelos de escritos — bases orientativas y editables.
// Las variables se escriben entre llaves dobles, por ejemplo {{nombre_parte}},
// y se detectan y completan solas. Agregá, quitá o editá modelos libremente.

export type ReviewStatus = 'verified' | 'pending_review' | 'outdated' | 'retired';

export type ModeloEscrito = {
  id: string;
  titulo: string;
  categoria: string;
  descripcion: string;
  cuerpo: string;
  industries?: string[];
  jurisdiction?: string;
  practiceArea?: string;
  courtLevel?: string;
  proceduralStage?: string;
  purpose?: string;
  legalBasis?: string;
  lastVerifiedAt?: string;
  lastReviewedAt?: string;
  effectiveFrom?: string;
  officialSources?: string[];
  reviewedBy?: string;
  changeNotes?: string;
  version?: string;
  reviewStatus?: ReviewStatus;
  professionalDisclaimer?: string;
};

const RAW_MODELOS: ModeloEscrito[] = [
  {
    id: 'reserva-oferta-compra',
    titulo: 'Reserva / Oferta de compra',
    categoria: 'Inmobiliaria',
    descripcion: 'Oferta de compra con seña de reserva, ad referéndum de la aceptación del propietario.',
    industries: ['inmobiliaria'],
    cuerpo: `RESERVA — OFERTA DE COMPRA

En {{lugar}}, a los {{fecha}}, el/la Sr./Sra. {{oferente}}, DNI N° {{dni_oferente}}, con domicilio en {{domicilio_oferente}} (en adelante, "el/la OFERENTE"), por intermedio de {{inmobiliaria}}, formula la presente OFERTA DE COMPRA sobre el inmueble que se describe, y entrega en este acto una suma en concepto de RESERVA.

1. INMUEBLE
Ubicación: {{direccion_inmueble}}.
Tipo: {{tipo_inmueble}}.
Matrícula / Nomenclatura catastral: {{matricula}}.
Titular registral: {{titular}}.

2. PRECIO OFRECIDO
El/la OFERENTE ofrece adquirir el inmueble en la suma de {{moneda}} {{precio}} ({{precio_en_letras}}), pagaderos de la siguiente forma: {{forma_de_pago}}.

3. RESERVA ENTREGADA
En este acto el/la OFERENTE entrega la suma de {{moneda}} {{monto_reserva}} ({{monto_reserva_en_letras}}) en concepto de reserva, que {{inmobiliaria}} recibe ad referéndum de la aceptación del/de la propietario/a.

4. PLAZO DE ACEPTACIÓN
La oferta se mantiene vigente hasta el {{plazo_aceptacion}}, plazo dentro del cual el/la propietario/a deberá manifestar su aceptación.

5. EFECTOS
a) Si el/la propietario/a ACEPTA: la suma entregada se imputa como seña y a cuenta del precio, y las partes se obligan a firmar el boleto de compraventa dentro de los {{dias_para_boleto}} días.
b) Si el/la propietario/a NO ACEPTA: la suma se reintegra íntegramente al/a la OFERENTE, sin derecho a reclamo alguno.
c) Si, aceptada la oferta, el/la OFERENTE desiste: pierde la suma entregada en concepto de reserva.

6. OBSERVACIONES
{{observaciones}}

Firma del/de la OFERENTE: ____________________
Aclaración: {{oferente}} — DNI {{dni_oferente}}

Por {{inmobiliaria}}: ____________________
Aclaración: {{agente}}`,
  },
  {
    id: 'autorizacion-venta',
    titulo: 'Autorización de venta',
    categoria: 'Inmobiliaria',
    descripcion: 'Encargo del propietario a la inmobiliaria para comercializar el inmueble (exclusividad, plazo, comisión y precio).',
    industries: ['inmobiliaria'],
    cuerpo: `AUTORIZACIÓN DE VENTA

En {{lugar}}, a los {{fecha}}, el/la Sr./Sra. {{propietario}}, DNI N° {{dni_propietario}}, con domicilio en {{domicilio_propietario}} (en adelante, "el/la PROPIETARIO/A"), en su carácter de titular del inmueble que se describe, AUTORIZA a {{inmobiliaria}} (en adelante, "la INMOBILIARIA") a ofrecer en venta el mismo, en los términos que siguen.

1. INMUEBLE
Ubicación: {{direccion_inmueble}}.
Tipo: {{tipo_inmueble}}.
Matrícula / Nomenclatura catastral: {{matricula}}.

2. PRECIO DE PUBLICACIÓN
El inmueble se ofrecerá en la suma de {{moneda}} {{precio}} ({{precio_en_letras}}). Toda oferta por un monto distinto será comunicada al/a la PROPIETARIO/A para su aceptación.

3. TIPO DE AUTORIZACIÓN
La presente autorización se otorga en carácter {{tipo_autorizacion}} (exclusiva / no exclusiva).

4. PLAZO
La autorización tendrá una vigencia de {{plazo_meses}} meses a partir de la fecha, renovable de común acuerdo. Vencido el plazo sin renovación, quedará sin efecto.

5. COMISIÓN / HONORARIOS
En caso de concretarse la operación, la INMOBILIARIA percibirá en concepto de comisión el {{porcentaje_comision}} %, a cargo de {{cargo_comision}}, conforme los usos y aranceles vigentes.

6. FACULTADES
La INMOBILIARIA queda facultada para publicar y exhibir el inmueble, colocar cartelería, mostrarlo a interesados y recibir reservas u ofertas de compra ad referéndum de la aceptación del/de la PROPIETARIO/A.

7. OBSERVACIONES
{{observaciones}}

Firma del/de la PROPIETARIO/A: ____________________
Aclaración: {{propietario}} — DNI {{dni_propietario}}

Por {{inmobiliaria}}: ____________________
Aclaración: {{agente}}`,
  },
  {
    id: 'boleto-compraventa',
    titulo: 'Boleto de compraventa',
    categoria: 'Inmobiliaria',
    descripcion: 'Contrato preliminar de compraventa: partes, inmueble, precio, seña, posesión, escrituración y gastos.',
    industries: ['inmobiliaria'],
    cuerpo: `BOLETO DE COMPRAVENTA

En {{lugar}}, a los {{fecha}}, entre {{vendedor}}, DNI N° {{dni_vendedor}}, con domicilio en {{domicilio_vendedor}} (en adelante, "el/la VENDEDOR/A"), y {{comprador}}, DNI N° {{dni_comprador}}, con domicilio en {{domicilio_comprador}} (en adelante, "el/la COMPRADOR/A"), se conviene el presente boleto de compraventa, sujeto a las siguientes cláusulas:

PRIMERA — INMUEBLE
El/la VENDEDOR/A vende al/a la COMPRADOR/A el inmueble sito en {{direccion_inmueble}}, tipo {{tipo_inmueble}}, identificado con matrícula / nomenclatura catastral {{matricula}}, con una superficie de {{superficie}}, que el/la COMPRADOR/A declara conocer y aceptar en el estado en que se encuentra.

SEGUNDA — PRECIO
El precio total y definitivo de la operación se fija en la suma de {{moneda}} {{precio}} ({{precio_en_letras}}), que las partes declaran de mutuo acuerdo.

TERCERA — FORMA DE PAGO
En este acto el/la COMPRADOR/A entrega en concepto de seña y a cuenta de precio la suma de {{moneda}} {{monto_sena}} ({{monto_sena_en_letras}}), sirviendo el presente de suficiente recibo. El saldo de {{moneda}} {{saldo}} se abonará de la siguiente forma: {{forma_pago_saldo}}.

CUARTA — POSESIÓN
La posesión del inmueble será entregada al/a la COMPRADOR/A el día {{fecha_posesion}}, libre de ocupantes y de deudas por servicios e impuestos hasta esa fecha.

QUINTA — ESCRITURACIÓN
La escritura traslativa de dominio se otorgará dentro de los {{dias_escrituracion}} días, ante el/la escribano/a designado/a por {{escribano_designado}}. El/la VENDEDOR/A se obliga a entregar el inmueble libre de gravámenes, inhibiciones y deudas.

SEXTA — GASTOS E IMPUESTOS
Los gastos de escrituración, sellados e impuestos que graven la operación estarán a cargo de {{cargo_gastos}}, conforme la ley y los usos de plaza.

SÉPTIMA — SEÑA Y ARREPENTIMIENTO
La seña se rige por los arts. 1059 y 1060 del Código Civil y Comercial. En caso de incumplimiento del/de la COMPRADOR/A, perderá la seña entregada; si el incumplimiento fuera del/de la VENDEDOR/A, deberá restituirla duplicada, sin perjuicio de las acciones que correspondan.

OCTAVA — OBSERVACIONES
{{observaciones}}

Se firman dos ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha indicados.

Firma VENDEDOR/A: ____________________
Aclaración: {{vendedor}} — DNI {{dni_vendedor}}

Firma COMPRADOR/A: ____________________
Aclaración: {{comprador}} — DNI {{dni_comprador}}`,
  },
  {
    id: 'contrato-locacion',
    titulo: 'Contrato de locación (vivienda)',
    categoria: 'Inmobiliaria',
    descripcion: 'Contrato de alquiler de vivienda: partes, plazo, precio, actualización, depósito, garantía y gastos. Editable y orientativo.',
    industries: ['inmobiliaria'],
    cuerpo: `CONTRATO DE LOCACIÓN

En {{lugar}}, a los {{fecha}}, entre {{locador}}, DNI N° {{dni_locador}}, con domicilio en {{domicilio_locador}} (en adelante, "el/la LOCADOR/A"), y {{locatario}}, DNI N° {{dni_locatario}}, con domicilio en {{domicilio_locatario}} (en adelante, "el/la LOCATARIO/A"), por intermedio de {{inmobiliaria}}, se celebra el presente contrato de locación, sujeto a las siguientes cláusulas:

PRIMERA — INMUEBLE Y DESTINO
El/la LOCADOR/A da en locación al/a la LOCATARIO/A el inmueble sito en {{direccion_inmueble}}, tipo {{tipo_inmueble}}, con destino exclusivo a {{destino}}. El/la LOCATARIO/A declara recibirlo en el estado que consta en el inventario adjunto.

SEGUNDA — PLAZO
La locación se conviene por el plazo de {{plazo_meses}} meses, con inicio el {{fecha_inicio}} y vencimiento el {{fecha_fin}}, fecha en la que el/la LOCATARIO/A deberá restituir el inmueble.

TERCERA — PRECIO Y FORMA DE PAGO
El alquiler se fija en la suma inicial de {{moneda}} {{precio_mensual}} ({{precio_en_letras}}) por mes, pagadera por mes adelantado del 1 al {{dia_pago}} de cada mes, mediante {{forma_pago}}.

CUARTA — ACTUALIZACIÓN
El monto del alquiler se actualizará cada {{periodo_actualizacion}} conforme al siguiente índice o criterio: {{indice_actualizacion}}, según lo acordado libremente por las partes.

QUINTA — DEPÓSITO EN GARANTÍA
El/la LOCATARIO/A entrega en este acto la suma de {{moneda}} {{deposito}} ({{deposito_en_letras}}) en concepto de depósito en garantía, que le será reintegrado al finalizar la locación, previa verificación del estado del inmueble y cancelación de deudas.

SEXTA — GARANTÍAS
En seguridad del cumplimiento de las obligaciones, se ofrece la siguiente garantía: {{garantia}}.

SÉPTIMA — SERVICIOS, EXPENSAS E IMPUESTOS
Estarán a cargo del/de la LOCATARIO/A: {{a_cargo_locatario}}. Estarán a cargo del/de la LOCADOR/A: {{a_cargo_locador}}.

OCTAVA — CONSERVACIÓN Y USO
El/la LOCATARIO/A se obliga a conservar el inmueble en buen estado, a no cambiar su destino, a no subarrendar ni ceder sin autorización escrita del/de la LOCADOR/A, y a permitir las inspecciones que correspondan con aviso previo.

NOVENA — RESCISIÓN ANTICIPADA
El/la LOCATARIO/A podrá rescindir anticipadamente conforme a las siguientes condiciones: {{condiciones_rescision}}, notificando con la antelación pactada.

DÉCIMA — OBSERVACIONES
{{observaciones}}

Se firman dos ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha indicados.

Firma LOCADOR/A: ____________________
Aclaración: {{locador}} — DNI {{dni_locador}}

Firma LOCATARIO/A: ____________________
Aclaración: {{locatario}} — DNI {{dni_locatario}}`,
  },
  {
    id: 'presentacion-generica',
    titulo: 'Escrito de presentación (genérico)',
    categoria: 'Escritos judiciales',
    descripcion: 'Se presenta, acredita personería y constituye domicilios.',
    cuerpo: `Señor Juez:

{{nombre_letrado}}, abogado/a, T° {{tomo}} F° {{folio}}, en mi carácter de letrado/a apoderado/a de {{nombre_parte}}, en los autos caratulados "{{caratula}}" (Expte. N° {{numero_expediente}}), ante V.S. me presento y respetuosamente digo:

I. OBJETO
Que vengo a {{objeto}}.

II. PERSONERÍA
Acredito mi personería con la documentación que acompaño.

III. DOMICILIOS
Constituyo domicilio procesal electrónico en {{domicilio_electronico}} y domicilio físico en {{domicilio_fisico}}.

IV. PETITORIO
Por lo expuesto, a V.S. solicito:
1) Me tenga por presentado/a, por {{parte}} y por constituidos los domicilios.
2) {{peticion}}.

Proveer de conformidad,
SERÁ JUSTICIA.

{{lugar_y_fecha}}
{{nombre_letrado}}`,
  },
  {
    id: 'solicita-tramite',
    titulo: 'Solicita (mero trámite)',
    categoria: 'Escritos judiciales',
    descripcion: 'Escrito breve para pedir una diligencia o providencia.',
    cuerpo: `Señor Juez:

{{nombre_letrado}}, por la parte {{parte}} en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), a V.S. digo:

Que vengo a solicitar {{solicitud}}.

Proveer de conformidad,
SERÁ JUSTICIA.

{{lugar_y_fecha}}`,
  },
  {
    id: 'carta-documento-intimacion',
    titulo: 'Carta documento — intimación de pago',
    categoria: 'Cartas e intimaciones',
    descripcion: 'Intimación fehaciente a pagar una suma bajo apercibimiento legal.',
    cuerpo: `{{lugar_y_fecha}}

Sr./Sra. {{destinatario}}
Domicilio: {{domicilio_destinatario}}

De mi consideración:

En mi carácter de {{caracter_remitente}}, intimo a Ud. a abonar la suma de $ {{monto}} ({{monto_en_letras}}) en concepto de {{concepto}}, dentro del plazo perentorio de {{plazo}} días de recibida la presente.

Vencido dicho plazo sin acreditar el pago, iniciaré las acciones legales que correspondan, con costas a su cargo. Queda Ud. debidamente notificado/a e intimado/a.

{{nombre_remitente}}
{{documento_remitente}}`,
  },
  {
    id: 'autorizacion-compulsar',
    titulo: 'Autorización para compulsar expediente',
    categoria: 'Poderes y autorizaciones',
    descripcion: 'Autoriza a terceros a revisar el expediente y sacar copias.',
    cuerpo: `Señor Juez:

{{nombre_autorizante}}, {{caracter}} en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), a V.S. digo:

Que vengo a autorizar a {{personas_autorizadas}} a compulsar el expediente, extraer fotocopias, retirarlo en préstamo y realizar toda diligencia relacionada, en forma conjunta, alternada o indistinta.

Proveer de conformidad,
SERÁ JUSTICIA.

{{lugar_y_fecha}}
{{nombre_autorizante}}`,
  },
  {
    id: 'contesta-demanda',
    titulo: 'Contesta demanda (genérico)',
    categoria: 'Escritos judiciales',
    descripcion: 'Contesta el traslado, niega hechos y ofrece prueba.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, abogado/a, T° {{tomo}} F° {{folio}}, en representación de la parte demandada {{parte}}, en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), ante V.S. me presento y digo:

I. OBJETO
Que en tiempo y forma vengo a contestar el traslado de la demanda, solicitando su rechazo, con costas.

II. NEGATIVA
Niego todos y cada uno de los hechos que no sean objeto de expreso reconocimiento. En particular, niego: {{hechos_negados}}.

III. REALIDAD DE LOS HECHOS
{{version_hechos}}

IV. PRUEBA
Ofrezco: {{prueba_ofrecida}}.

V. PETITORIO
Solicito se tenga por contestada la demanda y, oportunamente, se la rechace con costas.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'ofrece-prueba',
    titulo: 'Ofrece prueba',
    categoria: 'Escritos judiciales',
    descripcion: 'Ofrecimiento de prueba documental, testimonial, pericial e informativa.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, por la parte {{parte}} en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), a V.S. digo:

Que vengo a ofrecer la siguiente prueba:

I. DOCUMENTAL: {{prueba_documental}}
II. TESTIMONIAL: {{testigos}}
III. PERICIAL: {{pericial}}
IV. INFORMATIVA: {{oficios}}
V. CONFESIONAL: cítese a la contraria a absolver posiciones.

PETITORIO: Solicito se tenga por ofrecida la prueba y se ordene su producción.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'interpone-apelacion',
    titulo: 'Interpone recurso de apelación',
    categoria: 'Escritos judiciales',
    descripcion: 'Apela una resolución dentro del plazo legal.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, por la parte {{parte}} en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), a V.S. digo:

Que vengo a interponer recurso de apelación contra la resolución de fecha {{fecha_resolucion}}, por causar a mi parte un gravamen irreparable.

Solicito se conceda el recurso y se eleven las actuaciones al Superior, expresando agravios en la oportunidad procesal correspondiente.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'beneficio-litigar-sin-gastos',
    titulo: 'Solicita beneficio de litigar sin gastos',
    categoria: 'Escritos judiciales',
    descripcion: 'Promueve el beneficio para litigar sin costo por falta de recursos.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, en representación de {{parte}}, en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), a V.S. digo:

Que vengo a promover beneficio de litigar sin gastos, por carecer mi representado/a de recursos suficientes para afrontar las costas del proceso.

Ofrezco prueba testimonial de {{testigos}} e informativa para acreditar el estado de necesidad.

PETITORIO: Solicito se conceda el beneficio y la exención del pago de tasa de justicia y costas.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'demanda-laboral-despido',
    titulo: 'Demanda laboral por despido (art. 245 LCT - Ley 27.802)',
    categoria: 'Laboral',
    descripcion: 'Reclama indemnización por despido sin justa causa y rubros adeudados conforme régimen de la LCT (Ley 20.744 modif. por Ley 27.802 y Dec. 407/2026).',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, abogado/a, T° {{tomo}} F° {{folio}}, en representación de {{parte}}, con domicilio en {{domicilio_fisico}}, ante V.S. digo:

I. OBJETO
Promuevo demanda laboral contra {{demandado}}, domiciliado/a en {{domicilio_destinatario}}, por la suma de $ {{monto_reclamado}} o lo que en más o menos resulte de la prueba, con intereses y costas.

II. HECHOS
Mi representado/a ingresó el {{fecha_ingreso}}, en la categoría {{categoria_laboral}}, con remuneración de $ {{remuneracion}}. El vínculo se extinguió el {{fecha_egreso}} por despido sin justa causa.

III. RUBROS
Indemnización por antigüedad (art. 245 LCT modif. por Ley 27.802 y Dec. 407/2026, o fondo/régimen de cese laboral aplicable según CCT), preaviso, integración del mes de despido, SAC y vacaciones proporcionales y demás rubros salariales e indemnizatorios que correspondan.

IV. DERECHO
Fundo el reclamo en la Ley de Contrato de Trabajo N° 20.744 y sus modificaciones vigentes (incluyendo Ley 27.802 y Decreto reglamentario 407/2026), normativa convencional aplicable y concordantes.

V. PRUEBA
{{prueba_ofrecida}}

VI. PETITORIO
Solicito se haga lugar a la demanda, con costas.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'intimacion-laboral-registracion',
    titulo: 'Intimación laboral — registración (Ley 24.013)',
    categoria: 'Laboral',
    descripcion: 'Intima al empleador a registrar correctamente la relación laboral. (DESACTUALIZADO: sujeto a Ley 27.742)',
    jurisdiction: 'Nacional',
    practiceArea: 'laboral',
    courtLevel: 'extrajudicial',
    proceduralStage: 'previa',
    purpose: 'Intimación previa de registración laboral',
    legalBasis: 'Ley 20.744 art. 80; Ley 24.013 (Régimen indemnizatorio y multas derogados por Ley 27.742 art. 99 y conc.)',
    version: '1.0',
    reviewStatus: 'outdated',
    lastVerifiedAt: '2026-09-04',
    professionalDisclaimer: 'La Ley 27.742 derogó los arts. 8 a 15 de la Ley 24.013, el art. 45 de la Ley 25.345 (art. 80 LCT) y las multas de la Ley 25.323. Este modelo se conserva exclusivamente como ficha histórica de archivo. Se encuentra bloqueado para uso productivo, redacción asistida y descarga.',
    cuerpo: `{{fecha}}

Sr./Sra. Empleador/a {{destinatario}}
Domicilio: {{domicilio_destinatario}}

Intimo a Ud. en el plazo de 30 días corridos a registrar correctamente mi relación laboral, consignando la real fecha de ingreso {{fecha_ingreso}}, la categoría {{categoria_laboral}} y la remuneración de $ {{remuneracion}}, bajo apercibimiento de las acciones legales que correspondan. Hago reserva de considerarme despedido/a por su exclusiva culpa ante el silencio o la negativa.

{{remitente}}`,
  },
  {
    id: 'demanda-danos-perjuicios',
    titulo: 'Demanda por daños y perjuicios',
    categoria: 'Civil y comercial',
    descripcion: 'Reclama la reparación integral de daños derivados de un hecho.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, en representación de {{parte}}, ante V.S. digo:

I. OBJETO
Promuevo demanda por daños y perjuicios contra {{demandado}}, domiciliado/a en {{domicilio_destinatario}}, por la suma de $ {{monto_reclamado}} o lo que en más o menos resulte de la prueba, con intereses y costas.

II. HECHOS
El día {{fecha_hecho}} ocurrió el siguiente hecho: {{descripcion_hecho}}, que ocasionó a mi mandante los daños que se detallan.

III. RUBROS
Daño emergente, lucro cesante, daño moral y {{otros_rubros}}.

IV. DERECHO
Arts. 1716, 1737, 1740 y concordantes del Código Civil y Comercial.

V. PRUEBA
{{prueba_ofrecida}}

VI. PETITORIO
Solicito se haga lugar a la demanda, con costas.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'demanda-cobro-pesos',
    titulo: 'Demanda por cobro de pesos',
    categoria: 'Civil y comercial',
    descripcion: 'Reclama el pago de una suma adeudada con intereses y costas.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, en representación de {{parte}}, ante V.S. digo:

I. OBJETO
Promuevo demanda por cobro de pesos contra {{demandado}}, domiciliado/a en {{domicilio_destinatario}}, por la suma de $ {{monto_reclamado}}, con intereses y costas.

II. HECHOS
La deuda tiene origen en {{origen_deuda}}, encontrándose vencida e impaga pese a las gestiones realizadas.

III. DERECHO Y PRUEBA
Código Civil y Comercial. Ofrezco: {{prueba_ofrecida}}.

IV. PETITORIO
Solicito se condene al pago del capital, intereses y costas.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'demanda-alimentos',
    titulo: 'Demanda de alimentos',
    categoria: 'Familia',
    descripcion: 'Solicita cuota alimentaria a favor de hijos/as u otros legitimados.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, en representación de {{parte}}, ante V.S. digo:

I. OBJETO
Promuevo demanda de alimentos contra {{demandado}}, domiciliado/a en {{domicilio_destinatario}}, a favor de {{beneficiario}}, solicitando una cuota mensual equivalente a {{cuota_solicitada}}.

II. HECHOS
{{descripcion_hechos}}. Se detallan las necesidades del/de la beneficiario/a y la capacidad económica del/de la demandado/a.

III. DERECHO
Arts. 658 y siguientes del Código Civil y Comercial.

IV. PRUEBA
{{prueba_ofrecida}}

V. PETITORIO
Solicito se fije cuota alimentaria provisoria y, oportunamente, definitiva, con costas.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'inicia-sucesion',
    titulo: 'Inicia juicio sucesorio (ab intestato)',
    categoria: 'Sucesiones',
    descripcion: 'Promueve la sucesión y denuncia herederos y bienes.',
    cuerpo: `Señor Juez:

{{letrado_nombre}}, en representación de {{parte}}, en su carácter de heredero/a de {{causante}}, ante V.S. digo:

I. OBJETO
Vengo a promover el juicio sucesorio ab intestato de {{causante}}, fallecido/a el {{fecha_fallecimiento}}, con último domicilio en {{ultimo_domicilio}}.

II. HEREDEROS
Se denuncian como herederos: {{herederos}}.

III. BIENES
Integran el acervo: {{bienes}}.

IV. PETITORIO
Solicito: 1) Se tenga por iniciada la sucesión; 2) Se ordene la publicación de edictos; 3) Oportunamente, se dicte declaratoria de herederos.

SERÁ JUSTICIA.

{{letrado_nombre}}`,
  },
  {
    id: 'denuncia-venta-automotor',
    titulo: 'Denuncia de venta de automotor',
    categoria: 'Automotor',
    descripcion: 'Nota para denunciar la venta de un vehículo ante el Registro (DNRPA).',
    cuerpo: `Registro Seccional de la Propiedad del Automotor N° {{registro_seccional}}

{{vendedor}}, DNI {{dni_vendedor}}, con domicilio en {{domicilio_fisico}}, en carácter de titular registral del automotor dominio {{dominio}}, marca {{marca}}, modelo {{modelo}}, vengo a DENUNCIAR LA VENTA del vehículo, efectuada el {{fecha_venta}} a favor de {{comprador}}, DNI {{dni_comprador}}.

Solicito se tome razón de la presente a los efectos del art. 27 del Régimen Jurídico del Automotor, cesando mi responsabilidad como titular a partir de la fecha de la venta.

{{vendedor}}`,
  },
  {
    id: 'autoriza-transferencia-automotor',
    titulo: 'Autorización para tramitar transferencia de automotor',
    categoria: 'Automotor',
    descripcion: 'Autoriza a un gestor a realizar el trámite ante el Registro.',
    cuerpo: `AUTORIZACIÓN

{{otorgante}}, DNI {{dni_otorgante}}, con domicilio en {{domicilio_fisico}}, AUTORIZO a {{autorizado}}, DNI {{dni_autorizado}}, a realizar ante el Registro Seccional de la Propiedad del Automotor todos los trámites relacionados con la transferencia del vehículo dominio {{dominio}}, marca {{marca}}, modelo {{modelo}}, incluyendo la presentación y firma de formularios, pago de aranceles y retiro de documentación.

Lugar y fecha: {{lugar_fecha}}

Firma: ____________________
{{otorgante}}`,
  },
  {
    id: 'cd-intimacion-locacion',
    titulo: 'Carta documento — intimación por alquileres',
    categoria: 'Cartas e intimaciones',
    descripcion: 'Intima al inquilino a pagar alquileres bajo apercibimiento de desalojo.',
    cuerpo: `{{fecha}}

Sr./Sra. {{destinatario}}
Domicilio: {{domicilio_destinatario}}

En mi carácter de locador/a del inmueble sito en {{inmueble}}, intimo a Ud. a abonar la suma de $ {{monto_adeudado}} en concepto de alquileres adeudados correspondientes a {{periodos}}, dentro del plazo de {{plazo}} días.

Bajo apercibimiento, en caso de incumplimiento, de iniciar las acciones judiciales de cobro y desalojo por falta de pago, con costas a su cargo. Queda Ud. debidamente intimado/a y notificado/a.

{{remitente}}`,
  },
  // ⚖️ EJECUCIONES
  {
    id: 'demanda-ejecutiva-pagare',
    titulo: 'Demanda ejecutiva (pagaré / cheque)',
    categoria: 'Ejecuciones',
    descripcion: 'Inicia juicio ejecutivo por un título de crédito vencido.',
    cuerpo: `Señor Juez:

{{abogado}}, abogado/a, T° {{tomo}} F° {{folio}}, en representación de {{parte}}, con domicilio en {{domicilio_fisico}}, ante V.S. digo:

I. OBJETO
Promuevo juicio ejecutivo contra {{destinatario}}, domiciliado/a en {{domicilio_destinatario}}, por el cobro de la suma de $ {{monto_reclamado}}, con más intereses y costas, con fundamento en el título ejecutivo que acompaño ({{titulo}}).

II. HECHOS
El/la demandado/a suscribió el título de fecha {{fecha_titulo}}, con vencimiento el {{fecha_vencimiento}}, que se encuentra vencido, líquido y exigible, sin que se haya obtenido el pago.

III. DERECHO
Arts. 520 y siguientes del Código Procesal Civil y Comercial de la Nación.

IV. PETITORIO
Solicito: 1) Se libre mandamiento de intimación de pago y embargo por la suma reclamada con más lo presupuestado para intereses y costas; 2) Se cite de remate al/a la demandado/a para oponer excepciones; 3) Oportunamente, se dicte sentencia de trance y remate, con costas.

SERÁ JUSTICIA.

{{abogado}}`,
  },
  {
    id: 'prepara-via-ejecutiva',
    titulo: 'Prepara la vía ejecutiva',
    categoria: 'Ejecuciones',
    descripcion: 'Cita a reconocer firma para dejar expedita la ejecución.',
    cuerpo: `Señor Juez:

{{abogado}}, en representación de {{parte}}, ante V.S. digo:

I. OBJETO
Vengo a preparar la vía ejecutiva contra {{destinatario}}, domiciliado/a en {{domicilio_destinatario}}, a fin de que reconozca la firma y la deuda instrumentada en {{documento}}, por la suma de $ {{monto_reclamado}}.

II. DILIGENCIA
Solicito se cite al/a la requerido/a a reconocer firma bajo apercibimiento de tenerla por reconocida (art. 526 CPCCN) en caso de incomparecencia injustificada.

III. PETITORIO
Solicito se ordene la citación y, reconocida o tenida por reconocida la firma, quede expedita la vía ejecutiva.

SERÁ JUSTICIA.

{{abogado}}`,
  },
  // 📮 OFICIOS Y CÉDULAS
  {
    id: 'oficio-ley-22172',
    titulo: 'Oficio Ley 22.172',
    categoria: 'Oficios y cédulas',
    descripcion: 'Oficio a un organismo público con datos del expediente.',
    cuerpo: `OFICIO LEY 22.172

{{lugar_fecha}}

A: {{organismo_destinatario}}
Domicilio: {{domicilio_organismo}}

En los autos caratulados "{{caratula}}" (Expte. N° {{numero_expediente}}), en trámite ante {{juzgado}}, y conforme lo dispuesto por V.S., me dirijo a Ud. a fin de solicitar {{objeto_oficio}}.

Se encuentra autorizado/a para el diligenciamiento del presente {{persona_autorizada}}.

Sirva el presente de atenta nota de estilo.

{{abogado}}`,
  },
  {
    id: 'cedula-notificacion',
    titulo: 'Cédula de notificación',
    categoria: 'Oficios y cédulas',
    descripcion: 'Notifica una resolución al domicilio de la contraparte.',
    cuerpo: `CÉDULA DE NOTIFICACIÓN

Señor/a: {{destinatario}}
Domicilio: {{domicilio_destinatario}}
Carácter del domicilio: {{caracter_domicilio}}

Se hace saber a Ud. que en los autos "{{caratula}}" (Expte. N° {{numero_expediente}}), en trámite ante {{juzgado}}, se ha dictado la siguiente resolución que se transcribe: "{{resolucion}}".

Queda Ud. debidamente notificado/a.

{{lugar_fecha}}
{{abogado}}`,
  },
  // 🏥 AMPARO
  {
    id: 'accion-amparo-salud',
    titulo: 'Acción de amparo (salud)',
    categoria: 'Amparo',
    descripcion: 'Reclama cobertura de salud a una obra social o prepaga.',
    cuerpo: `Señor Juez:

{{abogado}}, en representación de {{parte}}, con domicilio en {{domicilio_fisico}}, ante V.S. digo:

I. OBJETO
Promuevo acción de amparo (art. 43 CN y Ley 16.986) contra {{obra_social_empresa}}, domiciliado/a en {{domicilio_destinatario}}, a fin de que se ordene la cobertura integral e inmediata de {{prestacion_solicitada}}.

II. HECHOS
Mi representado/a padece {{patologia}}, conforme prescripción médica que se acompaña. La demandada ha {{conducta_lesiva}}, lo que pone en riesgo la salud y afecta derechos de raigambre constitucional.

III. DERECHO
Art. 43 de la Constitución Nacional, Ley 16.986, Ley 24.240 y normativa de cobertura obligatoria (PMO).

IV. MEDIDA CAUTELAR
Solicito se ordene cautelarmente la cobertura mientras dure el proceso, dada la urgencia y el peligro en la demora.

V. PETITORIO
Solicito se haga lugar al amparo y se condene a la demandada a otorgar la cobertura, con costas.

SERÁ JUSTICIA.

{{abogado}}`,
  },
  // 👴 PREVISIONAL
  {
    id: 'demanda-reajuste-jubilatorio',
    titulo: 'Demanda de reajuste jubilatorio (ANSES)',
    categoria: 'Previsional',
    descripcion: 'Reclama el reajuste del haber previsional y retroactivos.',
    cuerpo: `Señor Juez:

{{abogado}}, en representación de {{parte}}, con domicilio en {{domicilio_fisico}}, ante V.S. digo:

I. OBJETO
Promuevo demanda contra la ANSES (Administración Nacional de la Seguridad Social) a fin de obtener el reajuste del haber jubilatorio de mi representado/a, beneficio N° {{numero_beneficio}}, con más las diferencias retroactivas e intereses.

II. HECHOS
El haber se encuentra mal liquidado / desactualizado por {{motivo_reajuste}}. Se agotó la vía administrativa mediante {{reclamo_administrativo}}.

III. DERECHO
Ley 24.241, Ley 26.417 (movilidad) y doctrina de la CSJN ("Badaro", "Elliff" y concordantes).

IV. PRUEBA
{{prueba}}

V. PETITORIO
Solicito se ordene el reajuste del haber, el pago de las diferencias retroactivas con intereses y las costas.

SERÁ JUSTICIA.

{{abogado}}`,
  },
  // 🔒 PENAL
  {
    id: 'denuncia-penal',
    titulo: 'Denuncia penal',
    categoria: 'Penal',
    descripcion: 'Pone en conocimiento de la justicia un hecho delictivo.',
    cuerpo: `Señor/a Fiscal / Señor Juez:

{{denunciante}}, DNI {{dni_denunciante}}, con domicilio en {{domicilio_fisico}}, ante Ud. me presento y formulo DENUNCIA PENAL contra {{denunciado}} (o N.N.), por los siguientes hechos:

I. HECHOS
El día {{fecha_hecho}}, en {{lugar_hecho}}, ocurrió lo siguiente: {{relato_hecho}}.

II. CALIFICACIÓN PROVISORIA
Los hechos podrían encuadrar en el delito de {{delito}}, sin perjuicio de la calificación que corresponda.

III. PRUEBA
Ofrezco: {{prueba}}. Testigos: {{testigos}}.

IV. PETITORIO
Solicito se reciba la presente denuncia, se investiguen los hechos y se adopten las medidas que correspondan. Constituyo domicilio en el indicado.

{{denunciante}}`,
  },
  {
    id: 'querella',
    titulo: 'Se constituye en parte querellante',
    categoria: 'Penal',
    descripcion: 'Solicita ser tenido por querellante en una causa penal.',
    cuerpo: `Señor Juez:

{{abogado}}, en representación de {{parte}}, con domicilio en {{domicilio_fisico}}, ante V.S. me presento y digo:

I. OBJETO
Vengo a constituir a mi representado/a en parte QUERELLANTE en la causa "{{caratula}}" (Expte. N° {{numero_expediente}}), contra {{denunciado}}, por el delito de {{delito}}.

II. LEGITIMACIÓN
Mi representado/a resulta damnificado/a directo/a por el hecho, conforme los arts. 82 y siguientes del Código Procesal Penal.

III. HECHOS
{{relato_hecho}}

IV. PRUEBA
{{prueba}}

V. PETITORIO
Solicito: 1) Se lo/la tenga por parte querellante; 2) Se disponga la producción de la prueba ofrecida; 3) Oportunamente, se eleve la causa a juicio.

SERÁ JUSTICIA.

{{abogado}}`,
  },
	// ───────────── CORRIENTES (CPCC Ley 6.556 · plataforma FORUM) ─────────────
	{
		id: 'demanda-danos-corrientes',
		titulo: 'Demanda de daños y perjuicios (Corrientes)',
		categoria: 'Civil y comercial',
		descripcion: 'Demanda por daños y perjuicios ante la Justicia Civil y Comercial de Corrientes (CPCC Ley 6.556, gestión electrónica FORUM).',
		cuerpo: `PROMUEVE DEMANDA POR DAÑOS Y PERJUICIOS

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, Tomo {{tomo}} Folio {{folio}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. respetuosamente digo:

I. OBJETO
Vengo a promover formal demanda por daños y perjuicios contra {{demandado}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, o lo que en más o en menos resulte de la prueba a producirse, con más sus intereses y costas.

II. COMPETENCIA
V.S. resulta competente en razón del territorio y la materia, conforme el Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556) y en atención al domicilio del demandado.

III. HECHOS
{{hechos}}

IV. DERECHO
Fundo el derecho en los arts. 1708, 1716, 1717, 1737, 1740 y concordantes del Código Civil y Comercial de la Nación (reparación plena) y en el Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

V. RUBROS RECLAMADOS
Daño emergente, lucro cesante, daño moral y demás perjuicios que se acrediten, conforme se liquidará.

VI. PRUEBA
DOCUMENTAL: {{prueba_documental}}. Asimismo se ofrece prueba INFORMATIVA, PERICIAL y TESTIMONIAL conforme se detalla.

VII. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Se corra traslado de la demanda por el plazo de ley; c) Oportunamente se haga lugar a la demanda, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'demanda-alimentos-corrientes',
		titulo: 'Demanda de alimentos (Corrientes)',
		categoria: 'Familia',
		descripcion: 'Demanda de alimentos ante la Justicia de Familia de Corrientes (CPCC Ley 6.556, plataforma FORUM).',
		cuerpo: `PROMUEVE DEMANDA DE ALIMENTOS

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, por derecho propio y/o en representación de {{beneficiario}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Vengo a promover demanda de alimentos contra {{alimentante}}, con domicilio en {{domicilio_demandado}}, a fin de que se fije una cuota alimentaria mensual a favor de {{beneficiario}}, en razón del vínculo de {{vinculo}}.

II. LEGITIMACIÓN Y VÍNCULO
Acredito el título en cuya virtud reclamo con la documentación acompañada: {{documentacion_vinculo}}.

III. HECHOS Y NECESIDADES
{{hechos}}

IV. CAUDAL DEL ALIMENTANTE
Denuncio, siquiera aproximadamente, el caudal económico del alimentante: {{caudal_alimentante}}.

V. CUOTA SOLICITADA Y ALIMENTOS PROVISORIOS
Solicito se fije una cuota alimentaria de $ {{monto_cuota}} mensuales y se establezcan alimentos provisorios, conforme los arts. 541, 542, 544, 548 y concordantes del Código Civil y Comercial de la Nación y el Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

VI. PRUEBA
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA y TESTIMONIAL conforme se detalla.

VII. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Se fijen alimentos provisorios; c) Se corra traslado y oportunamente se haga lugar a la demanda, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'demanda-laboral-corrientes',
		titulo: 'Demanda laboral por despido (Corrientes)',
		categoria: 'Laboral',
		descripcion: 'Demanda laboral por despido ante el fuero Laboral de Corrientes (fondo LCT 20.744; procedimiento laboral provincial, gestión FORUM).',
		cuerpo: `PROMUEVE DEMANDA LABORAL

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Vengo a promover demanda laboral contra {{empleador}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, o lo que en más o en menos resulte de la prueba, con más intereses y costas, en concepto de los rubros que se detallan.

II. RELACIÓN LABORAL
Fecha de ingreso: {{fecha_ingreso}}. Fecha de egreso: {{fecha_egreso}}. Categoría: {{categoria_laboral}}. Remuneración: $ {{remuneracion}}. Jornada y modalidad: {{modalidad}}.

III. HECHOS
{{hechos}}

IV. RUBROS RECLAMADOS
{{rubros}} (indemnización por antigüedad, preaviso, integración del mes de despido, SAC y vacaciones proporcionales y demás rubros de ley).

V. DERECHO
Fundo el reclamo en la Ley de Contrato de Trabajo N° 20.744 y normas complementarias, y en las normas del procedimiento laboral vigente en la Provincia de Corrientes.

VI. PRUEBA
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA, PERICIAL CONTABLE y TESTIMONIAL conforme se detalla.

VII. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Se corra traslado de la demanda; c) Oportunamente se haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	// ───────────── BUENOS AIRES (CPCC Dec-Ley 7425/68 · MEV/SCBA) ─────────────
	{
		id: 'demanda-danos-baires',
		titulo: 'Demanda de daños y perjuicios (Prov. Buenos Aires)',
		categoria: 'Civil y comercial',
		descripcion: 'Demanda por daños y perjuicios ante la Justicia Civil y Comercial de la Provincia de Buenos Aires (CPCC Dec-Ley 7425/68, notificación electrónica MEV).',
		cuerpo: `PROMUEVE DEMANDA POR DAÑOS Y PERJUICIOS

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, Tomo {{tomo}} Folio {{folio}} C.A.{{colegio}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado en el sistema de notificaciones (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. respetuosamente digo:

I. OBJETO
Vengo a promover demanda por daños y perjuicios contra {{demandado}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, o lo que en más o en menos resulte de la prueba, con más intereses y costas.

II. COMPETENCIA
V.S. resulta competente conforme el Código Procesal Civil y Comercial de la Provincia de Buenos Aires (Decreto-Ley 7425/68) y en atención al domicilio del demandado y/o lugar del hecho.

III. HECHOS
{{hechos}}

IV. DERECHO
Fundo el derecho en los arts. 1708, 1716, 1717, 1737, 1740 y concordantes del Código Civil y Comercial de la Nación, y en el Código Procesal Civil y Comercial de la Provincia de Buenos Aires (Decreto-Ley 7425/68).

V. RUBROS RECLAMADOS
Daño emergente, lucro cesante, daño moral y demás perjuicios que se acrediten.

VI. PRUEBA
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA, PERICIAL y TESTIMONIAL conforme se detalla.

VII. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Se corra traslado de la demanda por el plazo de ley; c) Oportunamente se haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'demanda-alimentos-baires',
		titulo: 'Demanda de alimentos (Prov. Buenos Aires)',
		categoria: 'Familia',
		descripcion: 'Demanda de alimentos ante el Juzgado de Familia de la Provincia de Buenos Aires (art. 635 CPCC t.o. Ley 15.513, con alimentos provisorios y vista al Ministerio Público).',
		cuerpo: `PROMUEVE DEMANDA DE ALIMENTOS

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, por derecho propio y/o en representación de {{beneficiario}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Vengo a promover demanda de alimentos contra {{alimentante}}, con domicilio en {{domicilio_demandado}}, a favor de {{beneficiario}}, en razón del vínculo de {{vinculo}}, cumpliendo los recaudos del art. 635 del CPCC (t.o. Ley 15.513).

II. TÍTULO / VÍNCULO (art. 635 inc. 1)
Acredito el título con la documentación acompañada: {{documentacion_vinculo}}.

III. CAUDAL DEL ALIMENTANTE (art. 635 inc. 2)
Denuncio, siquiera aproximadamente y por prueba indiciaria, el caudal del alimentante: {{caudal_alimentante}}.

IV. HECHOS Y NECESIDADES
{{hechos}}

V. ALIMENTOS PROVISORIOS Y CUOTA SOLICITADA
Solicito la fijación de alimentos provisorios (art. 636 bis CPCC) y, oportunamente, una cuota alimentaria de $ {{monto_cuota}} mensuales, conforme los arts. 541, 542, 544, 548 y concordantes del Código Civil y Comercial de la Nación.

VI. PRUEBA (art. 635 inc. 4)
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA y TESTIMONIAL (los testigos declararán en la primera audiencia).

VII. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Se fijen alimentos provisorios; c) Se dé la intervención que corresponda al Ministerio Público; d) Oportunamente se haga lugar a la demanda, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'demanda-laboral-baires',
		titulo: 'Demanda laboral por despido (Prov. Buenos Aires)',
		categoria: 'Laboral',
		descripcion: 'Demanda laboral por despido ante los Tribunales del Trabajo de la Provincia de Buenos Aires (Ley 15.057 texto actualizado; fondo LCT 20.744 modif. Ley 27.802).',
		cuerpo: `PROMUEVE DEMANDA LABORAL

Señor Presidente del Tribunal del Trabajo:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.E. digo:

I. OBJETO
Vengo a promover demanda laboral contra {{empleador}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, o lo que en más o en menos resulte de la prueba, con más intereses y costas.

II. COMPETENCIA
El Tribunal resulta competente conforme la Ley 15.057 de procedimiento laboral de la Provincia de Buenos Aires (domicilio del demandado, lugar de prestación del trabajo o de celebración del contrato).

III. RELACIÓN LABORAL
Fecha de ingreso: {{fecha_ingreso}}. Fecha de egreso: {{fecha_egreso}}. Categoría: {{categoria_laboral}}. Remuneración: $ {{remuneracion}}. Modalidad: {{modalidad}}.

IV. HECHOS
{{hechos}}

V. RUBROS RECLAMADOS
{{rubros}} (indemnización por antigüedad, preaviso, integración del mes de despido, SAC y vacaciones proporcionales y demás rubros de ley).

VI. DERECHO
Fundo el reclamo en la Ley de Contrato de Trabajo N° 20.744 y complementarias (incluyendo Ley 27.802 y Dec. 407/2026), y en la ley de procedimiento laboral de la Provincia de Buenos Aires (Ley 15.057 texto actualizado).

VII. PRUEBA
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA, PERICIAL CONTABLE y TESTIMONIAL conforme se detalla.

VIII. PETITORIO
Solicito al Tribunal: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Se corra traslado de la demanda; c) Oportunamente se haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	// ═══════════ AMPARO DE SALUD ═══════════
	{
		id: 'accion-amparo-salud-corrientes',
		titulo: 'Acción de amparo de salud (Corrientes)',
		categoria: 'Amparo',
		descripcion: 'Amparo de salud ante la Justicia de Corrientes (art. 43 CN y Constitución provincial; sin agotar vía administrativa, doctrina STJ).',
		cuerpo: `INTERPONE ACCIÓN DE AMPARO (SALUD)

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Vengo a interponer acción de amparo contra {{entidad_demandada}}, con domicilio en {{domicilio_demandado}}, a fin de que se ordene el otorgamiento inmediato de {{prestacion}}, prescripta en razón de la patología {{patologia}}, cuya cobertura fue negada o demorada con fecha {{fecha_negativa}}.

II. ADMISIBILIDAD
La acción de amparo es la vía idónea (art. 43 de la Constitución Nacional y normas de amparo de la Constitución de la Provincia de Corrientes), no resultando exigible el previo agotamiento de la vía administrativa conforme la doctrina del Superior Tribunal de Justicia de Corrientes.

III. HECHOS
{{hechos}}

IV. DERECHO
Arts. 42 y 43 CN; derecho a la salud (arts. 14 bis y 75 inc. 22 CN y tratados internacionales); Ley 26.682 de Medicina Prepaga y PMO (Ley 24.754); normas de amparo de la Provincia de Corrientes.

V. MEDIDA CAUTELAR
Solicito medida cautelar innovativa que ordene otorgar la prestación durante el proceso, atento la verosimilitud del derecho y el peligro en la demora.

VI. PRUEBA
DOCUMENTAL: {{prueba_documental}} (historia clínica, prescripción médica, negativa de cobertura). INFORMATIVA y PERICIAL MÉDICA.

VII. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Despache la medida cautelar; c) Corra traslado del amparo; d) Oportunamente haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'accion-amparo-salud-baires',
		titulo: 'Acción de amparo de salud (Prov. Buenos Aires)',
		categoria: 'Amparo',
		descripcion: 'Amparo de salud ante la Justicia de la Provincia de Buenos Aires (Ley 13.928, art. 20 inc. 2 Const. prov.; plazo 30 días).',
		cuerpo: `INTERPONE ACCIÓN DE AMPARO (SALUD)

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}} (C.A. {{colegio_abogados}}), constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Vengo a interponer acción de amparo contra {{entidad_demandada}}, con domicilio en {{domicilio_demandado}}, a fin de que se ordene el otorgamiento inmediato de {{prestacion}}, prescripta en razón de la patología {{patologia}}, cuya cobertura fue negada o demorada con fecha {{fecha_negativa}}.

II. ADMISIBILIDAD Y PLAZO
La acción se interpone conforme la Ley 13.928 (reglamentaria del art. 20 inc. 2 de la Constitución de la Provincia de Buenos Aires), dentro del plazo de treinta (30) días desde la toma de conocimiento del acto lesivo (art. 5 Ley 13.928, texto Ley 14.192).

III. HECHOS
{{hechos}}

IV. DERECHO
Arts. 42 y 43 CN; art. 20 inc. 2 Const. Prov. Bs As; Ley 13.928; derecho a la salud (arts. 14 bis y 75 inc. 22 CN); Ley 26.682 y PMO (Ley 24.754).

V. MEDIDA CAUTELAR
Solicito medida cautelar innovativa que ordene otorgar la prestación durante el proceso, atento la verosimilitud del derecho y el peligro en la demora.

VI. PRUEBA
DOCUMENTAL: {{prueba_documental}} (historia clínica, prescripción médica, negativa de cobertura). INFORMATIVA y PERICIAL MÉDICA.

VII. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Despache la medida cautelar; c) Corra traslado del amparo; d) Oportunamente haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	// ═══════════ EJECUCIONES ═══════════
	{
		id: 'demanda-ejecutiva-corrientes',
		titulo: 'Demanda ejecutiva / juicio ejecutivo (Corrientes)',
		categoria: 'Ejecuciones',
		descripcion: 'Juicio ejecutivo por pagaré u otro título ante la Justicia de Corrientes (Dec-Ley 5965/63; CPCC Ley 6.556).',
		cuerpo: `PROMUEVE JUICIO EJECUTIVO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Promuevo juicio ejecutivo contra {{demandado}}, con domicilio en {{domicilio_demandado}}, por el cobro de la suma de $ {{monto}}, con más intereses y costas.

II. TÍTULO EJECUTIVO
El crédito consta en {{titulo}}, con vencimiento el {{fecha_vencimiento}}, que reúne los recaudos del Decreto-Ley 5965/63 y constituye título ejecutivo hábil que se acompaña en original.

III. DERECHO
Decreto-Ley 5965/63 y normas del juicio ejecutivo del Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}} (título original).

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Libre mandamiento de intimación de pago y embargo por capital, intereses y costas; c) Cite de remate al ejecutado; d) Oportunamente dicte sentencia de trance y remate, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'demanda-ejecutiva-baires',
		titulo: 'Demanda ejecutiva / juicio ejecutivo (Prov. Buenos Aires)',
		categoria: 'Ejecuciones',
		descripcion: 'Juicio ejecutivo por pagaré u otro título ante la Justicia de la Provincia de Buenos Aires (Dec-Ley 5965/63; CPCC 7425/68).',
		cuerpo: `PROMUEVE JUICIO EJECUTIVO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}} (C.A. {{colegio_abogados}}), constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Promuevo juicio ejecutivo contra {{demandado}}, con domicilio en {{domicilio_demandado}}, por el cobro de la suma de $ {{monto}}, con más intereses y costas.

II. TÍTULO EJECUTIVO
El crédito consta en {{titulo}}, con vencimiento el {{fecha_vencimiento}}, que reúne los recaudos del Decreto-Ley 5965/63 y constituye título ejecutivo hábil que se acompaña en original.

III. DERECHO
Decreto-Ley 5965/63 y normas del juicio ejecutivo del Código Procesal Civil y Comercial de la Provincia de Buenos Aires (Decreto-Ley 7425/68).

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}} (título original).

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Libre mandamiento de intimación de pago y embargo por capital, intereses y costas; c) Cite de remate al ejecutado; d) Oportunamente dicte sentencia de trance y remate, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	// ═══════════ DESALOJO POR FALTA DE PAGO ═══════════
	{
		id: 'desalojo-falta-pago-corrientes',
		titulo: 'Demanda de desalojo por falta de pago (Corrientes)',
		categoria: 'Civil y comercial',
		descripcion: 'Desalojo por falta de pago ante la Justicia de Corrientes (art. 1219 CCyCN; CPCC Ley 6.556).',
		cuerpo: `PROMUEVE DEMANDA DE DESALOJO POR FALTA DE PAGO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Promuevo demanda de desalojo por falta de pago contra {{demandado}}, con domicilio en {{domicilio_demandado}}, respecto del inmueble sito en {{inmueble}}, a fin de que se lo condene a desocuparlo y restituirlo.

II. HECHOS
Las partes celebraron contrato de locación por un canon mensual de $ {{canon}}. El locatario adeuda los períodos {{periodos_adeudados}}, configurándose la causal de falta de pago. {{hechos}}

III. DERECHO
Art. 1219 y concordantes del Código Civil y Comercial de la Nación y normas del proceso de desalojo del Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}} (contrato de locación, recibos, intimación de pago). INFORMATIVA y TESTIMONIAL.

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Corra traslado de la demanda; c) Oportunamente haga lugar, condenando a la desocupación y restitución del inmueble bajo apercibimiento de lanzamiento, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'desalojo-falta-pago-baires',
		titulo: 'Demanda de desalojo por falta de pago (Prov. Buenos Aires)',
		categoria: 'Civil y comercial',
		descripcion: 'Desalojo por falta de pago ante la Justicia de la Provincia de Buenos Aires, con desocupación inmediata (arts. 676 bis/ter CPCC, Ley 14.220).',
		cuerpo: `PROMUEVE DEMANDA DE DESALOJO POR FALTA DE PAGO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}} (C.A. {{colegio_abogados}}), constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Promuevo demanda de desalojo por falta de pago contra {{demandado}}, con domicilio en {{domicilio_demandado}}, respecto del inmueble sito en {{inmueble}}, a fin de que se lo condene a desocuparlo y restituirlo.

II. HECHOS
Las partes celebraron contrato de locación por un canon mensual de $ {{canon}}. El locatario adeuda los períodos {{periodos_adeudados}}, configurándose la causal de falta de pago. {{hechos}}

III. DESOCUPACIÓN INMEDIATA
Atento la causal de falta de pago, solicito la desocupación inmediata del inmueble bajo caución real, conforme los arts. 676 bis y 676 ter del CPCC de la Provincia de Buenos Aires (texto Ley 14.220).

IV. DERECHO
Art. 1219 y concordantes del Código Civil y Comercial de la Nación y arts. 676 y ss. del Código Procesal Civil y Comercial de la Provincia de Buenos Aires (Decreto-Ley 7425/68).

V. PRUEBA
DOCUMENTAL: {{prueba_documental}} (contrato de locación, recibos, intimación de pago). INFORMATIVA y TESTIMONIAL.

VI. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Despache la desocupación inmediata bajo caución; c) Corra traslado de la demanda; d) Oportunamente haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	// ═══════════ SUCESIONES ═══════════
	{
		id: 'sucesion-corrientes',
		titulo: 'Inicia juicio sucesorio (Corrientes)',
		categoria: 'Sucesiones',
		descripcion: 'Apertura de sucesión ante la Justicia de Corrientes (último domicilio del causante, art. 2336 CCyCN; CPCC Ley 6.556).',
		cuerpo: `PROMUEVE JUICIO SUCESORIO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Promuevo el juicio sucesorio de {{causante}}, fallecido/a el {{fecha_fallecimiento}}, cuyo último domicilio se encontraba en {{ultimo_domicilio_causante}}, en mi carácter de {{vinculo_heredero}}.

II. COMPETENCIA
V.S. resulta competente por corresponder al último domicilio del causante (art. 2336 del Código Civil y Comercial de la Nación) y conforme el Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

III. BIENES
Se denuncian los siguientes bienes: {{bienes}}.

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}} (partida de defunción, partidas que acreditan el vínculo, títulos de los bienes).

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Tenga por iniciado el sucesorio; c) Ordene la publicación de edictos citando a herederos y acreedores; d) Oportunamente dicte declaratoria de herederos.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'sucesion-baires',
		titulo: 'Inicia juicio sucesorio (Prov. Buenos Aires)',
		categoria: 'Sucesiones',
		descripcion: 'Apertura de sucesión ante la Justicia de la Provincia de Buenos Aires (último domicilio del causante, art. 2336 CCyCN; CPCC 7425/68).',
		cuerpo: `PROMUEVE JUICIO SUCESORIO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}} (C.A. {{colegio_abogados}}), constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Promuevo el juicio sucesorio de {{causante}}, fallecido/a el {{fecha_fallecimiento}}, cuyo último domicilio se encontraba en {{ultimo_domicilio_causante}}, en mi carácter de {{vinculo_heredero}}.

II. COMPETENCIA
V.S. resulta competente por corresponder al último domicilio del causante (art. 2336 del Código Civil y Comercial de la Nación) y conforme el Código Procesal Civil y Comercial de la Provincia de Buenos Aires (Decreto-Ley 7425/68).

III. BIENES
Se denuncian los siguientes bienes: {{bienes}}.

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}} (partida de defunción, partidas que acreditan el vínculo, títulos de los bienes).

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Tenga por iniciado el sucesorio; c) Ordene la publicación de edictos citando a herederos y acreedores; d) Oportunamente dicte declaratoria de herederos.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	// ═══════════ COBRO ORDINARIO DE PESOS ═══════════
	{
		id: 'cobro-pesos-ordinario-corrientes',
		titulo: 'Demanda ordinaria por cobro de pesos (Corrientes)',
		categoria: 'Civil y comercial',
		descripcion: 'Cobro de pesos por proceso de conocimiento ante la Justicia de Corrientes (CCyCN; CPCC Ley 6.556).',
		cuerpo: `PROMUEVE DEMANDA POR COBRO DE PESOS

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Promuevo demanda por cobro de pesos contra {{demandado}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, con más intereses y costas.

II. HECHOS Y ORIGEN DE LA DEUDA
La deuda reclamada tiene origen en {{origen_deuda}}. {{hechos}}

III. DERECHO
Arts. 724, 725, 726, 730, 765 y concordantes del Código Civil y Comercial de la Nación y normas del proceso de conocimiento del Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA, PERICIAL y TESTIMONIAL.

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Corra traslado de la demanda; c) Oportunamente haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
	{
		id: 'cobro-pesos-ordinario-baires',
		titulo: 'Demanda ordinaria por cobro de pesos (Prov. Buenos Aires)',
		categoria: 'Civil y comercial',
		descripcion: 'Cobro de pesos por proceso de conocimiento ante la Justicia de la Provincia de Buenos Aires (CCyCN; CPCC 7425/68).',
		cuerpo: `PROMUEVE DEMANDA POR COBRO DE PESOS

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con patrocinio letrado del/de la Dr./Dra. {{abogado}} (C.A. {{colegio_abogados}}), constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Promuevo demanda por cobro de pesos contra {{demandado}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, con más intereses y costas.

II. HECHOS Y ORIGEN DE LA DEUDA
La deuda reclamada tiene origen en {{origen_deuda}}. {{hechos}}

III. DERECHO
Arts. 724, 725, 726, 730, 765 y concordantes del Código Civil y Comercial de la Nación y normas del proceso de conocimiento del Código Procesal Civil y Comercial de la Provincia de Buenos Aires (Decreto-Ley 7425/68).

IV. PRUEBA
DOCUMENTAL: {{prueba_documental}}. INFORMATIVA, PERICIAL y TESTIMONIAL.

V. PETITORIO
a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Corra traslado de la demanda; c) Oportunamente haga lugar, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
	},
  // ─────────────────────────────────────────────
  // 🗂️ MERO TRÁMITE (alta frecuencia)
  // ─────────────────────────────────────────────
  {
    id: 'acompana-documentacion',
    titulo: 'Acompaña documentación',
    categoria: 'Escritos judiciales',
    descripcion: 'Agrega documental a la causa y solicita su incorporación con traslado.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, por la parte que represento, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos caratulados «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
Que vengo por el presente a acompañar la siguiente documentación: {{documentacion}}.
Se agrega en {{cantidad_copias}} juego(s) de copias para su traslado a la contraria.
Por lo expuesto, a V.S. solicito:
1) Se tenga por acompañada la documentación referida y por agregada a los autos.
2) Se corra el traslado de ley.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'toma-vista',
    titulo: 'Toma vista de las actuaciones',
    categoria: 'Escritos judiciales',
    descripcion: 'Solicita tomar vista del expediente y su remisión al domicilio electrónico.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
Que vengo a tomar vista de las presentes actuaciones en su totalidad, solicitando —en su caso— la remisión digital de las mismas al domicilio electrónico constituido, a fin de tomar conocimiento del estado de la causa.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'solicita-copias-desarchivo',
    titulo: 'Solicita copias / desarchivo',
    categoria: 'Escritos judiciales',
    descripcion: 'Pide copias de piezas del expediente y/o el desarchivo de la causa.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
Que solicito se me expidan copias {{tipo_copias}} de las siguientes piezas: {{piezas_solicitadas}}.
Asimismo, y para el caso de encontrarse archivadas las actuaciones, solicito su desarchivo a fin de proseguir con el trámite de la causa.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'denuncia-nuevo-domicilio',
    titulo: 'Denuncia / constituye nuevo domicilio',
    categoria: 'Escritos judiciales',
    descripcion: 'Denuncia nuevo domicilio real y constituye nuevo domicilio procesal.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
Que vengo a denunciar el nuevo domicilio real de mi parte, sito en {{domicilio_real}}, y a constituir nuevo domicilio procesal en {{domicilio_procesal}}, solicitando se tomen las constancias pertinentes y se dirijan a él las futuras notificaciones.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'urge-pronto-despacho',
    titulo: 'Urge pronto despacho',
    categoria: 'Escritos judiciales',
    descripcion: 'Reitera un pedido pendiente de resolución y solicita despacho urgente.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
Que atento al tiempo transcurrido desde la presentación de fecha {{fecha_presentacion}}, sin que haya recaído resolución respecto de lo allí peticionado, vengo a urgir el pronto despacho de las actuaciones, solicitando se provea con carácter urgente lo requerido, en resguardo del derecho de defensa y del principio de celeridad procesal.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'acusa-rebeldia',
    titulo: 'Acusa rebeldía',
    categoria: 'Escritos judiciales',
    descripcion: 'Acusa la rebeldía de la contraria vencido el plazo para comparecer/contestar.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
Que encontrándose vencido el plazo acordado a la parte demandada, {{demandado}}, para comparecer y/o contestar la demanda, sin que lo haya hecho, vengo a acusar su rebeldía en los términos de los arts. 59 y concordantes del CPCCN.
En consecuencia, solicito:
1) Se declare la rebeldía de la demandada.
2) Se disponga la prosecución del trámite, con las presunciones que la rebeldía implica (art. 60 CPCCN).
3) Se notifique la resolución en el domicilio denunciado.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  // ─────────────────────────────────────────────
  // 🛡️ MEDIDAS CAUTELARES
  // ─────────────────────────────────────────────
  {
    id: 'solicita-embargo-preventivo',
    titulo: 'Solicita embargo preventivo',
    categoria: 'Medidas cautelares',
    descripcion: 'Pide embargo preventivo acreditando verosimilitud, peligro en la demora y contracautela.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que vengo a solicitar se decrete EMBARGO PREVENTIVO sobre {{bienes_a_embargar}} de titularidad de {{demandado}}, hasta cubrir la suma de $ {{monto}}, con más lo que se presupueste para responder a intereses y costas.
II. VEROSIMILITUD DEL DERECHO. {{verosimilitud_derecho}} (arts. 195 y 209 CPCCN).
III. PELIGRO EN LA DEMORA. {{peligro_demora}}.
IV. CONTRACAUTELA. Ofrezco caución {{tipo_caucion}}, en los términos del art. 199 CPCCN.
V. PETITORIO. Por lo expuesto, solicito a V.S.:
1) Tenga por promovido el pedido de medida cautelar.
2) Decrete el embargo preventivo solicitado, librando los oficios y/o mandamientos pertinentes.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'solicita-prohibicion-innovar',
    titulo: 'Solicita prohibición de innovar',
    categoria: 'Medidas cautelares',
    descripcion: 'Pide mantener el statu quo de una situación de hecho o de derecho (art. 230 CPCCN).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que vengo a solicitar se decrete PROHIBICIÓN DE INNOVAR, ordenando a {{demandado}} abstenerse de modificar la situación de hecho o de derecho relativa a {{objeto_cautela}}, hasta tanto se resuelva la cuestión de fondo (art. 230 CPCCN).
II. VEROSIMILITUD DEL DERECHO. {{verosimilitud_derecho}}.
III. PELIGRO EN LA DEMORA. {{peligro_demora}}: de alterarse la situación actual se tornaría ineficaz o de imposible cumplimiento la eventual sentencia favorable.
IV. INEXISTENCIA DE OTRA MEDIDA. La medida requerida es la vía idónea, no pudiendo obtenerse igual resultado por otra cautelar.
V. CONTRACAUTELA. Ofrezco caución {{tipo_caucion}} (art. 199 CPCCN).
VI. PETITORIO. Solicito se decrete la medida y se libren las comunicaciones que correspondan.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'solicita-anotacion-litis',
    titulo: 'Solicita anotación de litis',
    categoria: 'Medidas cautelares',
    descripcion: 'Pide anotar la existencia del juicio sobre un bien registrable (art. 229 CPCCN).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que vengo a solicitar se ordene la ANOTACIÓN DE LITIS sobre el bien {{bien_registrable}}, inscripto a nombre de {{demandado}}, a fin de dar publicidad de la existencia del presente juicio frente a terceros (art. 229 CPCCN).
II. VEROSIMILITUD DEL DERECHO. {{verosimilitud_derecho}}, encontrándose el bien directamente vinculado al objeto del litigio.
III. PROCEDENCIA. La medida no impide la disponibilidad del bien, sino que publicita la controversia, resguardando el derecho de mi parte.
IV. CONTRACAUTELA. Ofrezco caución {{tipo_caucion}} (art. 199 CPCCN).
V. PETITORIO. Solicito se decrete la anotación de litis y se libre el oficio pertinente al Registro correspondiente.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  // ─────────────────────────────────────────────
  // 👨👩👧 FAMILIA
  // ─────────────────────────────────────────────
  {
    id: 'divorcio-convenio-regulador',
    titulo: 'Demanda de divorcio con convenio regulador',
    categoria: 'Familia',
    descripcion: 'Promueve el divorcio (art. 437/438 CCyCN) acompañando propuesta reguladora.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Que vengo a promover DEMANDA DE DIVORCIO respecto de mi cónyuge, {{conyuge_demandado}}, con domicilio en {{domicilio_demandado}}, en los términos de los arts. 437 y 438 del CCyCN.
II. MATRIMONIO. Contraje matrimonio con el/la nombrado/a el día {{fecha_matrimonio}}, conforme acta de matrimonio que se acompaña.
III. HIJOS. {{datos_hijos}}.
IV. PROPUESTA REGULADORA (art. 438 CCyCN). Acompaño propuesta que regula los efectos del divorcio, contemplando: {{propuesta_reguladora}} (atribución de la vivienda, cuidado personal y régimen de comunicación de los hijos, alimentos, y liquidación de la comunidad de bienes, según corresponda).
V. PRUEBA. Acta de matrimonio; actas de nacimiento de los hijos; DNI; y demás documentación acompañada.
VI. DERECHO. Arts. 437, 438 y concordantes del CCyCN.
VII. PETITORIO. Solicito a V.S.:
1) Me tenga por presentado, por parte y por constituido el domicilio procesal.
2) Corra traslado de la propuesta reguladora a la contraria.
3) Oportunamente decrete el divorcio y homologue el convenio regulador.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'regimen-comunicacion-cuidado',
    titulo: 'Régimen de comunicación / cuidado personal',
    categoria: 'Familia',
    descripcion: 'Solicita fijar régimen de comunicación y/o cuidado personal de hijos (arts. 652-655 CCyCN).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Que vengo a promover demanda a fin de que se establezca RÉGIMEN DE COMUNICACIÓN y/o CUIDADO PERSONAL respecto de mi hijo/a {{nombre_hijo}}, en relación con el otro progenitor, {{demandado}}, con domicilio en {{domicilio_demandado}}.
II. HECHOS. {{hechos}}.
III. INTERÉS SUPERIOR DEL NIÑO. La medida se funda en el interés superior del niño (art. 3 CDN; arts. 639, 706 CCyCN), garantizando el vínculo con ambos progenitores.
IV. RÉGIMEN PROPUESTO. Propongo el siguiente régimen: {{regimen_propuesto}}.
V. DERECHO. Arts. 641, 648, 652, 653, 655 y concordantes del CCyCN.
VI. PETITORIO. Solicito se cite a audiencia, se dé intervención al Ministerio Público y, oportunamente, se homologue o fije el régimen solicitado.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'homologacion-convenio',
    titulo: 'Solicita homologación de convenio',
    categoria: 'Familia',
    descripcion: 'Pide homologar un acuerdo (alimentos, comunicación, etc.) confiriéndole fuerza ejecutoria.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Que vengo a solicitar la HOMOLOGACIÓN del convenio celebrado con {{otra_parte}} en fecha {{fecha_convenio}}, cuyo texto se acompaña.
II. CONTENIDO. El convenio regula: {{contenido_convenio}}.
III. FUNDAMENTO. Las partes han arribado a un acuerdo que no afecta el orden público ni derechos indisponibles, resultando procedente su homologación a fin de dotarlo de fuerza ejecutoria.
IV. PETITORIO. Solicito a V.S.:
1) Tenga por acompañado el convenio.
2) Dé intervención al Ministerio Público, si correspondiere.
3) Homologue el acuerdo, confiriéndole fuerza de sentencia.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'medidas-proteccion-violencia',
    titulo: 'Solicita medidas de protección (violencia familiar)',
    categoria: 'Familia',
    descripcion: 'Denuncia y pide medidas urgentes de protección (Ley 26.485 y Ley 24.417).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Que vengo a denunciar hechos de violencia y a solicitar MEDIDAS DE PROTECCIÓN URGENTES en el marco de la Ley 26.485 y de la Ley 24.417, respecto de {{denunciado}}, con domicilio en {{domicilio_denunciado}}.
II. HECHOS. {{hechos}}.
III. MEDIDAS SOLICITADAS. Solicito se dispongan, con carácter urgente y sin necesidad de audiencia previa: {{medidas_solicitadas}} (v.gr. prohibición de acercamiento y de contacto por cualquier medio; exclusión del hogar; cese de actos de perturbación o intimidación; prohibición de compra y tenencia de armas; y toda otra que V.S. estime pertinente).
IV. DERECHO. Arts. 26 y ss. de la Ley 26.485; Ley 24.417; art. 3 CDN.
V. PETITORIO. Solicito se adopten de inmediato las medidas requeridas, dada la urgencia y el riesgo, y se dé intervención al equipo interdisciplinario y al Ministerio Público.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  // ─────────────────────────────────────────────
  // 💼 LABORAL / 🛒 CONSUMIDOR
  // ─────────────────────────────────────────────
  {
    id: 'demanda-diferencias-salariales',
    titulo: 'Demanda laboral por diferencias salariales',
    categoria: 'Laboral',
    descripcion: 'Reclama diferencias de haberes, rubros y horas adeudadas conforme LCT y CCT.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Promuevo demanda laboral por cobro de DIFERENCIAS SALARIALES contra {{empleador}}, con domicilio en {{domicilio_empleador}}, por la suma de $ {{monto}}, con más intereses y costas.
II. RELACIÓN LABORAL. Ingresé a trabajar el {{fecha_ingreso}}, desempeñando la categoría {{categoria_laboral}}, con una remuneración mensual de $ {{remuneracion}}, bajo el CCT {{convenio_colectivo}}.
III. DIFERENCIAS RECLAMADAS. {{diferencias_reclamadas}} (v.gr. haberes abonados por debajo del convenio, rubros no liquidados, horas extra impagas, diferencias de categoría). Liquidación practicada: {{detalle_liquidacion}}.
IV. INTIMACIÓN PREVIA. Se intimó al empleador conforme constancias que se acompañan, sin obtener respuesta favorable.
V. DERECHO. Arts. 103, 116, 196, 260 y concordantes de la LCT (Ley 20.744) y CCT aplicable.
VI. PRUEBA. Documental, pericial contable, testimonial e informativa.
VII. PETITORIO. Solicito se tenga por promovida la demanda, se corra traslado y, oportunamente, se condene al pago de las diferencias reclamadas con más intereses y costas.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'demanda-accidente-art',
    titulo: 'Demanda por accidente de trabajo / ART',
    categoria: 'Laboral',
    descripcion: 'Reclama prestaciones por accidente o enfermedad profesional (Ley 24.557 y 27.348).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Promuevo demanda por ACCIDENTE DE TRABAJO / ENFERMEDAD PROFESIONAL contra {{aseguradora}} (Aseguradora de Riesgos del Trabajo) y/o {{empleador}}, por la suma de $ {{monto}}, con más intereses y costas.
II. RELACIÓN LABORAL. Ingresé el {{fecha_ingreso}}, desempeñando la categoría {{categoria_laboral}}, con remuneración de $ {{remuneracion}}.
III. HECHOS DEL SINIESTRO. El día {{fecha_siniestro}}, {{hechos_siniestro}}.
IV. INCAPACIDAD. A raíz del hecho sufrí las siguientes lesiones: {{lesiones}}, con una incapacidad estimada del {{porcentaje_incapacidad}} % de la T.O.
V. INSTANCIA ADMINISTRATIVA. {{estado_comision_medica}} (trámite ante la Comisión Médica, conf. Ley 27.348).
VI. DERECHO. Ley 24.557 y modif., Ley 27.348; en su caso, acción civil (arts. 1716, 1737, 1749 CCyCN).
VII. PRUEBA. Pericial médica, documental, testimonial e informativa.
VIII. PETITORIO. Solicito se tenga por promovida la demanda, se corra traslado y, oportunamente, se condene al pago de las prestaciones e indemnizaciones que correspondan.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'demanda-danos-consumo',
    titulo: 'Demanda por daños — relación de consumo',
    categoria: 'Civil y comercial',
    descripcion: 'Reclama daños derivados de una relación de consumo, con daño punitivo (Ley 24.240).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, a V.S. digo:
I. OBJETO. Promuevo demanda por DAÑOS Y PERJUICIOS derivados de una RELACIÓN DE CONSUMO contra {{proveedor}}, con domicilio en {{domicilio_proveedor}}, por la suma de $ {{monto}}, o lo que en más o en menos resulte de la prueba, con más intereses y costas.
II. RELACIÓN DE CONSUMO. Revisto la calidad de consumidor en los términos de los arts. 1 y 2 de la Ley 24.240 y art. 1092 del CCyCN.
III. HECHOS. {{hechos}}.
IV. RUBROS RECLAMADOS. Daño emergente, daño moral y DAÑO PUNITIVO (art. 52 bis, Ley 24.240): {{detalle_rubros}}.
V. DERECHO. Ley 24.240 (arts. 8 bis, 40, 52 bis, 53); arts. 1092 y ss. CCyCN. Invoco el beneficio de gratuidad (art. 53) y la carga dinámica probatoria en cabeza del proveedor.
VI. PRUEBA. Documental, pericial, testimonial e informativa.
VII. PETITORIO. Solicito se tenga por promovida la demanda, se corra traslado y, oportunamente, se condene al pago de los rubros reclamados con más intereses y costas.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  // ─────────────────────────────────────────────
  // ⚖️ EJECUCIONES
  // ─────────────────────────────────────────────
  {
    id: 'ejecucion-sentencia',
    titulo: 'Promueve ejecución de sentencia',
    categoria: 'Civil y comercial',
    descripcion: 'Ejecuta una sentencia firme incumplida, con liquidación (arts. 499 ss. CPCCN).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que habiendo quedado firme y consentida la sentencia dictada en autos, e incumplida por {{demandado}}, vengo a promover su EJECUCIÓN en los términos de los arts. 499 y siguientes del CPCCN, por la suma de $ {{monto}} en concepto de capital, con más intereses y costas.
II. LIQUIDACIÓN. Acompaño la siguiente liquidación: {{detalle_liquidacion}}.
III. PETITORIO. Solicito a V.S.:
1) Apruebe la liquidación practicada.
2) Intime al ejecutado al pago en el plazo legal, bajo apercibimiento de ejecución.
3) En su defecto, trabe embargo sobre bienes suficientes para cubrir el crédito, intereses y costas.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'ejecucion-honorarios',
    titulo: 'Promueve ejecución de honorarios',
    categoria: 'Civil y comercial',
    descripcion: 'Ejecuta honorarios regulados, firmes e impagos (arts. 499 ss. CPCCN; Ley 27.423).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, letrado/a, con domicilio procesal constituido en {{domicilio_procesal}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que habiendo quedado firmes y siendo exigibles los honorarios regulados a mi favor, por la suma de $ {{monto}}, e impagos pese a la intimación cursada, vengo a promover su EJECUCIÓN contra {{ejecutado}}.
II. FUNDAMENTO. Arts. 499 y ss. del CPCCN y Ley 27.423 de honorarios profesionales.
III. PETITORIO. Solicito a V.S.:
1) Intime al obligado al pago de los honorarios, con más sus intereses, en el plazo de ley.
2) En su defecto, trabe embargo sobre bienes suficientes.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  // ─────────────────────────────────────────────
  // 📜 SUCESORIO
  // ─────────────────────────────────────────────
  {
    id: 'cesion-derechos-hereditarios',
    titulo: 'Denuncia cesión de derechos hereditarios',
    categoria: 'Sucesiones',
    descripcion: 'Incorpora al juicio sucesorio una cesión de derechos hereditarios (art. 2302 CCyCN).',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que vengo a denunciar y acompañar la CESIÓN DE DERECHOS HEREDITARIOS instrumentada por escritura pública N° {{numero_escritura}} de fecha {{fecha_escritura}}, por la cual {{cedente}} cede a {{cesionario}} los derechos y acciones hereditarios que le corresponden en la sucesión de {{causante}}.
II. ALCANCE. La cesión comprende {{alcance_cesion}} (la totalidad o la porción indicada) de la herencia.
III. DERECHO. Arts. 2302 y siguientes del CCyCN.
IV. PETITORIO. Solicito a V.S.:
1) Tenga presente la cesión y por acompañada la escritura.
2) Tenga al cesionario por parte en el carácter invocado.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  {
    id: 'inscripcion-declaratoria-herederos',
    titulo: 'Solicita inscripción de declaratoria de herederos',
    categoria: 'Sucesiones',
    descripcion: 'Pide librar oficios/testimonios para inscribir la declaratoria y transmitir los bienes.',
    cuerpo: `Señor Juez:
{{nombre_parte}}, con el patrocinio letrado del Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:
I. OBJETO. Que habiéndose dictado la declaratoria de herederos en autos, vengo a solicitar se libren los oficios y/o testimonios necesarios para su INSCRIPCIÓN y para la transmisión de los bienes a nombre de los herederos declarados.
II. BIENES. La inscripción se solicita respecto de los siguientes bienes: {{detalle_bienes}}.
III. DERECHO. Arts. 2337 y 2338 del CCyCN.
IV. PETITORIO. Solicito a V.S.:
1) Ordene librar oficio/testimonio al Registro de la Propiedad Inmueble, del Automotor y/o entidad que corresponda.
2) Se autorice al letrado a su diligenciamiento.
Proveer de conformidad,
SERÁ JUSTICIA.`,
  },
  // ═══════════ VARIANTES PROVINCIALES — CAUTELARES / FAMILIA / LABORAL / EJECUCIONES ═══════════
  // ── Corrientes (CPCC Ley 6.556 · plataforma FORUM/CUIF) ──
  {
    id: 'embargo-preventivo-corrientes',
    titulo: 'Solicita embargo preventivo (Corrientes)',
    categoria: 'Medidas cautelares',
    descripcion: 'Embargo preventivo ante la Justicia de Corrientes (CPCC Ley 6.556, gestión FORUM).',
    cuerpo: `SOLICITA EMBARGO PREVENTIVO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, Tomo {{tomo}} Folio {{folio}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:

I. OBJETO
Vengo a solicitar se decrete EMBARGO PREVENTIVO sobre {{bienes_a_embargar}} de titularidad de {{demandado}}, con domicilio en {{domicilio_demandado}}, hasta cubrir la suma de $ {{monto}}, con más lo que se presupueste para intereses y costas.

II. VEROSIMILITUD DEL DERECHO
{{verosimilitud_derecho}}.

III. PELIGRO EN LA DEMORA
{{peligro_demora}}.

IV. CONTRACAUTELA
Ofrezco caución {{tipo_caucion}}, conforme el régimen de medidas cautelares del Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556, arts. 195, 199 y concordantes).

V. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Decrete el embargo preventivo solicitado, librando los oficios y/o mandamientos pertinentes.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'prohibicion-innovar-corrientes',
    titulo: 'Solicita prohibición de innovar (Corrientes)',
    categoria: 'Medidas cautelares',
    descripcion: 'Prohibición de innovar ante la Justicia de Corrientes (CPCC Ley 6.556, FORUM).',
    cuerpo: `SOLICITA PROHIBICIÓN DE INNOVAR

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:

I. OBJETO
Vengo a solicitar se decrete PROHIBICIÓN DE INNOVAR, ordenando a {{demandado}}, con domicilio en {{domicilio_demandado}}, abstenerse de modificar la situación de hecho o de derecho relativa a {{objeto_cautela}} hasta tanto se resuelva la cuestión de fondo.

II. VEROSIMILITUD DEL DERECHO
{{verosimilitud_derecho}}.

III. PELIGRO EN LA DEMORA
{{peligro_demora}}: de alterarse la situación actual, la eventual sentencia favorable se tornaría ineficaz o de imposible cumplimiento.

IV. CONTRACAUTELA
Ofrezco caución {{tipo_caucion}}, conforme el régimen cautelar del Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556, arts. 195, 199, 230 y concordantes).

V. PETITORIO
Solicito se decrete la medida y se libren las comunicaciones que correspondan.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'divorcio-convenio-corrientes',
    titulo: 'Demanda de divorcio con convenio regulador (Corrientes)',
    categoria: 'Familia',
    descripcion: 'Divorcio con propuesta reguladora ante la Justicia de Familia de Corrientes (arts. 437/438 CCyCN; CPCC Ley 6.556).',
    cuerpo: `PROMUEVE DEMANDA DE DIVORCIO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Vengo a promover DEMANDA DE DIVORCIO respecto de mi cónyuge, {{conyuge_demandado}}, con domicilio en {{domicilio_demandado}}, en los términos de los arts. 437 y 438 del Código Civil y Comercial de la Nación.

II. MATRIMONIO
Contraje matrimonio con el/la nombrado/a el día {{fecha_matrimonio}}, conforme acta que se acompaña.

III. HIJOS
{{datos_hijos}}.

IV. PROPUESTA REGULADORA (art. 438 CCyCN)
Acompaño propuesta que regula los efectos del divorcio: {{propuesta_reguladora}} (atribución de la vivienda, cuidado personal y régimen de comunicación de los hijos, alimentos y liquidación de la comunidad de bienes, según corresponda).

V. COMPETENCIA Y PROCEDIMIENTO
Resulta competente la Justicia de Familia de la Provincia de Corrientes, tramitando conforme el Código Procesal Civil y Comercial de Corrientes (Ley N° 6.556).

VI. PRUEBA
Acta de matrimonio; actas de nacimiento de los hijos; DNI y demás documentación: {{prueba_documental}}.

VII. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Corra traslado de la propuesta reguladora; c) Oportunamente decrete el divorcio y homologue el convenio.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'medidas-proteccion-corrientes',
    titulo: 'Solicita medidas de protección — violencia familiar (Corrientes)',
    categoria: 'Familia',
    descripcion: 'Denuncia y medidas urgentes de protección en Corrientes (Ley 26.485 y Ley 24.417).',
    cuerpo: `DENUNCIA Y SOLICITA MEDIDAS DE PROTECCIÓN

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}} (que se solicita mantener reservado), con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Vengo a denunciar hechos de violencia y a solicitar MEDIDAS DE PROTECCIÓN URGENTES en el marco de la Ley 26.485 y la Ley 24.417, respecto de {{denunciado}}, con domicilio en {{domicilio_denunciado}}.

II. HECHOS
{{hechos}}.

III. MEDIDAS SOLICITADAS
Solicito se dispongan, con carácter urgente y sin audiencia previa: {{medidas_solicitadas}} (v.gr. prohibición de acercamiento y contacto por cualquier medio, exclusión del hogar, cese de actos de perturbación, prohibición de compra y tenencia de armas, y toda otra que V.S. estime pertinente).

IV. DERECHO
Arts. 26 y ss. de la Ley 26.485; Ley 24.417; normativa provincial de protección de Corrientes; art. 3 CDN.

V. PETITORIO
Solicito se adopten de inmediato las medidas requeridas, dada la urgencia y el riesgo, y se dé intervención al equipo interdisciplinario y al Ministerio Público.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'accidente-art-corrientes',
    titulo: 'Demanda por accidente de trabajo / ART (Corrientes)',
    categoria: 'Laboral',
    descripcion: 'Accidente o enfermedad profesional ante el fuero Laboral de Corrientes (Ley 24.557 y 27.348; CPCC Ley 6.556).',
    cuerpo: `PROMUEVE DEMANDA POR ACCIDENTE DE TRABAJO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), a V.S. digo:

I. OBJETO
Promuevo demanda por ACCIDENTE DE TRABAJO / ENFERMEDAD PROFESIONAL contra {{aseguradora}} (Aseguradora de Riesgos del Trabajo) y/o {{empleador}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, con más intereses y costas.

II. RELACIÓN LABORAL
Fecha de ingreso: {{fecha_ingreso}}. Categoría: {{categoria_laboral}}. Remuneración: $ {{remuneracion}}.

III. HECHOS DEL SINIESTRO
El día {{fecha_siniestro}}, {{hechos_siniestro}}.

IV. INCAPACIDAD
A raíz del hecho sufrí las siguientes lesiones: {{lesiones}}, con una incapacidad estimada del {{porcentaje_incapacidad}} % de la T.O.

V. INSTANCIA ADMINISTRATIVA
{{estado_comision_medica}} (trámite ante la Comisión Médica, conf. Ley 27.348).

VI. DERECHO Y COMPETENCIA
Ley 24.557 y modif., Ley 27.348; en su caso acción civil (arts. 1716, 1737, 1749 CCyCN). Tramita ante el fuero Laboral de la Provincia de Corrientes conforme su procedimiento vigente y el CPCC (Ley N° 6.556).

VII. PRUEBA
Pericial médica, documental, testimonial e informativa: {{prueba_documental}}.

VIII. PETITORIO
Solicito se tenga por promovida la demanda, se corra traslado y, oportunamente, se condene al pago de las prestaciones e indemnizaciones que correspondan, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'ejecucion-sentencia-corrientes',
    titulo: 'Promueve ejecución de sentencia (Corrientes)',
    categoria: 'Ejecuciones',
    descripcion: 'Ejecución de sentencia firme e incumplida ante la Justicia de Corrientes (CPCC Ley 6.556).',
    cuerpo: `PROMUEVE EJECUCIÓN DE SENTENCIA

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico en la plataforma FORUM (CUIF {{cuif}}), en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:

I. OBJETO
Habiendo quedado firme y consentida la sentencia dictada en autos, e incumplida por {{demandado}}, con domicilio en {{domicilio_demandado}}, vengo a promover su EJECUCIÓN por la suma de $ {{monto}} en concepto de capital, con más intereses y costas.

II. LIQUIDACIÓN
Acompaño la siguiente liquidación: {{detalle_liquidacion}}.

III. DERECHO
Normas sobre ejecución de sentencia del Código Procesal Civil y Comercial de la Provincia de Corrientes (Ley N° 6.556).

IV. PETITORIO
Solicito a V.S.: 1) Apruebe la liquidación; 2) Intime al ejecutado al pago en el plazo legal, bajo apercibimiento de ejecución; 3) En su defecto, trabe embargo sobre bienes suficientes para cubrir el crédito, intereses y costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  // ── Buenos Aires (CPCC Dec-Ley 7425/68 · SCBA/MEV · Departamento Judicial) ──
  {
    id: 'embargo-preventivo-baires',
    titulo: 'Solicita embargo preventivo (Prov. Buenos Aires)',
    categoria: 'Medidas cautelares',
    descripcion: 'Embargo preventivo ante la Justicia de la Provincia de Buenos Aires (CPCC Dec-Ley 7425/68, notificación SCBA).',
    cuerpo: `SOLICITA EMBARGO PREVENTIVO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, Tomo {{tomo}} Folio {{folio}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:

I. OBJETO
Vengo a solicitar se decrete EMBARGO PREVENTIVO sobre {{bienes_a_embargar}} de titularidad de {{demandado}}, con domicilio en {{domicilio_demandado}}, hasta cubrir la suma de $ {{monto}}, con más lo presupuestado para intereses y costas.

II. VEROSIMILITUD DEL DERECHO
{{verosimilitud_derecho}} (art. 209 del CPCC, Decreto-Ley 7425/68).

III. PELIGRO EN LA DEMORA
{{peligro_demora}}.

IV. CONTRACAUTELA
Ofrezco caución {{tipo_caucion}} (art. 199 del CPCC, Decreto-Ley 7425/68).

V. PETITORIO
Solicito a V.S.: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Decrete el embargo preventivo, librando los oficios y/o mandamientos pertinentes.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'prohibicion-innovar-baires',
    titulo: 'Solicita prohibición de innovar (Prov. Buenos Aires)',
    categoria: 'Medidas cautelares',
    descripcion: 'Prohibición de innovar ante la Justicia de la Provincia de Buenos Aires (art. 230 CPCC Dec-Ley 7425/68).',
    cuerpo: `SOLICITA PROHIBICIÓN DE INNOVAR

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:

I. OBJETO
Vengo a solicitar se decrete PROHIBICIÓN DE INNOVAR, ordenando a {{demandado}}, con domicilio en {{domicilio_demandado}}, abstenerse de modificar la situación de hecho o de derecho relativa a {{objeto_cautela}} hasta que se resuelva la cuestión de fondo (art. 230 del CPCC, Decreto-Ley 7425/68).

II. VEROSIMILITUD DEL DERECHO
{{verosimilitud_derecho}}.

III. PELIGRO EN LA DEMORA
{{peligro_demora}}.

IV. CONTRACAUTELA
Ofrezco caución {{tipo_caucion}} (art. 199 del CPCC, Decreto-Ley 7425/68).

V. PETITORIO
Solicito se decrete la medida y se libren las comunicaciones pertinentes.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'divorcio-convenio-baires',
    titulo: 'Demanda de divorcio con convenio regulador (Prov. Buenos Aires)',
    categoria: 'Familia',
    descripcion: 'Divorcio con propuesta reguladora ante el Juzgado de Familia de la Provincia de Buenos Aires (arts. 437/438 CCyCN; CPCC Dec-Ley 7425/68).',
    cuerpo: `PROMUEVE DEMANDA DE DIVORCIO

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Vengo a promover DEMANDA DE DIVORCIO respecto de mi cónyuge, {{conyuge_demandado}}, con domicilio en {{domicilio_demandado}}, conforme los arts. 437 y 438 del Código Civil y Comercial de la Nación.

II. MATRIMONIO
Contraje matrimonio el día {{fecha_matrimonio}}, según acta que se acompaña.

III. HIJOS
{{datos_hijos}}.

IV. PROPUESTA REGULADORA (art. 438 CCyCN)
Acompaño propuesta reguladora: {{propuesta_reguladora}} (atribución de la vivienda, cuidado personal y comunicación de los hijos, alimentos y liquidación de la comunidad, según corresponda).

V. COMPETENCIA Y PROCEDIMIENTO
Resulta competente el Juzgado de Familia del Departamento Judicial de {{departamento_judicial}}, tramitando conforme el CPCC de la Provincia de Buenos Aires (Decreto-Ley 7425/68) y la Ley 11.453.

VI. PRUEBA
Acta de matrimonio, actas de nacimiento, DNI y demás documentación: {{prueba_documental}}.

VII. PETITORIO
Solicito: a) Me tenga por presentado, por parte y por constituidos los domicilios; b) Corra traslado de la propuesta; c) Oportunamente decrete el divorcio y homologue el convenio.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'medidas-proteccion-baires',
    titulo: 'Solicita medidas de protección — violencia familiar (Prov. Buenos Aires)',
    categoria: 'Familia',
    descripcion: 'Denuncia y medidas urgentes de protección en la Provincia de Buenos Aires (Ley provincial 12.569 y Ley 26.485).',
    cuerpo: `DENUNCIA Y SOLICITA MEDIDAS DE PROTECCIÓN

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}} (que se solicita mantener reservado), con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.S. digo:

I. OBJETO
Vengo a denunciar hechos de violencia y a solicitar MEDIDAS DE PROTECCIÓN URGENTES en el marco de la Ley provincial 12.569 y la Ley 26.485, respecto de {{denunciado}}, con domicilio en {{domicilio_denunciado}}.

II. HECHOS
{{hechos}}.

III. MEDIDAS SOLICITADAS
Solicito se dispongan, con carácter urgente y sin audiencia previa: {{medidas_solicitadas}} (v.gr. prohibición de acercamiento y contacto, exclusión del hogar, cese de perturbación, prohibición de compra y tenencia de armas, y toda otra pertinente).

IV. DERECHO
Ley 12.569 (Prov. Bs As) y su reglamentación; Ley 26.485; art. 3 CDN.

V. PETITORIO
Solicito se adopten de inmediato las medidas, dada la urgencia y el riesgo, y se dé intervención al equipo interdisciplinario y al Ministerio Público.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'accidente-art-baires',
    titulo: 'Demanda por accidente de trabajo / ART (Prov. Buenos Aires)',
    categoria: 'Laboral',
    descripcion: 'Accidente o enfermedad profesional ante los Tribunales del Trabajo de la Provincia de Buenos Aires (Ley 24.557 y 27.348; Ley 15.057 texto actualizado).',
    cuerpo: `PROMUEVE DEMANDA POR ACCIDENTE DE TRABAJO

Señor Presidente del Tribunal del Trabajo:

{{nombre_parte}}, DNI N° {{dni_parte}}, con domicilio real en {{domicilio_real_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, a V.E. digo:

I. OBJETO
Promuevo demanda por ACCIDENTE DE TRABAJO / ENFERMEDAD PROFESIONAL contra {{aseguradora}} (ART) y/o {{empleador}}, con domicilio en {{domicilio_demandado}}, por la suma de $ {{monto}}, con más intereses y costas.

II. COMPETENCIA
El Tribunal del Trabajo resulta competente conforme la Ley 15.057 de procedimiento laboral de la Provincia de Buenos Aires.

III. RELACIÓN LABORAL
Fecha de ingreso: {{fecha_ingreso}}. Categoría: {{categoria_laboral}}. Remuneración: $ {{remuneracion}}.

IV. HECHOS DEL SINIESTRO
El día {{fecha_siniestro}}, {{hechos_siniestro}}.

V. INCAPACIDAD
Lesiones sufridas: {{lesiones}}, con incapacidad estimada del {{porcentaje_incapacidad}} % de la T.O.

VI. INSTANCIA ADMINISTRATIVA
{{estado_comision_medica}} (Comisión Médica, conf. Ley 27.348).

VII. DERECHO
Ley 24.557 y modif., Ley 27.348; en su caso acción civil (arts. 1716, 1737, 1749 CCyCN).

VIII. PRUEBA
Pericial médica, documental, testimonial e informativa: {{prueba_documental}}.

IX. PETITORIO
Solicito se tenga por promovida la demanda, se corra traslado y, oportunamente, se condene al pago de las prestaciones e indemnizaciones que correspondan, con costas.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
  {
    id: 'ejecucion-sentencia-baires',
    titulo: 'Promueve ejecución de sentencia (Prov. Buenos Aires)',
    categoria: 'Ejecuciones',
    descripcion: 'Ejecución de sentencia firme e incumplida ante la Justicia de la Provincia de Buenos Aires (arts. 497 ss. CPCC Dec-Ley 7425/68).',
    cuerpo: `PROMUEVE EJECUCIÓN DE SENTENCIA

Señor Juez:

{{nombre_parte}}, DNI N° {{dni_parte}}, con el patrocinio letrado del/de la Dr./Dra. {{abogado}}, constituyendo domicilio procesal en {{domicilio_procesal}} y domicilio electrónico registrado (SCBA), Departamento Judicial de {{departamento_judicial}}, en los autos «{{caratula}}» (Expte. N° {{numero_expediente}}), a V.S. digo:

I. OBJETO
Habiendo quedado firme y consentida la sentencia dictada en autos, e incumplida por {{demandado}}, con domicilio en {{domicilio_demandado}}, vengo a promover su EJECUCIÓN por la suma de $ {{monto}} de capital, con más intereses y costas.

II. LIQUIDACIÓN
Acompaño la siguiente liquidación: {{detalle_liquidacion}}.

III. DERECHO
Arts. 497 y siguientes del CPCC de la Provincia de Buenos Aires (Decreto-Ley 7425/68), sobre ejecución de sentencia.

IV. PETITORIO
Solicito a V.S.: 1) Apruebe la liquidación; 2) Intime al ejecutado al pago en el plazo legal, bajo apercibimiento de ejecución; 3) En su defecto, trabe embargo sobre bienes suficientes.

Proveer de conformidad, SERÁ JUSTICIA.

{{localidad}}, {{fecha}}.`,
  },
	// ✒️ MODELOS NOTARIALES (rubro escribanía)
	{
		id: 'notarial-compraventa-inmueble',
		titulo: 'Escritura de compraventa de inmueble',
		categoria: 'Escrituras',
		descripcion: 'Minuta base: comparecientes, inmueble, precio, antecedentes y cláusulas.',
		industries: ['escribania'],
		cuerpo: `ESCRITURA NÚMERO {{numero_escritura}}.

En la Ciudad de {{ciudad}}, a {{fecha}}, ante mí, {{escribano}}, Titular/Adscripto del Registro Notarial N° {{registro}} de {{jurisdiccion}}, COMPARECEN:

Por una parte, como PARTE VENDEDORA: {{vendedor}}, {{nacionalidad_vendedor}}, DNI {{dni_vendedor}}, CUIT/CUIL {{cuit_vendedor}}, estado civil {{estado_civil_vendedor}}, con domicilio en {{domicilio_vendedor}}.

Y por la otra, como PARTE COMPRADORA: {{comprador}}, {{nacionalidad_comprador}}, DNI {{dni_comprador}}, CUIT/CUIL {{cuit_comprador}}, estado civil {{estado_civil_comprador}}, con domicilio en {{domicilio_comprador}}.

Los comparecientes son personas hábiles y de mi conocimiento (o justifican identidad conforme art. 306 CCyC), y DICEN:

PRIMERO — OBJETO. La PARTE VENDEDORA VENDE a la PARTE COMPRADORA, que ADQUIERE, el inmueble ubicado en {{ubicacion_inmueble}}, Nomenclatura Catastral {{nomenclatura_catastral}}, Matrícula {{matricula}} del Registro de la Propiedad Inmueble de {{jurisdiccion}}, con una superficie de {{superficie}}, según título que se relaciona.

SEGUNDO — PRECIO. El precio total y convenido es de {{precio}} ({{precio_en_letras}}), que la PARTE VENDEDORA declara recibir en este acto de conformidad, sirviendo la presente de eficaz recibo y carta de pago.

TERCERO — ANTECEDENTES DE DOMINIO. Corresponde el dominio a la PARTE VENDEDORA por {{titulo_antecedente}}.

CUARTO — LIBRE DE GRAVÁMENES. Se relacionan los certificados de dominio e inhibiciones expedidos por el Registro, de los que surge que el inmueble se encuentra libre de gravámenes, embargos e inhibiciones, y al día en impuestos, tasas y contribuciones, conforme certificados que se agregan.

QUINTO — POSESIÓN. La PARTE VENDEDORA transmite la posesión en este acto, obligándose por evicción y saneamiento conforme a derecho.

LEÍDA que les fue, los comparecientes la ratifican y firman ante mí, doy fe.

{{vendedor}}        {{comprador}}

Ante mí: {{escribano}}`,
	},
	{
		id: 'notarial-poder-general-amplio',
		titulo: 'Poder general amplio de administración y disposición',
		categoria: 'Poderes',
		descripcion: 'Facultades amplias de administración y disposición a favor de un apoderado.',
		industries: ['escribania'],
		cuerpo: `ESCRITURA NÚMERO {{numero_escritura}}. PODER GENERAL AMPLIO.

En {{ciudad}}, a {{fecha}}, ante mí, {{escribano}}, del Registro Notarial N° {{registro}} de {{jurisdiccion}}, COMPARECE: {{poderdante}}, DNI {{dni_poderdante}}, CUIT/CUIL {{cuit_poderdante}}, estado civil {{estado_civil_poderdante}}, con domicilio en {{domicilio_poderdante}}, persona hábil y de mi conocimiento, y DICE:

Que confiere PODER GENERAL AMPLIO DE ADMINISTRACIÓN Y DISPOSICIÓN a favor de {{apoderado}}, DNI {{dni_apoderado}}, con domicilio en {{domicilio_apoderado}}, con las siguientes facultades:

1) Administrar bienes muebles e inmuebles, celebrar y rescindir locaciones y todo acto de administración.
2) Comprar, vender, permutar, hipotecar, gravar y disponer de bienes muebles e inmuebles, fijando precios, plazos y condiciones.
3) Operar con entidades bancarias y financieras: abrir y cerrar cuentas, librar y endosar cheques, tomar y otorgar créditos.
4) Representarlo/a ante organismos nacionales, provinciales y municipales (AFIP, Rentas, Registros, etc.).
5) Estar en juicio como actor/a o demandado/a, otorgar y revocar poderes judiciales.
6) Realizar todo otro acto necesario para el mejor desempeño del mandato, aun cuando no esté expresamente previsto.

El presente poder es de carácter {{caracter_poder}} y regirá hasta su revocación expresa.

LEÍDA y ratificada, firma ante mí, doy fe.

{{poderdante}}

Ante mí: {{escribano}}`,
	},
	{
		id: 'notarial-poder-especial',
		titulo: 'Poder especial',
		categoria: 'Poderes',
		descripcion: 'Poder acotado a un acto o gestión determinada.',
		industries: ['escribania'],
		cuerpo: `ESCRITURA NÚMERO {{numero_escritura}}. PODER ESPECIAL.

En {{ciudad}}, a {{fecha}}, ante mí, {{escribano}}, del Registro Notarial N° {{registro}}, COMPARECE: {{poderdante}}, DNI {{dni_poderdante}}, con domicilio en {{domicilio_poderdante}}, persona hábil y de mi conocimiento, y DICE:

Que confiere PODER ESPECIAL a favor de {{apoderado}}, DNI {{dni_apoderado}}, para que en su nombre realice el siguiente acto: {{objeto_poder}}, con las facultades necesarias para: {{facultades}}.

El presente poder se limita estrictamente al objeto indicado y caduca una vez cumplido el acto o al vencimiento.

LEÍDA y ratificada, firma ante mí, doy fe.

{{poderdante}}

Ante mí: {{escribano}}`,
	},
	{
		id: 'notarial-autorizacion-viaje-menor',
		titulo: 'Autorización de viaje de menor al exterior',
		categoria: 'Autorizaciones',
		descripcion: 'Autorización de viaje de niñas, niños o adolescentes a fines migratorios.',
		industries: ['escribania'],
		cuerpo: `AUTORIZACIÓN DE VIAJE DE MENOR DE EDAD.

En {{ciudad}}, a {{fecha}}, ante mí, {{escribano}}, del Registro Notarial N° {{registro}}, COMPARECE/N: {{autorizante}}, DNI {{dni_autorizante}}, en su carácter de {{caracter_autorizante}} del/de la menor {{menor}}, DNI {{dni_menor}}, nacido/a el {{fecha_nacimiento_menor}}, y DICE/N:

Que AUTORIZA/N a {{menor}} a viajar al exterior con destino a {{destino}}, entre el {{fecha_salida}} y el {{fecha_regreso}}, en compañía de {{acompanante}}, DNI {{dni_acompanante}} (o sin acompañante, según corresponda).

La presente se otorga a fines migratorios conforme la normativa vigente de la Dirección Nacional de Migraciones, comprendiendo la salida y el reingreso al país.

LEÍDA y ratificada, firma/n ante mí, doy fe.

{{autorizante}}

Ante mí: {{escribano}}`,
	},
	{
		id: 'notarial-acta-constatacion',
		titulo: 'Acta de constatación notarial',
		categoria: 'Actas',
		descripcion: 'Deja constancia fehaciente de hechos percibidos por el escribano.',
		industries: ['escribania'],
		cuerpo: `ACTA NÚMERO {{numero_acta}}. CONSTATACIÓN.

En {{ciudad}}, a {{fecha}}, siendo las {{hora}}, yo, {{escribano}}, del Registro Notarial N° {{registro}}, a requerimiento de {{requirente}}, DNI {{dni_requirente}}, con domicilio en {{domicilio_requirente}}, me constituyo en {{lugar_constatacion}} a fin de constatar los siguientes hechos:

CONSTATO: {{hechos_constatados}}.

Dejo constancia de que lo relacionado es fiel reflejo de lo percibido por mis sentidos en el lugar y momento indicados. {{observaciones}}

Con lo que se dio por terminado el acto, firmando el/la requirente ante mí, doy fe.

{{requirente}}

Ante mí: {{escribano}}`,
	},
	{
		id: 'notarial-certificacion-firmas',
		titulo: 'Certificación de firmas',
		categoria: 'Certificaciones',
		descripcion: 'Nota de certificación notarial de firma e identidad en documento privado.',
		industries: ['escribania'],
		cuerpo: `CERTIFICACIÓN DE FIRMAS. Acta N° {{numero_acta}}.

En {{ciudad}}, a {{fecha}}, CERTIFICO que la/s firma/s que obra/n en el documento adjunto, cuyo objeto es {{objeto_documento}}, ha/n sido puesta/s en mi presencia por:

{{firmante}}, DNI {{dni_firmante}}, con domicilio en {{domicilio_firmante}}, a quien identifico conforme al art. 306 del Código Civil y Comercial.

Doy fe de la autenticidad de la/s firma/s y de la identidad del/de los firmante/s. No emito juicio sobre el contenido ni la validez del acto instrumentado.

{{escribano}}
Registro Notarial N° {{registro}} de {{jurisdiccion}}`,
	},
	{
		id: 'notarial-cesion-derechos-hereditarios',
		titulo: 'Escritura de cesión de derechos hereditarios',
		categoria: 'Sucesiones',
		descripcion: 'Minuta base orientativa de cesión onerosa de derechos y acciones hereditarias (arts. 2302 y ss. CCyC). No aplicable a partición ni a toda sucesión.',
		industries: ['escribania'],
		cuerpo: `ESCRITURA NÚMERO {{numero_escritura}}. CESIÓN DE DERECHOS HEREDITARIOS.

En la Ciudad de {{ciudad}}, a {{fecha}}, ante mí, {{escribano}}, titular del Registro Notarial N° {{registro}} de {{jurisdiccion}}, COMPARECEN:

Por una parte, como CEDENTE: {{cedente}}, DNI {{dni_cedente}}, CUIT/CUIL {{cuit_cedente}}, de nacionalidad {{nacionalidad_cedente}}, estado civil {{estado_civil_cedente}}, con domicilio en {{domicilio_cedente}}.

Y por la otra parte, como CESIONARIO: {{cesionario}}, DNI {{dni_cesionario}}, CUIT/CUIL {{cuit_cesionario}}, de nacionalidad {{nacionalidad_cesionario}}, estado civil {{estado_civil_cesionario}}, con domicilio en {{domicilio_cesionario}}.

Los comparecientes son personas hábiles, de mi conocimiento conforme art. 306 del Código Civil y Comercial de la Nación, y DICEN:

PRIMERO — ANTECEDENTES. Declara el CEDENTE que es heredero legítimo en los autos caratulados "{{caratula_sucesion}}", en trámite ante el Juzgado {{juzgado}} Secretaría {{secretaria}} de la jurisdicción {{jurisdiccion_judicial}}, en virtud del fallecimiento del causante don/doña {{causante}}, ocurrido en fecha {{fecha_fallecimiento}}.

SEGUNDO — CESIÓN. Por este acto, el CEDENTE CEDE Y TRANSFIERE a favor del CESIONARIO, quien ACEPTA, la totalidad de los derechos y acciones hereditarias que le corresponden o puedan corresponderle en la sucesión del causante precitado.

TERCERO — PRECIO Y FORMA DE PAGO. La presente cesión se realiza por el precio total y convenido de {{precio}} ({{precio_en_letras}}), importe que el CEDENTE declara haber recibido íntegramente con anterioridad a este acto en dinero en efectivo/transferencia, otorgando por la presente formal y eficaz recibo y carta de pago.

CUARTO — GARANTÍA Y EVICCIÓN. El CEDENTE garantiza su calidad de heredero conforme a las previsiones del art. 2305 del Código Civil y Comercial de la Nación, respondiendo por evicción en los términos legales.

QUINTO — PRESENTACIÓN EN AUTOS. Se faculta al CESIONARIO o al letrado que este designe para presentar testimonio de la presente escritura en el expediente sucesorio a fin de su agregación y toma de razón judicial.

LEÍDA que fue a los comparecientes, se ratifican de su contenido y la firman ante mí, doy fe.

{{cedente}}        {{cesionario}}

Ante mí: {{escribano}}`,
  },
];

export const MODELOS: ModeloEscrito[] = RAW_MODELOS.map((m) => {
  const t = (m.titulo + ' ' + m.id).toLowerCase();
  const jurisdiction =
    m.jurisdiction ??
    (t.includes('corrientes')
      ? 'Corrientes'
      : t.includes('baires') || t.includes('buenos aires') || t.includes('pba')
      ? 'Provincia de Buenos Aires'
      : 'Nacional');

  return {
    ...m,
    jurisdiction,
    version: m.version ?? '1.0',
    reviewStatus: m.reviewStatus ?? 'pending_review',
  };
});

// 🔗 Sugiere el modelo de escrito más adecuado según el tipo de documento
// detectado por la IA. Devuelve null si no hay una sugerencia clara.
export function sugerirModeloPorTipo(
  tipo: string | null | undefined
): ModeloEscrito | null {
  if (!tipo) return null;
  const t = tipo.toLowerCase();

  let id: string | null = null;

  // Laboral
  if (t.includes('despido') || t.includes('laboral') || t.includes('lct') || t.includes('trabajo')) {
    id = 'demanda-laboral-despido';
  } else if (t.includes('daño') || t.includes('dano') || t.includes('accidente') || t.includes('siniestro')) {
    id = 'demanda-danos-perjuicios';
  } else if (t.includes('aliment')) {
    id = 'demanda-alimentos';
  } else if (t.includes('sucesi') || t.includes('herencia') || t.includes('fallec') || t.includes('defunci')) {
    id = 'inicia-sucesion';
  } else if (t.includes('alquiler') || t.includes('locaci') || t.includes('desalojo') || t.includes('inquilin')) {
    id = 'cd-intimacion-locacion';
  } else if (t.includes('automotor') || t.includes('vehic') || t.includes('transferencia') || t.includes('dominio')) {
    id = 'autoriza-transferencia-automotor';
  } else if (t.includes('ejecut') || t.includes('pagar') || t.includes('cheque') || t.includes('pagaré') || t.includes('título') || t.includes('titulo ejecutivo')) {
    id = 'demanda-ejecutiva-pagare';
  } else if (t.includes('amparo') || t.includes('salud') || t.includes('obra social') || t.includes('prepaga') || t.includes('cobertura')) {
    id = 'accion-amparo-salud';
  } else if (t.includes('jubilaci') || t.includes('previsional') || t.includes('anses') || t.includes('reajuste') || t.includes('haber') || t.includes('pension')) {
    id = 'demanda-reajuste-jubilatorio';
  } else if (t.includes('penal') || t.includes('denuncia') || t.includes('delito') || t.includes('querella') || t.includes('robo') || t.includes('hurto') || t.includes('estafa')) {
    id = 'denuncia-penal';
  } else if (t.includes('oficio')) {
    id = 'oficio-ley-22172';
  } else if (
    t.includes('carta') ||
    t.includes('intimaci') ||
    t.includes('reclamo') ||
    t.includes('mora') ||
    t.includes('deuda')
  ) {
    id = 'carta-documento-intimacion';
  } else if (
    t.includes('autorizaci') ||
    t.includes('poder') ||
    t.includes('compuls')
  ) {
    id = 'autorizacion-compulsar';
  } else if (
    t.includes('demanda') ||
    t.includes('notificaci') ||
    t.includes('cedula') ||
    t.includes('cédula') ||
    t.includes('traslado') ||
    t.includes('oficio') ||
    t.includes('resoluci') ||
    t.includes('sentencia') ||
    t.includes('providencia')
  ) {
    id = 'presentacion-generica';
  }

  if (!id) return null;
  const encontrado = MODELOS.find((m) => m.id === id);
  if (!encontrado || encontrado.reviewStatus === 'outdated' || encontrado.reviewStatus === 'retired') {
    return null;
  }
  return encontrado;
}

export function sugerirModeloNotarialPorTipo(tipo?: string): ModeloEscrito | null {
  const t = (tipo ?? '').toLowerCase();
  if (!t) return null;

  let id: string | null = null;

  if (
    t.includes('compraventa') ||
    t.includes('escritura') ||
    t.includes('dominio') ||
    t.includes('titulo') ||
    t.includes('título') ||
    t.includes('inmueble')
  ) {
    id = 'notarial-compraventa-inmueble';
  } else if (t.includes('autorizaci') || t.includes('viaje')) {
    id = 'notarial-autorizacion-viaje-menor';
  } else if (t.includes('poder')) {
    if (t.includes('especial')) {
      id = 'notarial-poder-especial';
    } else {
      id = 'notarial-poder-general-amplio';
    }
  } else if (t.includes('certificaci') || t.includes('firma')) {
    id = 'notarial-certificacion-firmas';
  } else if (t.includes('acta')) {
    id = 'notarial-acta-constatacion';
  } else if (
    /(?:^|[^\p{L}])(cesi[oó]n|ceder)(?:[^\p{L}]|$)/iu.test(t) &&
    /(?:^|[^\p{L}])(hereditari[oa]s?|herencia|sucesor(?:i[oa]s?)?|sucesi[oó]n)(?:[^\p{L}]|$)/iu.test(t)
  ) {
    id = 'notarial-cesion-derechos-hereditarios';
  }

  if (!id) return null;
  const encontrado = MODELOS.find((m) => m.id === id);
  if (!encontrado || encontrado.reviewStatus === 'outdated' || encontrado.reviewStatus === 'retired') {
    return null;
  }
  return encontrado;
}

export function extractModelVars(cuerpo: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo)) !== null) set.add(m[1]);
  return Array.from(set);
}

export function getModeloReviewStatus(m: ModeloEscrito): ReviewStatus {
  return m.reviewStatus ?? 'pending_review';
}

export interface ModeloInventoryItem {
  id: string;
  titulo: string;
  categoria: string;
  jurisdiction: string;
  reviewStatus: ReviewStatus;
  version: string;
  lastVerifiedAt?: string;
  lastReviewedAt?: string;
  effectiveFrom?: string;
  officialSources?: string[];
  reviewedBy?: string;
  changeNotes?: string;
  isOutdatedOrRetired: boolean;
}

export function getModelosInventory(): ModeloInventoryItem[] {
  return MODELOS.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    categoria: m.categoria,
    jurisdiction: m.jurisdiction ?? 'Nacional',
    reviewStatus: m.reviewStatus ?? 'pending_review',
    version: m.version ?? '1.0',
    lastVerifiedAt: m.lastVerifiedAt,
    lastReviewedAt: m.lastReviewedAt,
    effectiveFrom: m.effectiveFrom,
    officialSources: m.officialSources,
    reviewedBy: m.reviewedBy,
    changeNotes: m.changeNotes,
    isOutdatedOrRetired: m.reviewStatus === 'outdated' || m.reviewStatus === 'retired',
  }));
}
