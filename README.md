# Centinela IA

**Centinela IA** es una plataforma web en beta operativa para gestión documental inteligente, expedientes, documentos PDF, usuarios, permisos, auditoría, reportes y análisis documental en entorno beta controlado.

El proyecto está orientado inicialmente a organizaciones que manejan documentación sensible o dispersa, como estudios jurídicos, escribanías, inmobiliarias, gestorías, estudios contables, áreas administrativas y PyMEs.

Demo online:
https://centinela-ia-documentos.vercel.app/

---

## Estado actual

**Estado:** Beta operativa comercial / Desarrollo activo
**Sprint actual:** Sprint 15 — Comercialización, demo guiada, landing y preparación de clientes reales
**Estado del producto:** MVP funcional online, validado y listo para primeras demos comerciales controladas.

Centinela IA ya cuenta con una base funcional desplegada en Vercel, con autenticación, gestión de expedientes, carga documental, visor PDF, análisis documental en entorno beta, reportes, auditoría, usuarios, roles, invitaciones, seguridad por organización, landing comercial pública y material comercial preparado para presentar a potenciales clientes.

---

## Qué problema resuelve

Muchas organizaciones trabajan con documentos importantes repartidos entre WhatsApp, correo, carpetas locales, Drive o computadoras personales.

Esto genera problemas como:

* dificultad para encontrar archivos;
* falta de trazabilidad;
* documentos sensibles dispersos;
* poca claridad sobre estados de expedientes;
* usuarios sin control centralizado;
* ausencia de historial operativo;
* revisión documental manual y desordenada.

Centinela IA busca centralizar esa documentación en un panel privado, seguro y organizado.

---

## Funcionalidades implementadas

* Landing comercial pública.
* Login y logout online.
* Recuperación de contraseña.
* Dashboard operativo.
* Gestión de expedientes.
* Paginación server-side y ocultamiento de expedientes archivados en la vista principal.
* Gestión de documentos.
* Carga documental en PDF.
* Supabase Storage privado.
* Visor PDF.
* Enlaces temporales seguros.
* Análisis documental en entorno beta controlado.
* Historial de análisis documental.
* Tipos documentales específicos.
* Sincronización del tipo detectado con el documento principal.
* Reportes operativos.
* Auditoría de actividad.
* Usuarios.
* Invitaciones operativas y reales.
* Roles `admin` y `employee`.
* Bloqueo de rutas sensibles.
* Validación de sesión.
* Políticas RLS por organización.
* Políticas de Storage.
* Acceso a documentos por `organization_id`.
* Acceso a expedientes por `organization_id`.
* Protección de reportes sensibles.
* Protección de auditoría.
* Validaciones server-side.
* Deploy en Vercel.
* Variables protegidas.
* Panel interno de estado beta.
* Panel de seguridad y permisos.
* Panel de variables y entorno.
* Material comercial inicial.
* PDF comercial para clientes.
* Planilla comercial de seguimiento.
* Demo guiada preparada para clientes reales.

---

## Landing comercial

La ruta principal `/` funciona como landing pública de presentación comercial.

Incluye:

* mensaje comercial de Centinela IA;
* rubros objetivo;
* explicación del problema;
* módulos principales;
* seguridad y trazabilidad;
* análisis documental en entorno beta;
* plan beta cerrada;
* botón de WhatsApp;
* acceso al sistema por `/login`.

El botón principal de contacto dirige a WhatsApp para solicitar una demo.

---

## Rubros objetivo

Centinela IA está pensado inicialmente para:

### Estudios jurídicos

Gestión de expedientes, demandas, escritos, contratos, documentación probatoria, sentencias y archivos asociados a clientes o causas.

### Inmobiliarias

Gestión de contratos de alquiler, boletos de compraventa, reservas, documentación de clientes, garantías, recibos y operaciones inmobiliarias.

### Escribanías

Orden documental por trámite, escritura, poder, certificado, compraventa o documentación crítica.

### Empresas y áreas administrativas

Gestión documental para áreas legales, contables, comerciales, administrativas o de recursos humanos.

---

## Stack técnico

