(() => {
  const FIELDS = [
    ['legajo','Legajo','Numero de legajo'],
    ['nombre','Nombre','Nombre'],
    ['apellido','Apellido','Apellido'],
    ['cuil','C.U.I.L.','Numero de CUIL'],
    ['sexo','Sexo','M, F o X'],
    ['fecha_nacimiento','F Nac','Fecha de nacimiento'],
    [null,'Edad','Se calcula desde la fecha de nacimiento; no se importa'],
    ['en_convenio','Convenio','Si esta en el convenio o no'],
    ['categoria','Categoría','Puesto de trabajo'],
    ['telefono_corporativo','Teléfono corporativo','Numero de telefono corporativo'],
    ['notebook','Notebook','Si o no'],
    ['mail_corporativo','Mail','Mail corporativo'],
    ['superior_inmediato','Superior Inmediato','Superior inmediato'],
    ['responsable_comite','Responsable comite','Directores responsables'],
    ['direccion_organizacional','Dirección','Dirección organizacional'],
    ['gerencia','Gerencia','Gerencia'],
    ['sector','Sector','Sector'],
    ['centro_costo','C.C.','Centro de costo'],
    ['sucursal_provincia','Provincia','Provincia de la sucursal'],
    ['sucursal_ciudad','Ciudad','Ciudad de la sucursal'],
    ['lugar_trabajo','Lugar de trabajo','Dirección o lugar de trabajo'],
    ['sucursal_cp','CP','Código postal de la sucursal'],
    ['fecha_ingreso','Ingreso','Fecha de ingreso'],
    ['fecha_ingreso_anterior','Anterior','Fecha de ingreso anterior'],
    ['agente_seguro_social','A. S.','Agente de seguro social'],
    ['prepaga','Prepaga','Nombre de la prepaga'],
    ['plan_prepaga','Plan','Plan de la prepaga'],
    ['fecha_baja_prepaga','Baja prepaga','Fecha de baja de prepaga'],
    ['integrantes_grupo','Integrantes','Cantidad de integrantes del grupo familiar'],
    ['fecha_egreso','Egreso','Fecha de egreso'],
    ['motivo_egreso','Motivo de egreso','Motivo de egreso'],
    ['empresa','Empresa','Empresa a la que pertenece'],
    ['observaciones','Observaciones','Observaciones internas'],
    ['temas_pendientes','Temas pendientes','Cuestiones pendientes'],
    ['telefono_particular','Telefono particular','Teléfono particular'],
    ['mail_personal','Mail personal','Mail personal'],
    ['banco','Banco','Banco donde cobra'],
    ['domicilio_calle','Calle','Calle del domicilio'],
    ['domicilio_numero','Número','Número del domicilio'],
    ['domicilio_piso','Piso','Piso'],
    ['domicilio_departamento','Departamento','Departamento'],
    ['domicilio_localidad','Localidad','Localidad'],
    ['domicilio_cp','C. P.','Código postal del domicilio'],
    ['domicilio_provincia','Provincia domicilio','Provincia del domicilio'],
    ['hora_entrada','Entrada','Horario de entrada'],
    ['hora_salida','Salida','Horario de salida'],
    ['hora_entrada_especial','Entrada S','Horario de entrada especial / sábado'],
    ['hora_salida_especial','Salida S','Horario de salida especial / sábado']
  ];

  const aliases = new Map();
  const normalize = value => String(value ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  FIELDS.forEach(([key,label]) => {
    if (!key) return;
    aliases.set(normalize(key), key);
    aliases.set(normalize(label), key);
  });
  [
    ['cuil','cuil'],['f nac','fecha_nacimiento'],['fecha nacimiento','fecha_nacimiento'],
    ['categoria puesto','categoria'],['telefono','telefono_corporativo'],
    ['mail corporativo','mail_corporativo'],['centro de costo','centro_costo'],
    ['provincia sucursal','sucursal_provincia'],['ciudad sucursal','sucursal_ciudad'],
    ['codigo postal sucursal','sucursal_cp'],['fecha ingreso','fecha_ingreso'],
    ['fecha ingreso anterior','fecha_ingreso_anterior'],['agente seguro social','agente_seguro_social'],
    ['baja prepaga','fecha_baja_prepaga'],['integrantes grupo familiar','integrantes_grupo'],
    ['fecha egreso','fecha_egreso'],['telefono particular','telefono_particular'],
    ['codigo postal domicilio','domicilio_cp'],['provincia domicilio','domicilio_provincia'],
    ['entrada especial sabado','hora_entrada_especial'],['salida especial sabado','hora_salida_especial']
  ].forEach(([a,k]) => aliases.set(normalize(a), k));

  const dateFields = new Set(['fecha_nacimiento','fecha_ingreso','fecha_ingreso_anterior','fecha_baja_prepaga','fecha_egreso']);
  const timeFields = new Set(['hora_entrada','hora_salida','hora_entrada_especial','hora_salida_especial']);
  const boolFields = new Set(['en_convenio','notebook']);
  const intFields = new Set(['integrantes_grupo']);
  const required = ['legajo','nombre','apellido','cuil'];
  let parsedRows = [];
  let validRows = [];
  let currentProfile = null;

  function excelDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0,10);
    if (typeof value === 'number') {
      const d = XLSX.SSF.parse_date_code(value);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const s = String(value).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) {
      let y = m[3]; if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
      return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
    return null;
  }

  function excelTime(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      const total = Math.round((value % 1) * 24 * 60);
      const h = Math.floor(total / 60) % 24, m = total % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
    }
    const s = String(value).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    return `${m[1].padStart(2,'0')}:${m[2]}:${m[3] || '00'}`;
  }

  function boolValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    const s = normalize(value);
    if (['si','s','yes','true','1','x'].includes(s)) return true;
    if (['no','n','false','0'].includes(s)) return false;
    return null;
  }

  function cleanValue(key, value) {
    if (value === null || value === undefined || value === '') return null;
    if (dateFields.has(key)) return excelDate(value);
    if (timeFields.has(key)) return excelTime(value);
    if (boolFields.has(key)) return boolValue(value);
    if (intFields.has(key)) {
      const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
    }
    if (key === 'sexo') {
      const s = normalize(value).toUpperCase().slice(0,1);
      return ['F','M','X'].includes(s) ? s : null;
    }
    return String(value).trim() || null;
  }

  function rowToPayload(source) {
    const out = {};
    Object.entries(source).forEach(([header,value]) => {
      const key = aliases.get(normalize(header));
      if (!key) return;
      out[key] = cleanValue(key, value);
    });
    return out;
  }

  function validateRows(rows) {
    const legajos = new Map(), cuils = new Map();
    return rows.map((row,index) => {
      const errors = [];
      required.forEach(k => { if (!row[k]) errors.push(`Falta ${FIELDS.find(f=>f[0]===k)?.[1] || k}`); });
      if (row.sexo && !['F','M','X'].includes(row.sexo)) errors.push('Sexo inválido');
      if (row.legajo) {
        if (legajos.has(row.legajo)) errors.push(`Legajo repetido en filas ${legajos.get(row.legajo)} y ${index+2}`);
        else legajos.set(row.legajo,index+2);
      }
      if (row.cuil) {
        if (cuils.has(row.cuil)) errors.push(`CUIL repetido en filas ${cuils.get(row.cuil)} y ${index+2}`);
        else cuils.set(row.cuil,index+2);
      }
      return {row,index:index+2,errors};
    });
  }

  async function fetchAllEmployees() {
    const all = [];
    const pageSize = 1000;
    for (let from=0;;from+=pageSize) {
      const {data,error} = await db.from('empleados').select('*').order('apellido').range(from,from+pageSize-1);
      if (error) throw error;
      all.push(...(data||[]));
      if (!data || data.length < pageSize) break;
    }
    return all;
  }

  function exportObject(e) {
    const o = {};
    FIELDS.forEach(([key,label]) => {
      if (label === 'Edad') {
        o[label] = e.fecha_nacimiento ? Math.max(0, Math.floor((Date.now()-new Date(`${e.fecha_nacimiento}T00:00:00`))/(365.2425*86400000))) : '';
      } else if (key) {
        let v = e[key] ?? '';
        if (boolFields.has(key) && v !== '') v = v ? 'Sí' : 'No';
        o[label] = v;
      }
    });
    o['Activo'] = e.activo ? 'Sí' : 'No';
    o['ID sistema'] = e.id || '';
    o['Creado en'] = e.creado_en || '';
    o['Actualizado en'] = e.actualizado_en || '';
    return o;
  }

  function saveWorkbook(rows, filename) {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({wch: Math.min(32, Math.max(10,k.length+2))}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nomina');
    XLSX.writeFile(wb, filename, {compression:true});
  }

  async function exportAll() {
    const scope = document.querySelector('#export-scope')?.value || 'active';
    const labels = {
      active: 'activos',
      inactive: 'inactivos',
      all: 'todos'
    };

    setStatus(`Preparando exportación de ${labels[scope]}…`);

    try {
      const data = await fetchAllEmployees();

      const selected = scope === 'active'
        ? data.filter(e => e.activo === true)
        : scope === 'inactive'
          ? data.filter(e => e.activo === false)
          : data;

      if (!selected.length) {
        return setStatus(`No hay empleados ${labels[scope]} para exportar.`, 'error');
      }

      const date = new Date().toISOString().slice(0,10);
      saveWorkbook(
        selected.map(exportObject),
        `nomina_uea_${labels[scope]}_${date}.xlsx`
      );

      setStatus(`Exportados ${selected.length} registros (${labels[scope]}).`, 'success');
    } catch (e) {
      setStatus(`Error al exportar: ${e.message}`, 'error');
    }
  }

  function exportFiltered() {
    const ids = window.getVisibleEmployeeIds?.() || [];
    if (!ids.length) return setStatus('No hay resultados visibles para exportar.', 'error');
    setStatus('Preparando exportación filtrada…');
    fetchAllEmployees().then(data => {
      const selected = data.filter(e => ids.includes(e.id));
      const date = new Date().toISOString().slice(0,10);
      saveWorkbook(selected.map(exportObject), `nomina_uea_filtrada_${date}.xlsx`);
      setStatus(`Exportados ${selected.length} registros visibles.`, 'success');
    }).catch(e => setStatus(`Error al exportar: ${e.message}`, 'error'));
  }

  function downloadTemplate() {
    const headers = FIELDS.map(f=>f[1]);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(h=>({wch:Math.min(28,Math.max(12,h.length+2))}));
    const ins = XLSX.utils.aoa_to_sheet([
      ['Campo','Descripción'],
      ...FIELDS.map(([,label,desc])=>[label,desc])
    ]);
    ins['!cols'] = [{wch:24},{wch:65}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carga');
    XLSX.utils.book_append_sheet(wb, ins, 'Instrucciones');
    XLSX.writeFile(wb, 'plantilla_importacion_nomina_uea.xlsx', {compression:true});
  }

  function setStatus(text, kind='') { showMessage(document.querySelector('#io-message'), text, kind); }

  function renderPreview(validation) {
    const body = document.querySelector('#import-preview-body');
    const stats = document.querySelector('#import-stats');
    const good = validation.filter(x=>!x.errors.length).length;
    const bad = validation.length-good;
    stats.innerHTML = `<strong>${validation.length}</strong> filas · <span class="import-good">${good} válidas</span> · <span class="import-bad">${bad} con errores</span>`;
    body.innerHTML = validation.slice(0,50).map(x=>`<tr>
      <td>${x.index}</td><td>${escapeHtml(x.row.legajo||'—')}</td>
      <td>${escapeHtml(`${x.row.apellido||''}, ${x.row.nombre||''}`)}</td>
      <td>${escapeHtml(x.row.cuil||'—')}</td>
      <td>${x.errors.length ? `<span class="import-bad">${escapeHtml(x.errors.join(' · '))}</span>` : '<span class="import-good">Lista para importar</span>'}</td>
    </tr>`).join('');
    if (validation.length>50) body.innerHTML += `<tr><td colspan="5" class="empty-row">Vista previa de las primeras 50 filas.</td></tr>`;
    document.querySelector('#import-preview').classList.remove('hidden');
    validRows = validation.filter(x=>!x.errors.length).map(x=>x.row);
    document.querySelector('#run-import').disabled = !validRows.length;
  }

  async function readFile(file) {
    setStatus('Leyendo archivo…');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer,{type:'array',cellDates:false});
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true});
    parsedRows = raw.map(rowToPayload).filter(r=>Object.values(r).some(v=>v!==null && v!==''));
    if (!parsedRows.length) throw new Error('No se encontraron filas de datos. Revisá que la primera fila tenga los encabezados.');
    const validation = validateRows(parsedRows);
    renderPreview(validation);
    setStatus(`Archivo leído: ${parsedRows.length} filas. Revisá la vista previa antes de importar.`,'success');
  }

  async function importRows() {
    if (!validRows.length) return;
    const mode = document.querySelector('#import-mode').value;
    const button = document.querySelector('#run-import');
    button.disabled = true;
    setStatus('Comparando con la base…');
    try {
      const existing = await fetchAllEmployees();
      const byLegajo = new Map(existing.map(e=>[String(e.legajo),e]));
      const byCuil = new Map(existing.map(e=>[String(e.cuil),e]));
      const toInsert=[], toUpdate=[], skipped=[], errors=[];
      for (const row of validRows) {
        const leg = String(row.legajo), cuil=String(row.cuil);
        const old = byLegajo.get(leg);
        const cuilOwner = byCuil.get(cuil);
        if (cuilOwner && (!old || cuilOwner.id !== old.id)) { errors.push(`${leg}: CUIL ya pertenece al legajo ${cuilOwner.legajo}`); continue; }
        if (old) {
          if (mode === 'new') skipped.push(leg);
          else toUpdate.push({...row,id:old.id});
        } else toInsert.push(row);
      }

      setStatus(`Importando ${toInsert.length} nuevos y ${toUpdate.length} actualizaciones…`);
      for (let i=0;i<toInsert.length;i+=100) {
        const {error}=await db.from('empleados').insert(toInsert.slice(i,i+100));
        if (error) throw error;
      }
      for (let i=0;i<toUpdate.length;i+=50) {
        await Promise.all(toUpdate.slice(i,i+50).map(async item=>{
          const {id,...changes}=item;
          const {error}=await db.from('empleados').update(changes).eq('id',id);
          if (error) throw error;
        }));
      }
      setStatus(`Importación finalizada: ${toInsert.length} nuevos, ${toUpdate.length} actualizados, ${skipped.length} omitidos${errors.length ? `, ${errors.length} conflictos de CUIL` : ''}.`,'success');
      if (errors.length) console.warn('Conflictos de importación:',errors);
      await window.reloadEmployeesAfterImport?.();
    } catch(e) {
      setStatus(`Error durante la importación: ${e.message}`,'error');
    } finally { button.disabled=false; }
  }

  document.addEventListener('DOMContentLoaded', async()=>{
    currentProfile = await loadCurrentProfile();
    if (!currentProfile) return;
    if (currentProfile.rol === 'consulta') document.querySelector('#import-box')?.classList.add('hidden');
    document.querySelector('#export-all')?.addEventListener('click',exportAll);
    document.querySelector('#export-filtered')?.addEventListener('click',exportFiltered);
    document.querySelector('#download-template')?.addEventListener('click',downloadTemplate);
    document.querySelector('#import-file')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0]; if (!file) return;
      try { await readFile(file); } catch(err) { setStatus(`Error: ${err.message}`,'error'); }
    });
    document.querySelector('#run-import')?.addEventListener('click',importRows);
  });
})();
