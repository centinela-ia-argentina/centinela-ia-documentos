# AGENTS.md — Módulo de Seguridad

- Este modulo es autocontenido. No se modifica ningun archivo fuera de src/modules/seguridad/ salvo autorizacion expresa en la orden de trabajo.
- No se altera ninguna tabla, politica RLS, tipo ni funcion preexistente. Solo se crean objetos nuevos.
- Toda escritura al registro de seguridad pasa por la funcion de insercion. Nunca por INSERT directo.
- Ninguna funcionalidad se renderiza si la bandera de funcionalidad esta apagada.
- No se agregan dependencias externas nuevas sin consulta previa.
- Toda accion que el sistema pueda ejecutar sin intervencion humana debe ser reversible por diseno.
