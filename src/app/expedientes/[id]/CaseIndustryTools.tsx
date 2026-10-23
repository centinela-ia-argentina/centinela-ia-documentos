import Link from 'next/link';
import type { ReactNode } from 'react';
import { Coins, Calendar, Bank, PenNib, ShieldCheck, Sparkle, FileText, NotePencil, Megaphone, ListChecks, Warning } from '@phosphor-icons/react/dist/ssr';
import type { CaseRecord } from '@/types/case';
import { canUseAi, type UserRole } from '@/lib/permissions/roles';
import { isEscrituraCompatibleCase, isRentalCompatibleCaseType, isDerivacionEscribaniaCompatible } from '@/lib/industries/caseConfig';
import { extraerFechaBoletoUif } from '@/lib/plazos/fechasCanonicas';
import { AiDisclaimer } from '@/lib/industries/disclaimers';
import type { AnalisisUIF } from '@/lib/ai/uif';
import type { PreScoreInquilino } from '@/lib/ai/preScore';
import { CotejoExpediente } from './CotejoExpediente';
import { RedactarEscrituraButton } from './RedactarEscrituraButton';
import { AnalizarUifButton } from './AnalizarUifButton';
import { CalificarInquilinoButton } from './CalificarInquilinoButton';
import { RosDraftButton } from './RosDraftButton';
import { RedactarBorradorButton } from './RedactarBorradorButton';
import styles from './IndustryTools.module.css';
type Liquidacion = {
    metodo: string;
    ingreso_mensual: number;
    edad: number;
    incapacidad: number;
    capital: number;
    ingreso_anual_ajustado: number;
    anios_computables: number;
    tasa_descuento: number;
    tope_honorarios_730: number;
    intereses?: number;
    intereses_dias?: number;
    intereses_tasa_anual?: number;
    intereses_desde?: string;
    total_con_intereses?: number;
    intereses_estado?: string;
    intereses_motivo?: string;
  } | null;
type Plazo = {
    titulo: string;
    fecha_notificacion: string;
    dias_habiles: number;
    dias_ampliacion: number;
    dias_totales: number;
    km_distancia: number;
    cuenta_desde: string;
    vencimiento: string;
    pasos: string[];
  } | null;
type TasaJusticia = {
    titulo: string;
    base: number;
    porcentaje: number;
    tasa: number;
  } | null;
type BorradorEscritura = | { titulo: string; cuerpo: string; datos_faltantes: string[]; advertencias: string[] }
    | null;
type AvisoComercial = | { titulo: string; aviso: string; destacados: string[]; hashtags: string[]; datos_faltantes: string[] }
    | null;
type BorradorInmoData = | { titulo: string; cuerpo: string; datos_faltantes: string[]; advertencias: string[] }
    | null;

