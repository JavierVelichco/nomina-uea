# Nómina UEA v1.2 — Novedades

Esta versión cambia el enfoque del módulo originalmente llamado Presentismo.

## Modelo

La fuente de verdad es una **novedad por período**. Por ejemplo:

- E — Enfermedad: 02/01/2026 a 31/01/2026.
- LA — Licencia anual / vacaciones.
- NM — National Med, con próxima revisión opcional.
- ART — Novedad ART, con fecha de evento y atención.
- LE — Licencia especial con subtipo.
- AC — Ausente con aviso.
- AS — Ausente sin aviso.

Los feriados se almacenan una sola vez en `feriados`. `SN` es un valor derivado y significa **sin novedad**.

## Reporte diario

El reporte expande los períodos en columnas por fecha y permite exportar a XLSX con:

`Legajo | Apellido | Nombre | CUIL | Sector | fecha 1 | fecha 2 | ...`

## Evolución

El catálogo de códigos está separado en `tipos_novedad`, por lo que se pueden agregar, renombrar o desactivar tipos más adelante sin rediseñar toda la base.
