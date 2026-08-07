# Seguridad por roles y organizaciones

La fuente de verdad de permisos de la aplicacion esta en
`src/lib/permissions/roles.ts`. Las acciones del servidor vuelven a validar esos
permisos antes de escribir datos.

## Matriz

- `admin`: lectura y escritura dentro de su propia organizacion; administra
  usuarios e invitaciones de esa organizacion.
- `employee`: lectura de la organizacion; crea y actualiza expedientes, sube
  documentos y ejecuta analisis.
- `auditor`: solo lectura de expedientes, documentos y auditoria de su
  organizacion.
- `client`: solo lectura de expedientes asignados mediante `cases.assigned_to`
  y de sus documentos vinculados. Conserva exclusivamente expedientes/documentos asignados. No accede a usuarios, reportes, auditoria ni
  configuracion, ni a tablas maestras inmobiliarias.

**Bloqueo general**: Todo perfil inactivo es bloqueado automáticamente y se le deniega el acceso a sus respectivas organizaciones independientemente del rol.

**Tablas Maestras Inmobiliarias**: Las tablas `properties`, `clients`, `rental_contracts` y `rent_index_values` tienen políticas rígidas por rol:
- `admin` y `employee`: lectura y mutación CRUD.
- `auditor`: acceso de solo lectura (read-only).
- `client`: sin acceso a las tablas maestras.

## Aplicacion en Supabase

Despues de desplegar el codigo, ejecutar `role-security-stage-1.sql` desde el
SQL Editor de Supabase. El script:

1. Bloquea mutaciones de expedientes, documentos y analisis para Auditor y
   Cliente.
2. Impide cambiar `organization_id` y evita que un usuario cambie su propio
   rol.
3. Restringe `user_invitations` a administradores de la misma organizacion.
4. Limita Storage privado con la misma matriz de lectura y escritura.

La clave `SUPABASE_SERVICE_ROLE_KEY` omite RLS y solo debe usarse en codigo de
servidor. El flujo de aceptacion de invitaciones la utiliza despues de validar
email, token y organizacion.

## Etapa 2: dueno de plataforma

Ejecutar `platform-owner-stage-2.sql` en Supabase SQL Editor. El script:

- crea `platform_admins`, separada de los roles de organizacion;
- registra a `tobiasexequielperez11@gmail.com` como primer dueno;
- habilita una funcion transaccional exclusiva de `service_role` para crear una
  organizacion y su primera invitacion administrativa;
- no concede acceso a `platform_admins` a usuarios `anon` ni `authenticated`.

El panel privado se encuentra en `/plataforma`. Tanto la pagina como su accion
vuelven a validar al dueno desde el servidor. La aceptacion reutiliza el flujo
existente de invitaciones y crea el perfil `admin` dentro de la nueva organizacion.

## Tablas Notariales
Las tablas `protocolo_escrituras`, `case_derivations` y `derivation_notes` se rigen por políticas RLS robustas que:
- Solo permiten a `admin` y `employee` mutar datos de protocolo.
- Filtran las derivaciones y documentos en Storage según la organización de destino y origen.
- Bloquean por completo a los perfiles `client` el acceso al protocolo o a operar legajos derivados.
- Reemplazan el chequeo inseguro de `match_document_chunks` y restringen lectura/escritura RAG para auditores y administradores.