* **Frontend:** Next.js 16.2.6, React, TypeScript, Tailwind CSS.
* **Backend / BaaS:** Supabase.
* **Base de datos:** PostgreSQL.
* **Autenticación:** Supabase Auth.
* **Storage:** Supabase Storage.
* **Deploy:** Vercel.
* **Control de versiones:** GitHub.
* **Análisis documental:** entorno beta controlado, preparado para futuras integraciones con proveedores IA externos.

---

## Arquitectura general

El sistema utiliza una arquitectura basada en organizaciones, usuarios, roles, expedientes y documentos.

Tablas principales:

* `profiles`
* `organizations`
* `cases`
* `documents`
* `ai_outputs`
* `audit_logs`
* `user_invitations`

El flujo principal permite que una organización cargue documentos, los asocie a expedientes, visualice archivos PDF, ejecute análisis documental en entorno beta, consulte reportes y mantenga trazabilidad mediante auditoría.

---

## Seguridad

Centinela IA implementa una base de seguridad pensada para beta privada, validación comercial y preparación de uso real:

* autenticación con Supabase Auth;
* roles internos;
* rutas protegidas;
* validaciones server-side;
* separación por organización;
* Row Level Security en Supabase;
* Storage privado;
* bucket documental privado;
* límite de tamaño y tipo de archivo;
* enlaces temporales para documentos;
* auditoría de acciones sensibles;
* variables de entorno protegidas;
* bloqueo de acceso a rutas sensibles según rol;
* control de sesión;
* protección de módulos administrativos.

El sistema diferencia usuarios operativos y administrativos mediante roles, evitando que todos los usuarios tengan acceso a funciones sensibles.

---

## Análisis documental beta

Centinela IA trabaja actualmente con análisis documental en entorno beta controlado.

El sistema permite:

* clasificar documentos;
* detectar nivel de sensibilidad;
* generar datos relevantes;
* generar alertas documentales;
* sugerir próximas acciones;
* mantener historial de análisis;
* registrar modelo utilizado;
* asociar resultados a documento, expediente y organización;
* sincronizar el tipo documental detectado con el documento principal.

Modelo visible actual:

`analisis-documental-beta-v1`

Modo visible actual:

`beta_controlada`

El análisis documental no reemplaza la revisión profesional. Su objetivo es ayudar a ordenar, priorizar y acelerar la lectura inicial de documentos dentro de un flujo controlado.

---

## Tipos documentales soportados

Tipos generales:

* Contrato
* Factura
* Recibo
* Escritura
* DNI
* Otro

Tipos específicos agregados para beta comercial:

* Demanda
* Escrito
* Boleto de compraventa
* Certificado
* Poder
* Garantía
* Reserva

Estos tipos permiten que la demo sea más clara para estudios jurídicos, inmobiliarias y escribanías.

---

## Demo comercial preparada

El sistema ya cuenta con datos demo profesionales para presentación comercial:

### Expedientes demo

* Contrato de Alquiler — Cliente Demo
* Juicio Laboral — Cliente Demo
* Compraventa Inmobiliaria — Cliente Demo

### Documentos demo

* Contrato_Alquiler_Cliente_Demo.pdf
* Demanda_Laboral_Cliente_Demo.pdf
* Boleto_Compraventa_Demo.pdf

Validaciones realizadas:

* visor PDF funcionando;
* análisis documental funcionando;
* historial IA funcionando;
* tipos documentales sincronizados;
* URL de análisis con `analysis=beta`;
* expedientes archivados ocultos en la vista principal;
* documentos visibles como bóveda documental general.

---

## Estado comercial

Centinela IA se encuentra en etapa de beta cerrada para primeros clientes.

Modelo comercial inicial:

* setup inicial;
* mensualidad beta accesible;
* acompañamiento inicial;
* desarrollo a medida opcional.

Propuesta base sugerida:

* **Setup inicial beta:** AR$ 70.000 por única vez.
* **Mensualidad beta:** AR$ 45.000 por mes.
* **Desarrollo a medida:** presupuesto según alcance.

La beta cerrada está pensada para validar el sistema con clientes reales, recopilar feedback y adaptar el flujo documental según necesidades concretas.

---

## Roadmap reciente

### Sprint 10 — Configuración interna y control operativo

* Panel interno de estado beta.
* Panel de seguridad y permisos.
* Panel de variables y entorno.
* Resumen operativo.
* Roadmap interno.

