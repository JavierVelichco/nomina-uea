# Nómina UEA v1.1

Versión del Dashboard + ABM con **importación y exportación Excel/CSV**.

## Importante

Esta versión usa las mismas tablas de Supabase que v1.0. **No ejecutes nuevamente `database.sql`** si tu proyecto ya funciona.

## Configuración

Copiá en `assets/js/config.js` la misma Project URL y Publishable key que ya usás en la versión publicada.

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
};
```

Nunca uses una Secret key en el frontend.

## Novedades v1.1

- Exportar nómina completa a `.xlsx`.
- Exportar sólo los empleados visibles según búsqueda/filtro.
- Descargar plantilla `.xlsx` compatible con los 48 campos de la nómina reducida.
- Importar `.xlsx`, `.xls` o `.csv`.
- Vista previa antes de importar.
- Validación de campos obligatorios y duplicados dentro del archivo.
- Comprobación de legajos y CUIL contra Supabase.
- Dos modos: actualizar existentes + agregar nuevos, o sólo agregar nuevos.
- Importación disponible sólo para roles administrador/operador.

## Cómo actualizar Netlify

1. Conservá tu `config.js` correcto.
2. Comprimí la carpeta `nomina-uea-v1.1` en ZIP.
3. En el sitio existente de Netlify, abrí **Deploys** y realizá un deploy manual con el ZIP.
4. Conservás la misma URL de Netlify.

## Flujo recomendado de prueba

1. Iniciar sesión.
2. Empleados → `Descargar plantilla`.
3. Completar 2 o 3 filas ficticias.
4. Seleccionar el archivo en Importar.
5. Revisar la vista previa.
6. `Importar filas válidas`.
7. Verificar los nuevos registros y el Dashboard.
8. Probar `Exportar Excel`.

## Formato de la plantilla

La hoja `Carga` contiene los encabezados de la nómina. La hoja `Instrucciones` explica cada campo. El campo `Edad` se incluye por compatibilidad visual pero se ignora al importar: la edad se deriva de la fecha de nacimiento.