export type CaseIndustryToolsProps = {
 industry: string; caseRecord: CaseRecord; profile: {role:UserRole}; puedeUsarIA:boolean;
 liquidacion:Liquidacion; plazo:Plazo; tasaJusticia:TasaJusticia;
 borradorEscritura:BorradorEscritura; avisoComercial:AvisoComercial; borradorInmoData:BorradorInmoData;
 analisisUif:AnalisisUIF|null; prescore:PreScoreInquilino|null;
 cotejoData:{result_json:unknown;created_at:string}|null; documentosAnalizados:number;
 analisisData:{result_json:unknown}[]|null; resumenData:{result_json:unknown}|null;
 extractedPartes:string; extractedResumenes:string; modeloSugerido:string|null; derivation:ReactNode;
};
export function CaseIndustryTools({industry,caseRecord,profile,puedeUsarIA,liquidacion,plazo,tasaJusticia,borradorEscritura,avisoComercial,borradorInmoData,analisisUif,prescore,cotejoData,documentosAnalizados,analisisData,resumenData,extractedPartes,extractedResumenes,modeloSugerido,derivation}:CaseIndustryToolsProps){
 return <div className={styles.tools}>
{industry === 'legal' && liquidacion && (
                  <section className={styles.tool}>
                    <div className={styles.title}>
                      <Coins size={18} aria-hidden="true" />
                      <h2 className={styles.value}>Liquidación estimada</h2>
                    </div>
                    <p className={styles.description}>
                      Estimación orientativa calculada por el Agente IA a partir de los datos del expediente. No constituye una certeza legal definitiva.
                    </p>
                    <div className={styles.grid}>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Capital estimado</p>
                        <p className={styles.value}>
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(liquidacion.capital)}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Método</p>
                        <p className={styles.value}>
                          {liquidacion.metodo === 'vuoto' ? 'Vuoto' : 'Méndez'}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Años computables</p>
                        <p className={styles.value}>{liquidacion.anios_computables}</p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Art. 730 y Honorarios</p>
                        <p className={styles.title}>
                          El límite de responsabilidad (art. 730 CCyCN) y los honorarios no están calculados automáticamente.
                        </p>
                      </div>
                      <div className={styles.notice}>
                        <p className={styles.caption}>Intereses no calculados</p>
                        <p className={styles.value}>
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(liquidacion.capital)} <span className={styles.description}>(Solo capital base)</span>
                        </p>
                        <p className={styles.footnote}>
                          {liquidacion.intereses_motivo || 'Intereses históricos no calculados. Los valores de intereses guardados por versiones anteriores no se muestran porque no cuentan con una serie histórica y un criterio jurisdiccional verificados.'}
                        </p>
                      </div>
                    </div>
                    <p className={styles.footnote}>
                      Base de cálculo: ingreso mensual {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(liquidacion.ingreso_mensual)} · edad {liquidacion.edad} · incapacidad {liquidacion.incapacidad}% · tasa de descuento {(liquidacion.tasa_descuento * 100).toFixed(0)}%
                    </p>
                  </section>
                )}
                {industry === 'legal' && plazo && (
                  <section className={styles.tool}>
                    <div className={styles.title}>
                      <Calendar size={18} aria-hidden="true" />
                      <h2 className={styles.value}>Vencimiento procesal</h2>
                    </div>
                    <p className={styles.description}>{plazo.titulo}</p>
                    <p className={styles.description}>
                      Cómputo orientativo sobre el calendario de la Justicia Nacional/Federal (fines de semana, feriados y feria judicial). Verificá los feriados provinciales que correspondan.
                    </p>
                    <div className={styles.grid}>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Vence el</p>
                        <p className={styles.value}>
                          {plazo.vencimiento.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Notificación</p>
                        <p className={styles.value}>
                          {plazo.fecha_notificacion.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Empieza a correr</p>
                        <p className={styles.value}>
                          {plazo.cuenta_desde.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Plazo legal</p>
                        <p className={styles.value}>
                          {plazo.dias_habiles} días hábiles
                        </p>
                      </div>
                      {plazo.dias_ampliacion > 0 && (
                        <div className={styles.metric}>
                          <p className={styles.caption}>Ampliación (art. 158)</p>
                          <p className={styles.value}>
                            +{plazo.dias_ampliacion} día(s) por {plazo.km_distancia} km
                          </p>
                        </div>
                      )}
                    </div>
                    <div className={styles.space}>
                      <p className={styles.caption}>Cómo se calculó</p>
                      <ul className={styles.list}>
                        {plazo.pasos.map((paso, i) => (
                          <li key={i}>{paso}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )}
                {industry === 'legal' && tasaJusticia && (
                  <section className={styles.tool}>
                    <div className={styles.title}>
                      <Bank size={18} aria-hidden="true" />
                      <h2 className={styles.value}>Tasa de justicia</h2>
                    </div>
                    <p className={styles.description}>{tasaJusticia.titulo}</p>
                    <p className={styles.description}>
                      Estimación orientativa de la tasa de justicia (Ley 23.898). Se abona al iniciar la demanda. Verificá exenciones, mínimos y la alícuota vigente en la jurisdicción.
                    </p>
                    <div className={styles.grid}>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Tasa a abonar</p>
                        <p className={styles.value}>
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tasaJusticia.tasa)}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Monto del proceso</p>
                        <p className={styles.value}>
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tasaJusticia.base)}
                        </p>
                      </div>
                      <div className={styles.metric}>
                        <p className={styles.caption}>Alícuota</p>
                        <p className={styles.value}>
                          {tasaJusticia.porcentaje}%
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                {(industry === 'escribania' || industry === 'legal' || industry === 'inmobiliaria') && (
                  <CotejoExpediente
                    caseId={caseRecord.id}
                    industry={industry}
                    cotejo={(cotejoData?.result_json as any) ?? null}
                    generadoEl={cotejoData?.created_at ?? null}
                    documentosAnalizados={documentosAnalizados}
                    puedeUsarIA={puedeUsarIA}
                  />
                )}

                {industry === 'escribania' && isEscrituraCompatibleCase(caseRecord.case_type) && (
                  <section className={styles.tool}>
                    <div className={styles.header}>
                      <h3 className={styles.title}><NotePencil size={18} aria-hidden="true" /> Borrador de escritura (IA)</h3>
                      {documentosAnalizados > 0 ? (
                        puedeUsarIA ? <RedactarEscrituraButton caseId={caseRecord.id} yaGenerada={!!borradorEscritura} /> : null
                      ) : (
                        <span className={styles.description}>Analizá al menos 1 documento para habilitarlo</span>
                      )}
                    </div>
                    {borradorEscritura ? (
                      <div className={styles.result}>
                        <p className={styles.caption}>{borradorEscritura.titulo}</p>
                        <pre className={styles.draft}>{borradorEscritura.cuerpo}</pre>
                        {borradorEscritura.datos_faltantes.length > 0 && (
                          <div>
                            <p className={styles.caption}>Datos a completar</p>
                            <ul className={styles.list}>
                              {borradorEscritura.datos_faltantes.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                        {borradorEscritura.advertencias.length > 0 && (
                          <div>
                            <p className={styles.alertTitle}>Advertencias</p>
                            <ul className={styles.list}>
                              {borradorEscritura.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        )}
                        <AiDisclaimer industry={industry} className={styles.disclaimer} />
                        <p className={styles.description}>Borrador generado por IA. Revisalo y completalo antes de otorgar.</p>
                      </div>
                    ) : (
                      <p className={styles.description}>
                        Generá un borrador de escritura a partir de los documentos analizados del legajo.
                        {documentosAnalizados === 0 && ' Primero analizá al menos un documento con IA.'}
                      </p>
                    )}
                  </section>
                )}
                {industry === 'escribania' && (
                  <div className={styles.tool}>
                    <div className={styles.header}>
                      <h3 className={styles.title}><ShieldCheck size={18} aria-hidden="true" /> Análisis UIF / PLA (IA)</h3>
                      <div className={styles.badges}>
                        {analisisUif && (() => {
                          const dump = JSON.stringify((analisisData ?? []).map(a => a.result_json)) + JSON.stringify(resumenData?.result_json);
                          const m1 = dump.match(/(?:precio|monto|valor|venta)[^\d]*(USD|ARS|\$)\s*([\d\.,]+)/i);
                          const montoExtraido = m1 ? `${m1[1].replace('$', 'USD')} ${m1[2]}`.trim() : undefined;
                          const fechaBoletoExtraida = extraerFechaBoletoUif(analisisData ?? [], resumenData, caseRecord);
                          
                          return (
                            <RosDraftButton
                              analisis={analisisUif}
                              legajo={{
                                titulo: caseRecord.title || '',
                                comparecientes: ((caseRecord.metadata?.comparecientes as string) || caseRecord.client_name || '') + (extractedPartes ? ` | Extraídos de IA: ${extractedPartes}` : ''),
                                tipoActo: (caseRecord.metadata?.tipo_acto as string) || caseRecord.case_type || '',
                                fecha: (caseRecord.metadata?.fecha_otorgamiento as string) || '',
                                resumen: extractedResumenes || '',
                                monto: montoExtraido,
                                fechaBoleto: fechaBoletoExtraida
                              }}
                            />
                          );
                        })()}
                        {puedeUsarIA ? <AnalizarUifButton caseId={caseRecord.id} yaGenerada={!!analisisUif} /> : null}
                      </div>
                    </div>
                    {analisisUif ? (
                      <div className={styles.result}>
                        <div className={styles.badges}>
                          <span className={`${styles.badge} ${
                            analisisUif.nivel_riesgo === 'alto' ? styles.danger
                            : analisisUif.nivel_riesgo === 'medio' ? styles.caution
                            : styles.positive}`}>
                            Riesgo {analisisUif.nivel_riesgo.toUpperCase()}
                          </span>
                          {analisisUif.requiere_ros && (
                            <span className={styles.badge}>Evaluar ROS</span>
                          )}
                        </div>
                        {analisisUif.fundamento && <p className={styles.description}>{analisisUif.fundamento}</p>}
                        {analisisUif.factores_riesgo.length > 0 && (
                          <div>
                            <p className={styles.caption}>Factores de riesgo</p>
                            <ul className={styles.list}>
                              {analisisUif.factores_riesgo.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        )}
                        {analisisUif.senales_alerta.length > 0 && (
                          <div>
                            <p className={styles.caption}>Señales de alerta</p>
                            <ul className={styles.list}>
                              {analisisUif.senales_alerta.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {analisisUif.verificaciones_pendientes.length > 0 && (
                          <div>
                            <p className={styles.caption}>Verificaciones pendientes</p>
                            <ul className={styles.list}>
                              {analisisUif.verificaciones_pendientes.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        )}
                        <AiDisclaimer industry={industry} className={styles.disclaimer} />
                      </div>
                    ) : (
                      <p className={styles.description}>Generá un análisis de riesgo PLA/FT del legajo con IA.</p>
                    )}
                  </div>
                )}
                {industry === 'inmobiliaria' && isRentalCompatibleCaseType(caseRecord.case_type) && (
                  <div className={styles.tool}>
                    <div className={styles.header}>
                      <h3 className={styles.title}><Sparkle size={18} aria-hidden="true" /> Pre-Score de Inquilino y Garantía</h3>
                      <CalificarInquilinoButton caseId={caseRecord.id} yaGenerada={!!prescore} />
                    </div>
                    {prescore ? (
                      <div className={styles.result}>
                        <div className={styles.badges}>
                          <span className={`${styles.badge} ${
                            prescore.nivel_calificacion === 'apto' ? styles.positive
                            : prescore.nivel_calificacion === 'condicional' ? styles.caution
                            : prescore.nivel_calificacion === 'no_apto' ? styles.danger
                            : prescore.nivel_calificacion === 'indeterminado' ? styles.caution
                            : styles.neutral
                          }`}>
                            {prescore.nivel_calificacion === 'apto' ? 'Apto'
                            : prescore.nivel_calificacion === 'condicional' ? 'Condicional'
                            : prescore.nivel_calificacion === 'no_apto' ? 'No apto'
                            : prescore.nivel_calificacion === 'indeterminado' ? 'Revisión manual'
                            : 'Información insuficiente'}
                          </span>
                          {prescore.veces_alquiler != null && (
                            <span className={styles.badge}>
                              Cobertura: {prescore.veces_alquiler}× el alquiler
                            </span>
                          )}
                        </div>
                        <div className={styles.description}>
                          <p>
                            <span className={styles.strong}>Ingreso estimado:</span> {
                              prescore.ingreso_neto_mensual_estimado 
                                ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: prescore.moneda_ingreso || 'ARS' }).format(prescore.ingreso_neto_mensual_estimado)
                                : 'No se pudo estimar'
                            }
                          </p>
                          <p className={styles.caption}>Regla aplicada: {prescore.regla_recomendada}</p>
                        </div>
                        {prescore.fundamento && <p className={styles.description}>{prescore.fundamento}</p>}
                        
                        {prescore.garantias.length > 0 && (
                          <div>
                            <p className={styles.caption}>Garantías detectadas</p>
                            <ul className={styles.list}>
                              {prescore.garantias.map((g, i) => <li key={i}>{g}</li>)}
                            </ul>
                          </div>
                        )}
                        {prescore.gravamenes_detectados.length > 0 && (
                          <div>
                            <p className={styles.caption}>Gravámenes sobre garantía</p>
                            <ul className={styles.list}>
                              {prescore.gravamenes_detectados.map((g, i) => <li key={i}>{g}</li>)}
                            </ul>
                          </div>
                        )}
                        {prescore.senales_alerta.length > 0 && (
                          <div>
                            <p className={styles.caption}>Señales de alerta</p>
                            <ul className={styles.list}>
                              {prescore.senales_alerta.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {prescore.verificaciones_pendientes.length > 0 && (
                          <div>
                            <p className={styles.caption}>Verificaciones pendientes</p>
                            <ul className={styles.list}>
                              {prescore.verificaciones_pendientes.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        )}
                        <AiDisclaimer industry="inmobiliaria" className={styles.disclaimer} />
                      </div>
                    ) : (
                      <p className={styles.description}>Evaluá la solvencia del inquilino y solidez de garantías con IA.</p>
                    )}
                  </div>
                )}

                {industry === 'escribania' && (
                  <div className={styles.tool}>
                    <div className={styles.header}>
                      <div>
                        <h3 className={styles.title}>
                          <PenNib size={18} aria-hidden="true" /> Redactar documento notarial
                        </h3>
                        <p className={styles.description}>
                          Abrí el modelo sugerido para este legajo y completá los datos, o elegí otro de la biblioteca.
                        </p>
                      </div>
                      <Link
                        href={modeloSugerido ? `/modelos?modelo=${modeloSugerido}&expediente=${caseRecord.id}` : `/modelos?expediente=${caseRecord.id}`}
                        className={styles.title}
                      >
                        {modeloSugerido ? 'Redactar con el modelo sugerido' : 'Ir a Modelos'}
                      </Link>
                    </div>
                  </div>
                )}

                {industry === 'inmobiliaria' && isRentalCompatibleCaseType(caseRecord.case_type) && (
                  <div className={styles.tool}>
                    <div className={styles.header}>
                      <div>
                        <h3 className={styles.title}>
                          <FileText size={18} aria-hidden="true" /> Contrato de locación
                        </h3>
                        <p className={styles.description}>
                          Prepará el contrato de locación prellenando las partes, el inmueble y las condiciones de la operación.
                        </p>
                      </div>
                      <Link
                        href={`/modelos?modelo=contrato-locacion&operacion=${caseRecord.id}&expediente=${caseRecord.id}`}
                        className={styles.title}
                      >
                        Preparar contrato de locación
                      </Link>
                    </div>
                  </div>
                )}



                {industry === 'inmobiliaria' && (
                  <div className={styles.tool}>
                    <div className={styles.header}>
                      <div>
                        <h2 className={styles.title}><NotePencil size={18} aria-hidden="true" /> Borrador de reserva/boleto con IA</h2>
                        <p className={styles.description}>
                          Redacta un borrador orientativo del documento basándose en la información de la operación.
                        </p>
                      </div>
                      {canUseAi(profile.role) && (
                        <RedactarBorradorButton caseId={caseRecord.id} yaGenerado={!!borradorInmoData} />
                      )}
                    </div>

                    {borradorInmoData && (
                      <div className={styles.result}>
                        <div className={styles.output}>
                          <p className={styles.title}>{borradorInmoData.titulo}</p>
                          <div className={styles.draft}>
                            {borradorInmoData.cuerpo}
                          </div>
                        </div>

                        {(borradorInmoData.datos_faltantes.length > 0 || borradorInmoData.advertencias.length > 0) && (
                          <div className={styles.grid}>
                            {borradorInmoData.datos_faltantes.length > 0 && (
                              <div className={styles.notice}>
                                <p className={styles.title}><ListChecks size={18} aria-hidden="true" /> Datos a completar</p>
                                <ul role="list" className={`${styles.list} ${styles.inlineBulletList}`}>
                                  {borradorInmoData.datos_faltantes.map((it, i) => (
                                    <li key={i} className={styles.description}>• {it}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {borradorInmoData.advertencias.length > 0 && (
                              <div className={styles.alert}>
                                <p className={styles.title}><Warning size={18} aria-hidden="true" /> Advertencias</p>
                                <ul role="list" className={`${styles.list} ${styles.inlineBulletList}`}>
                                  {borradorInmoData.advertencias.map((it, i) => (
                                    <li key={i} className={styles.description}>• {it}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {industry === 'inmobiliaria' && avisoComercial && (
                  <div className={styles.tool}>
                    <div className={styles.title}>
                      <Megaphone size={18} aria-hidden="true" />
                      <h3 className={styles.title}>Aviso comercial (IA)</h3>
                    </div>
                    <p className={styles.description}>{avisoComercial.titulo}</p>
                    <p className={styles.description}>{avisoComercial.aviso}</p>
                    {avisoComercial.destacados.length > 0 && (
                      <div className={styles.space}>
                        <p className={styles.description}>Destacados</p>
                        <ul className={styles.list}>
                          {avisoComercial.destacados.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {avisoComercial.hashtags.length > 0 && (
                      <p className={styles.footnote}>
                        {avisoComercial.hashtags.map((h) => `#${h}`).join(' ')}
                      </p>
                    )}
                    {avisoComercial.datos_faltantes.length > 0 && (
                      <div className={styles.space}>
                        <p className={styles.description}>Datos a sumar</p>
                        <ul className={styles.list}>
                          {avisoComercial.datos_faltantes.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    <p className={styles.footnote}>Aviso generado por IA a partir de los datos de la operación. Revisalo antes de publicar.</p>
                  </div>
                )}

                {industry === 'inmobiliaria' && isDerivacionEscribaniaCompatible(caseRecord.case_type) && (
                  derivation
                )}

 </div>;
}