### Sprint 11 — Invitaciones reales y alta de usuarios

* Flujo real de invitaciones.
* Aceptación de invitación por enlace.
* Estados `pending`, `accepted`, `expired`.
* Validación de token y email.
* Prevención de duplicados.
* Cierre formal del flujo de invitaciones.

### Sprint 12 — Recuperación de contraseña y sesión

* Pantalla “Olvidé mi contraseña”.
* Envío real de link de recuperación.
* Pantalla de nueva contraseña.
* Confirmación de contraseña actualizada.
* Mensajes claros.
* Control de sesión.
* Validación integral.

### Sprint 13 — Seguridad fuerte, RLS, Storage y permisos

* Diagnóstico de seguridad.
* RLS activo en tablas sensibles.
* Storage privado.
* Bucket `documents` endurecido.
* Aislamiento por organización.
* Permisos por rol.
* Auditoría validada.
* Corrección de pérdida de sesión en acceso denegado.
* Cierre formal de seguridad fuerte.

### Sprint 14 — UX y pulido profesional

* Diagnóstico visual y funcional.
* Sidebar y layout profesionalizados.
* Dashboard pulido.
* Reportes y usuarios corregidos.
* Expedientes y documentos normalizados.
* Detalle de expediente pulido.
* Datos demo problemáticos eliminados.
* Textos internos de IA limpiados.
* Cierre formal del Sprint 14.

### Sprint 15 — Comercialización, landing, demo y precontacto

Bloques completados:

* Diagnóstico comercial del MVP.
* Definición de rubros objetivo.
* Landing comercial pública.
* Botón de WhatsApp.
* Pulido responsive desktop/mobile.
* Demo guiada comercial.
* Guion oral de demo.
* Pitch de WhatsApp.
* Propuesta beta cerrada.
* PDF comercial.
* Planilla comercial de seguimiento.
* Datos demo profesionales.
* PDFs ficticios de demo.
* Análisis documental validado.
* `analysis=beta`.
* Tipos documentales específicos.
* Sincronización del tipo detectado con el documento principal.
* Ocultamiento de expedientes archivados en `/expedientes`.
* Validación integral antes de contactar clientes.

Pendiente del Sprint 15:

* contacto comercial real con primeros prospectos;
* primeras demos;
* seguimiento comercial;
* cierre general del Sprint 15;
* definición del roadmap posterior.

---

## Próximos pasos

Prioridad inmediata:

1. Contactar primeros prospectos reales.
2. Agendar demos breves.
3. Usar la landing, PDF comercial y planilla de seguimiento.
4. Recopilar feedback real.
5. Detectar necesidades de desarrollo a medida.
6. Validar precio beta.
7. Cerrar el Sprint 15 con resultados comerciales iniciales.

Mejoras futuras recomendadas:

* filtro avanzado en `/documentos`;
* vista de expedientes archivados;
* botón más claro para archivar expediente;
* eliminación controlada de documentos desde la app;
* auditoría avanzada por acción;
* nuevos reportes comerciales;
* más reglas documentales por rubro;
* integración futura con proveedores IA externos;
* módulo de clientes;
* exportación PDF de reportes;
* panel comercial interno.

---

## Instalación local

```bash
npm install
npm run dev
```

La aplicación se ejecuta localmente en:

```bash
http://localhost:3000
```

---

## Build

```bash
npm run build
```

---

## Variables de entorno

El proyecto utiliza variables de entorno para Supabase y configuración interna.

Archivo de referencia:

```bash
.env.local.example
```

No se deben subir claves privadas ni credenciales reales al repositorio.

---

## Deploy

El proyecto se encuentra desplegado en Vercel:

https://centinela-ia-documentos.vercel.app/

---

## Contacto

Desarrollado por:

**Tobías Exequiel Pérez**

Email comercial:
[tobiasexequielperez11@gmail.com](mailto:tobiasexequielperez11@gmail.com)

GitHub:
https://github.com/tobiasexequielperez11-cell

---

## Licencia

Proyecto privado en desarrollo activo.

La apertura parcial o total del código como open source podrá evaluarse más adelante según evolución del producto, seguridad, documentación y estrategia comercial.
