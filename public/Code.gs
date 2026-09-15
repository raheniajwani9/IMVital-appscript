/**
 * IM VITALS - Backend Core Engine
 */

// POD_SPREADSHEET_ID and POD_SHEET_NAME are declared in PodCluster.gs.

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('IM VITALS | Operations Platform')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Utility: Converts sheet data array to an array of JS objects from Active Spreadsheet
 */
function sheetToObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
      }
      obj[header] = val;
    });
    return obj;
  });
}

/**
 * Utility: Appends an object as a new row in a target sheet based on header order
 */
function appendObjectToSheet(sheetName, objectData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const keys = Object.keys(objectData);
    sheet.appendRow(keys);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => {
    const val = objectData[header];
    return val !== undefined ? val : "";
  });

  sheet.appendRow(newRow);
  return true;
}

/**
 * Utility: Appends many objects in ONE setValues call.
 *
 * appendRow per object costs a round trip each, which times out well before
 * a few hundred rows — bulk scheduling can hit that easily.
 */
function appendObjectsToSheet(sheetName, objects) {
  const list = objects || [];
  if (!list.length) return 0;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(Object.keys(list[0]));
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const matrix = list.map(function (obj) {
    return headers.map(function (header) {
      const val = obj[header];
      return val !== undefined ? val : '';
    });
  });

  sheet
    .getRange(sheet.getLastRow() + 1, 1, matrix.length, headers.length)
    .setValues(matrix);

  return matrix.length;
}

/**
 * Helper: Reads the POD master and returns one flat object per POD:
 *   { pod_id, pod_code, action, location_id, location_name, store_name, city, cluster }
 *
 * Source is the flat POD_SHEET_NAME tab in POD_SPREADSHEET_ID:
 *   POD ID | Action | Store Name | Cluster | City
 *
 * Columns are matched by header name (see POD_COLUMNS in PodCluster.gs), so
 * column order does not matter. Throws if the spreadsheet or tab is missing —
 * parsing an arbitrary tab instead would return plausible-looking garbage.
 */
function getLocationsList() {
  let ss;
  try {
    ss = SpreadsheetApp.openById(POD_SPREADSHEET_ID);
  } catch (err) {
    throw new Error(
      'Cannot open POD master spreadsheet ' + POD_SPREADSHEET_ID +
      '. Check the ID and that this script\'s account has access. (' + err.message + ')'
    );
  }

  const sheet = ss.getSheetByName(POD_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      'Tab "' + POD_SHEET_NAME + '" not found in the POD master. Tabs present: ' +
      ss.getSheets().map(function (s) { return s.getName(); }).join(', ')
    );
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(function (h) { return String(h).trim().toLowerCase(); });

  const codeIdx    = headerIndex_(headers, POD_COLUMNS.code, -1);
  const storeIdx   = headerIndex_(headers, POD_COLUMNS.store, 2);
  const clusterIdx = headerIndex_(headers, POD_COLUMNS.cluster, 3);
  const cityIdx    = headerIndex_(headers, POD_COLUMNS.city, 4);
  const actionIdx  = headerIndex_(headers, POD_COLUMNS.action, -1);

  let lastCluster = '';
  let lastCity = '';
  const seen = {};
  const out = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const clusterCell = podCell_(row, clusterIdx);
    const cityCell    = podCell_(row, cityIdx);
    const storeCell   = podCell_(row, storeIdx);

    // Skip subtotal rows BEFORE forward-filling, so a pasted "Guntur Total"
    // can never be carried down as a real POD's city.
    if (isTotalRow_(clusterCell) || isTotalRow_(cityCell) || isTotalRow_(storeCell)) continue;

    // The flat tab fills every row, so forward-fill is a no-op here; it only
    // rescues rows where Cluster/City were left blank as a visual grouping.
    if (clusterCell) { lastCluster = clusterCell; lastCity = ''; }
    if (cityCell) { lastCity = cityCell; }

    if (!storeCell) continue;

    const podCode = codeIdx === -1 ? '' : podCell_(row, codeIdx);
    const cluster = lastCluster || 'Unmapped';
    const city    = lastCity || 'Unmapped';

    const dedupeKey = ((podCode || storeCell) + '||' + cluster + '||' + city).toLowerCase();
    if (seen[dedupeKey]) continue;
    seen[dedupeKey] = true;

    out.push({
      pod_id: podCode || slugifyPod_(storeCell),
      pod_code: podCode,
      action: actionIdx === -1 ? '' : podCell_(row, actionIdx),
      location_id: storeCell,
      location_name: storeCell,
      store_name: storeCell,
      city: city,
      cluster: cluster
    });
  }

  out.sort(function (a, b) {
    return (a.cluster + '|' + a.city + '|' + a.location_name)
      .localeCompare(b.cluster + '|' + b.city + '|' + b.location_name);
  });

  return out;
}

/**
 * Helper: Groups raw question_bank rows into structured, multi-section template objects for React
 */
/**
 * Helper: Groups raw question_bank rows into structured, multi-section template objects for React
 */
function getTemplatesGrouped() {
  const rawRows = sheetToObjects('question_bank');
  const templateMap = {};
  const parseBool = (v) => String(v).toLowerCase() === 'true';
  const parseArr = (v) => { try { return JSON.parse(v || '[]'); } catch (e) { return []; } };

  rawRows.forEach(row => {
    const tId = row.template_id || row.template_code;
    if (!tId) return;

    if (!templateMap[tId]) {
      templateMap[tId] = {
        id: tId, template_id: tId,
        template_code: row.template_code || '',
        template_name: row.template_name || 'Untitled Template',
        template_category: row.template_category || 'General',
        template_description: row.template_description || '',
        template_instructions: row.template_instructions || row.instructions || '',
        audit_type: row.audit_type || 'Internal Audit',
        template_owner_id: row.template_owner_id || row.owner || '',
        applicable_locations: row.applicable_locations || 'All Locations',
        template_version: row.template_version || 'v1.0',
        template_status: row.template_status || 'Draft',
        estimated_minutes: Number(row.estimated_minutes) || 0,
        sample_size: Number(row.sample_size) || 0,
        active: row.active,
        effective_date: row.effective_date,
        sections: [], sections_count: 0, questions_count: 0
      };
    }

    const currentTemplate = templateMap[tId];
    const secName = row.section_name || 'General Inspection';
    const secOrder = Number(row.section_order) || 1;
    const secId = row.section_id || `${tId}-SEC-${secOrder}`;

    let section = currentTemplate.sections.find(s => s.section_name === secName);
    if (!section) {
      section = { section_id: secId, section_name: secName, section_order: secOrder, section_instructions: row.section_instructions || '', questions: [] };
      currentTemplate.sections.push(section);
      currentTemplate.sections_count = currentTemplate.sections.length;
    }

    const qText = row.question_text || row.help_text || '';
    if (qText) {
      currentTemplate.questions_count += 1;
      const questionInstructions = row.template_instructions || row.section_instructions || row.help_text || row.instructions || '';

      section.questions.push({
        question_id: row.question_id || `${tId}-Q${String(section.questions.length + 1).padStart(2, '0')}`,
        question_text: qText,
        response_type: row.response_type || 'YES_NO',
        question_order: Number(row.question_order) || section.questions.length + 1,
        points: Number(row.points) || 0,
        required: row.required !== undefined ? row.required : true,
        scored: row.scored !== undefined ? parseBool(row.scored) : true,
        max_score: Number(row.max_score) || Number(row.points) || 0,
        failure_response: row.failure_response || 'NONE',
        critical_question: row.critical_question !== undefined ? parseBool(row.critical_question) : false,
        na_allowed: row.na_allowed !== undefined ? parseBool(row.na_allowed) : false,
        comment_required: row.comment_required || 'NEVER',
        risk_category: row.risk_category || 'General',
        tags: parseArr(row.tags_json),
        help_text: row.help_text || questionInstructions,
        template_instructions: questionInstructions,
        section_instructions: row.section_instructions || '',
        evidence_policy: row.evidence_policy || 'OPTIONAL',
        allowed_evidence: row.allowed_evidence_json ? parseArr(row.allowed_evidence_json) : ['PHOTO'],
        gps_config: row.gps_config_json ? (function(){try{return JSON.parse(row.gps_config_json)}catch(e){return{}}})() : {},
        barcode_config: row.barcode_config_json ? (function(){try{return JSON.parse(row.barcode_config_json)}catch(e){return{}}})() : {},
        signature_config: row.signature_config_json ? (function(){try{return JSON.parse(row.signature_config_json)}catch(e){return{}}})() : {},
        // FIX: pass dedicated barcode/SKU columns through so the React scanner
        // can exact-match real scanned codes (columns are optional; blank if absent).
        item_code: row.item_code || '',
        barcode: row.barcode || '',
        sku: row.sku || '',
        upc: row.upc || ''
      });
    }
  });

  return Object.values(templateMap);
}



/**
 * Initial Data Loader for React App
 */
function getProgramAdminData() {
  const locations = getLocationsList();

  return {
    overview: { complianceScore: "87.4%", auditCompletion: "94.2%", openActionsCount: 38, syncHealth: "99.1%" },
    users: sheetToObjects('users'),
    locations: locations,
    clusters: clustersFromLocations_(locations),
    questionBank: sheetToObjects('question_bank'),
    templates: getTemplatesGrouped(),
    schedules: sheetToObjects('schedules'),
    audits: sheetToObjects('audits'),
    response: sheetToObjects('response'),
    actions: sheetToObjects('actions'),
    action_updates: sheetToObjects('action_updates'),
    evidence: sheetToObjects('evidence'),
    activityLog: sheetToObjects('activity_log'),
  };
}

/**
 * API: Creates a new Checklist Template in the `question_bank` sheet tab.
 */
function apiCreateTemplate(templateData) {
  const templateId = templateData.template_id || ('TMP-' + Utilities.getUuid());

  const version = templateData.template_version || 'v1.0';
  const status = templateData.template_status || 'Draft';
  const active = true;
  const effectiveDate = templateData.effective_date || new Date().toISOString().split('T')[0];

  let totalQuestionsAdded = 0;

  if (Array.isArray(templateData.sections) && templateData.sections.length > 0) {
    templateData.sections.forEach((sec, secIdx) => {
      const secName = sec.section_name || `Section ${secIdx + 1}`;
      const secOrder = Number(sec.section_order) || secIdx + 1;
      const secId = sec.section_id || `${templateId}-SEC-${secOrder}`;
      const secInstructions = sec.section_instructions || templateData.template_instructions || '';

      const questions = Array.isArray(sec.questions) ? sec.questions : [];

      questions.forEach((q, qIdx) => {
        totalQuestionsAdded++;

        const instructionVal = q.template_instructions || q.instructions || secInstructions || templateData.template_instructions || '';

        const row = {
          template_id: templateId,
          template_code: templateData.template_code || '',
          template_name: templateData.template_name || '',
          template_category: templateData.template_category || 'General',
          template_description: templateData.template_description || '',
          template_instructions: instructionVal,
          audit_type: templateData.audit_type || 'Internal Audit',
          template_owner_id: templateData.template_owner_id || '',
          applicable_locations: templateData.applicable_locations || 'All Locations',
          template_version: version,
          template_status: status,
          active: active,
          effective_date: effectiveDate,
          estimated_minutes: Number(templateData.estimated_minutes) || 0,
          sample_size: Number(templateData.sample_size) || 0,
          section_id: secId,
          section_name: secName,
          section_order: secOrder,
          section_instructions: secInstructions,
          section_weight: sec.section_weight || '',
          question_id: `${templateId}-Q${String(totalQuestionsAdded).padStart(2, '0')}`,
          question_text: q.question_text || '',
          response_type: q.response_type || 'YES_NO',
          question_order: Number(q.question_order) || qIdx + 1,
          points: Number(q.points) || 1,
          required: q.is_required !== undefined ? q.is_required : (q.required !== undefined ? q.required : true),
          scored: q.scored !== undefined ? q.scored : true,
          max_score: q.max_score || Number(q.points) || '',
          failure_response: q.failure_response || 'NONE',
          critical_question: q.critical_question || false,
          na_allowed: q.na_allowed || false,
          help_text: q.help_text || instructionVal,
          evidence_policy: q.evidence_policy || 'OPTIONAL',
          allowed_evidence_json: q.allowed_evidence_json || JSON.stringify(['PHOTO']),
          gps_config_json: q.gps_config_json || '{}',
          barcode_config_json: q.barcode_config_json || '{}',
          signature_config_json: q.signature_config_json || '{}',
          comment_required: q.comment_required || 'NEVER',
          risk_category: q.risk_category || 'General',
          tags_json: q.tags_json || JSON.stringify(q.tags || []),
          score_map_json: q.score_map_json || ''
        };


        appendObjectToSheet('question_bank', row);
      });
    });
  } else if (Array.isArray(templateData.questions) && templateData.questions.length > 0) {
    const secName = templateData.section_name || 'General Inspection';
    const secOrder = Number(templateData.section_order) || 1;
    const secId = templateData.section_id || `${templateId}-SEC-01`;

    templateData.questions.forEach((q, i) => {
      totalQuestionsAdded++;

      const instructionVal = q.template_instructions || q.instructions || templateData.template_instructions || '';

      const row = {
        template_id: templateId,
        template_code: templateData.template_code || '',
        template_name: templateData.template_name || '',
        template_category: templateData.template_category || 'General',
        template_description: templateData.template_description || '',
        template_instructions: instructionVal,
        audit_type: templateData.audit_type || 'Internal Audit',
        template_owner_id: templateData.template_owner_id || '',
        applicable_locations: templateData.applicable_locations || 'All Locations',
        template_version: version,
        template_status: status,
        active: active,
        effective_date: effectiveDate,
        estimated_minutes: Number(templateData.estimated_minutes) || 0,
        sample_size: Number(templateData.sample_size) || 0,
        section_id: q.section_id || secId,
        section_name: q.section_name || secName,
        section_order: Number(q.section_order) || secOrder,
        section_instructions: q.section_instructions || '',
        question_id: `${templateId}-Q${String(i + 1).padStart(2, '0')}`,
        question_text: q.question_text || '',
        response_type: q.response_type || 'YES_NO',
        question_order: i + 1,
        points: Number(q.points) || 1,
        required: q.is_required !== undefined ? q.is_required : (q.required !== undefined ? q.required : true),
        scored: q.scored !== undefined ? q.scored : true,
        help_text: q.help_text || instructionVal,
        evidence_policy: q.evidence_policy || 'OPTIONAL',
        allowed_evidence_json: q.allowed_evidence_json || JSON.stringify(['PHOTO']),
        gps_config_json: q.gps_config_json || '{}',                                    
        barcode_config_json: q.barcode_config_json || '{}',                           
        signature_config_json: q.signature_config_json || '{}',                        
        risk_category: q.risk_category || ''
      };

      appendObjectToSheet('question_bank', row);
    });
  } else {
    throw new Error("Cannot create template without valid sections or questions.");
  }

  logActivity(
    'SYSTEM',
    'question_bank',
    templateId,
    'CREATE',
    '',
    JSON.stringify({
      template_name: templateData.template_name,
      template_code: templateData.template_code,
      question_count: totalQuestionsAdded
    }),
    `Created template "${templateData.template_name || ''}" with ${totalQuestionsAdded} question(s).`
  );

  return { success: true, template_id: templateId, questions_added: totalQuestionsAdded };
}

/**
 * API: Deletes all rows associated with a template_id in the question_bank sheet.
 */
function apiDeleteTemplate(templateId) {
  if (!templateId) throw new Error("Template ID is required for deletion.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('question_bank');
  if (!sheet) throw new Error("Sheet 'question_bank' not found.");

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, count: 0 };

  const headers = data[0];
  const idIndex = headers.indexOf('template_id');
  const codeIndex = headers.indexOf('template_code');
  
  if (idIndex === -1 && codeIndex === -1) {
    throw new Error("Missing template identifier column in question_bank sheet.");
  }

  let deletedCount = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    const rowId = data[i][idIndex] || data[i][codeIndex];
    if (String(rowId) === String(templateId)) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  logActivity('SYSTEM', 'question_bank', templateId, 'DELETE', '', '', `Deleted template ${templateId} (${deletedCount} rows removed).`);
  return { success: true, deletedCount };
}

/**
 * API: Updates an existing Template.
 */
function apiUpdateTemplate(templateData) {
  const targetId = templateData.template_id || templateData.id;
  if (!targetId) throw new Error("Template ID is required to update.");

  apiDeleteTemplate(targetId);

  const updatedData = { ...templateData, template_id: targetId };
  const result = apiCreateTemplate(updatedData);

  logActivity('SYSTEM', 'question_bank', targetId, 'UPDATE', '', JSON.stringify(templateData), `Updated template "${templateData.template_name}".`);
  return { success: true, template_id: targetId, rows_updated: result.questions_added };
}

/**
 * Audit Logger
 */
function logActivity(userId, entityType, entityId, activityType, oldState, newState, description) {
  const logEntry = {
    activity_id: 'ACTLOG-' + Date.now(),
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    activity_type: activityType,
    old_state: oldState,
    new_state: newState,
    description: description,
    session_id: 'SESS-' + Date.now(),
    created_at: new Date().toISOString()
  };

  try {
    appendObjectToSheet('activity_log', logEntry);
  } catch (e) {
    console.warn("Could not write to activity_log:", e.message);
  }
}

/**
 * API: Adds a custom category directly into the question_bank sheet
 */
function apiAddCategory(payload) {
  const categoryName = payload.category_name || payload;
  if (!categoryName) throw new Error("Category name is required.");

  const row = {
    template_id: 'CAT-' + Date.now(),
    template_code: 'CAT',
    template_name: 'Category Metadata Entry',
    template_category: categoryName,
    template_status: 'Draft',
    active: true
  };

  appendObjectToSheet('question_bank', row);
  logActivity('SYSTEM', 'question_bank', row.template_id, 'CREATE_CATEGORY', '', categoryName, `Created category "${categoryName}".`);
  return { success: true, category_name: categoryName };
}

/**
 * API: Update Category Name across matching rows
 */
function apiUpdateCategory(payload) {
  const oldName = payload.old_name;
  const newName = payload.new_name;
  
  if (!oldName || !newName) throw new Error("Old and new category names are required.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('question_bank');
  if (!sheet) return { success: true };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true };

  const headers = data[0];
  const catIndex = headers.indexOf('template_category');
  if (catIndex === -1) return { success: true };

  let updatedCount = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][catIndex]) === String(oldName)) {
      sheet.getRange(i + 1, catIndex + 1).setValue(newName);
      updatedCount++;
    }
  }

  logActivity('SYSTEM', 'question_bank', 'CAT-UPDATE', 'UPDATE_CATEGORY', oldName, newName, `Renamed category "${oldName}" to "${newName}".`);
  return { success: true, updatedCount };
}

/**
 * API: Delete Category Name
 */
function apiDeleteCategory(categoryName) {
  if (!categoryName) throw new Error("Category name is required.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('question_bank');
  if (!sheet) return { success: true };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true };

  const headers = data[0];
  const catIndex = headers.indexOf('template_category');
  if (catIndex === -1) return { success: true };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][catIndex]) === String(categoryName)) {
      sheet.getRange(i + 1, catIndex + 1).setValue('Operations');
    }
  }

  logActivity('SYSTEM', 'question_bank', 'CAT-DELETE', 'DELETE_CATEGORY', categoryName, 'Operations', `Deleted category "${categoryName}".`);
  return { success: true };
}

/**
 * Helper: Find Template Title by ID
 */
function getTemplateTitleById(templateId) {
  const templates = getTemplatesGrouped();
  const found = templates.find(t => String(t.template_id) === String(templateId) || String(t.template_code) === String(templateId));
  return found ? found.template_name : templateId;
}

/**
 * Helper: Find Auditor Email from Users sheet
 */
function getAuditorEmail(auditorNameOrId) {
  if (!auditorNameOrId) return '';
  if (auditorNameOrId.includes('@')) return auditorNameOrId;

  const users = sheetToObjects('users');
  const matched = users.find(u => 
    String(u.user_id) === String(auditorNameOrId) || 
    String(u.full_name) === String(auditorNameOrId) ||
    String(u.name) === String(auditorNameOrId)
  );

  return matched ? matched.email : '';
}

/**
 * API: Creates a new Audit Schedule & dispatches email notification to assigned auditor
 */
/**
 * API: Creates ONE schedule per selected POD, then sends the auditor a single
 * digest email for the whole batch.
 */
function apiCreateSchedules(payload) {
  if (!payload || !payload.template_id) {
    throw new Error('Template ID is required to create a schedule.');
  }

  const pods = (payload.pods || []).filter(function (p) {
    return p && (p.pod_id || p.location_id);
  });

  if (!pods.length) {
    throw new Error('Select at least one POD — no schedule was created.');
  }

  ensureSheet_('schedules', SCHEDULE_HEADERS);

  const nowISO = new Date().toISOString();
  const batchStamp = Date.now();
  const templateTitle = payload.template_name || getTemplateTitleById(payload.template_id);

  const currentUserEmail = Session.getActiveUser().getEmail();
  const auditorEmail =
    payload.assigned_auditor_email ||
    getAuditorEmail(payload.assigned_auditor) ||
    currentUserEmail;
  const auditorName = payload.assigned_auditor || 'Assigned Auditor';

  const rows = pods.map(function (pod, i) {
    return {
      schedule_id: 'SCH-' + batchStamp + '-' + (i + 1),
      template_id: payload.template_id,
      template_name: templateTitle,
      template_version: payload.template_version || 'v1.0',
      pod_id: String(pod.pod_id || '').trim(),
      location_id: String(pod.location_id || '').trim(),
      city: String(pod.city || '').trim(),
      cluster: String(pod.cluster || '').trim(),
      frequency: payload.frequency || 'WEEKLY',
      next_run_date: payload.next_run_date || payload.start_date || '',
      assigned_auditor: auditorName,
      assigned_auditor_email: auditorEmail,
      start_date: payload.start_date || '',
      due_date: payload.due_date || '',
      priority: payload.priority || 'MEDIUM',
      status: payload.status || 'SCHEDULED',
      end_date: payload.end_date || '',
      active: payload.active !== undefined ? payload.active : true,
      created_by: payload.created_by || 'Program Admin',
      created_at: payload.created_at || nowISO
    };
  });

  appendObjectsToSheet('schedules', rows);

  // Non-blocking coverage check across every cluster in the batch
  const batchClusters = {};
  rows.forEach(function (r) { if (r.cluster) batchClusters[r.cluster] = true; });

  const assignee = sheetToObjects('users').filter(function (u) {
    return String(u.email || '').trim().toLowerCase() === String(auditorEmail).trim().toLowerCase();
  })[0];

  if (assignee) {
    const covered = userClusters_(assignee).map(function (c) { return c.toLowerCase(); });
    const outside = Object.keys(batchClusters).filter(function (c) {
      return covered.indexOf(c.toLowerCase()) === -1;
    });
    if (outside.length) {
      Logger.log('Coverage warning: ' + auditorEmail +
        ' is not mapped to cluster(s): ' + outside.join(', '));
    }
  }

  // --- DISPATCH EMAIL WITH APP URL ---
  if (auditorEmail && auditorEmail.indexOf('@') !== -1) {
    try {
      // Dynamic fallback gets current script URL, or defaults to your deployed link
      let baseUrl = 'https://script.google.com/a/macros/external.swiggyimnet.in/s/AKfycbzuX_cWWNHvGVuzdkUYHGrPjwNwY0MWi3s4NpfLg6d6vhcE1Vm6Z89HbfiX5icd7E79cw/exec';
      try {
        const publishedUrl = ScriptApp.getService().getUrl();
        if (publishedUrl) baseUrl = publishedUrl;
      } catch (e) {}

      const appUrl = `${baseUrl}?page=audits`;
      const emailContent = buildScheduleDigest_(auditorName, templateTitle, rows, appUrl);

      const subject = '[IM VITALS] Action Required: ' + rows.length + ' New Audit' +
        (rows.length > 1 ? 's' : '') + ' Assigned - ' + templateTitle;

      MailApp.sendEmail(auditorEmail, subject, emailContent.text, {
        htmlBody: emailContent.html
      });

      Logger.log('Digest for ' + rows.length + ' schedules sent from ' +
        currentUserEmail + ' to ' + auditorEmail);
    } catch (err) {
      Logger.log('Failed to send digest to ' + auditorEmail + ': ' + err.message);
    }
  } else {
    Logger.log('Skipped email dispatch: No valid recipient email address found.');
  }

  logActivity(
    'SYSTEM',
    'schedules',
    'BATCH-' + batchStamp,
    'CREATE',
    '',
    JSON.stringify({ count: rows.length, schedule_ids: rows.map(function (r) { return r.schedule_id; }) }),
    'Scheduled "' + templateTitle + '" at ' + rows.length + ' POD(s) for ' +
      auditorName + ' (' + auditorEmail + ').'
  );

  return {
    success: true,
    count: rows.length,
    schedule_ids: rows.map(function (r) { return r.schedule_id; }),
    email_sent_to: auditorEmail
  };
}

  /** 
 * Build HTML and Plain Text email payload listing every POD with an interactive app button and web link
 */
function buildScheduleDigest_(auditorName, templateTitle, rows, appUrl) {
  const first = rows[0];

  const byCity = {};
  rows.forEach(function (r) {
    const k = (r.cluster || '-') + ' / ' + (r.city || '-');
    if (!byCity[k]) byCity[k] = [];
    byCity[k].push(r);
  });

  let podSummaryHtml = '';
  let podSummaryText = '';

  Object.keys(byCity).sort().forEach(function (k) {
    podSummaryHtml += `<div style="margin-bottom: 8px;"><strong>${k} (${byCity[k].length})</strong><ul style="margin: 4px 0; padding-left: 20px;">`;
    podSummaryText += `\n${k} (${byCity[k].length})\n`;

    byCity[k].forEach(function (r) {
      podSummaryHtml += `<li>${r.location_id} ${r.pod_id ? `[${r.pod_id}]` : ''} &rarr; <code>${r.schedule_id}</code></li>`;
      podSummaryText += `   - ${r.location_id} ${r.pod_id ? `[${r.pod_id}]` : ''} → ${r.schedule_id}\n`;
    });

    podSummaryHtml += `</ul></div>`;
  });

  // HTML Body with Action Link & Call-to-Action Button
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #1e293b; margin-top: 0;">New Audit Assigned</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        Hello <strong>${auditorName}</strong>,<br>
        You have been assigned <strong>${rows.length} audit(s)</strong> on <strong>IM VITALS</strong>.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h3 style="color: #0f172a; font-size: 14px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
          Audit Task Overview
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px;">Standard Title:</td>
            <td style="padding: 4px 0;">${templateTitle}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Recurrence:</td>
            <td style="padding: 4px 0;">${first.frequency}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Priority:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${first.priority === 'CRITICAL' || first.priority === 'HIGH' ? '#dc2626' : '#2563eb'}; font-weight: bold;">
                ${first.priority}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Start Date:</td>
            <td style="padding: 4px 0;">${first.start_date}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Due Date:</td>
            <td style="padding: 4px 0; color: #dc2626; font-weight: bold;">${first.due_date}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">POD Count:</td>
            <td style="padding: 4px 0;">${rows.length}</td>
          </tr>
        </table>

        <h4 style="color: #0f172a; font-size: 13px; margin-top: 16px; margin-bottom: 8px;">
          Assigned PODs:
        </h4>
        <div style="font-size: 13px; color: #334155; line-height: 1.6; background-color: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
          ${podSummaryHtml}
        </div>
      </div>

      <!-- Prominent Action Link Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${appUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Perform Audit in IM VITALS
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
        Please log in to IM VITALS to complete these inspections prior to <strong>${first.due_date}</strong>.<br><br>
        Sent via <strong>IM VITALS Operations Engine</strong><br>
        Direct App URL: <a href="${appUrl}" style="color: #2563eb;">${appUrl}</a>
      </p>
    </div>
  `;

  // Plain Text Fallback Body including the URL directly
  const textBody =
    'Hello ' + auditorName + ',\n\n' +
    'You have been assigned ' + rows.length + ' audit' + (rows.length > 1 ? 's' : '') +
    ' on IM VITALS.\n\n' +
    'Audit Task Overview:\n' +
    '--------------------------------------------------\n' +
    '• Standard Title: ' + templateTitle + '\n' +
    '• Recurrence:     ' + first.frequency + '\n' +
    '• Priority:       ' + first.priority + '\n' +
    '• Start Date:     ' + first.start_date + '\n' +
    '• Due Date:       ' + first.due_date + '\n' +
    '• POD Count:      ' + rows.length + '\n' +
    '--------------------------------------------------\n\n' +
    'Assigned PODs:\n' +
    podSummaryText + '\n\n' +
    'Perform Audit / Access Application Link:\n' +
    appUrl + '\n\n' +
    'Please log in to IM VITALS to complete these inspections prior to ' +
    first.due_date + '.\n\nSent via IM VITALS Operations Engine\n';

  return { html: htmlBody, text: textBody };
}


/**
 * API: Creates ONE schedule per selected POD, then sends the auditor a single
 * digest email for the whole batch.
 */
function apiCreateSchedules(payload) {
  if (!payload || !payload.template_id) {
    throw new Error('Template ID is required to create a schedule.');
  }

  const pods = (payload.pods || []).filter(function (p) {
    return p && (p.pod_id || p.location_id);
  });

  if (!pods.length) {
    throw new Error('Select at least one POD — no schedule was created.');
  }

  ensureSheet_('schedules', SCHEDULE_HEADERS);

  const nowISO = new Date().toISOString();
  const batchStamp = Date.now();
  const templateTitle = payload.template_name || getTemplateTitleById(payload.template_id);

  const currentUserEmail = Session.getActiveUser().getEmail();
  const auditorEmail =
    payload.assigned_auditor_email ||
    getAuditorEmail(payload.assigned_auditor) ||
    currentUserEmail;
  const auditorName = payload.assigned_auditor || 'Assigned Auditor';

  const rows = pods.map(function (pod, i) {
    return {
      schedule_id: 'SCH-' + batchStamp + '-' + (i + 1),
      template_id: payload.template_id,
      template_name: templateTitle,
      template_version: payload.template_version || 'v1.0',
      pod_id: String(pod.pod_id || '').trim(),
      location_id: String(pod.location_id || '').trim(),
      city: String(pod.city || '').trim(),
      cluster: String(pod.cluster || '').trim(),
      frequency: payload.frequency || 'WEEKLY',
      next_run_date: payload.next_run_date || payload.start_date || '',
      assigned_auditor: auditorName,
      assigned_auditor_email: auditorEmail,
      start_date: payload.start_date || '',
      due_date: payload.due_date || '',
      priority: payload.priority || 'MEDIUM',
      status: payload.status || 'SCHEDULED',
      end_date: payload.end_date || '',
      active: payload.active !== undefined ? payload.active : true,
      created_by: payload.created_by || 'Program Admin',
      created_at: payload.created_at || nowISO
    };
  });

  appendObjectsToSheet('schedules', rows);

  // Get the deployed Web App URL dynamically
  let appUrl = 'https://script.google.com/a/macros/external.swiggyimnet.in/s/AKfycbzuX_cWWNHvGVuzdkUYHGrPjwNwY0MWi3s4NpfLg6d6vhcE1Vm6Z89HbfiX5icd7E79cw/exec'; // Replace with your static URL as a fallback if needed
  try {
    const publishedUrl = ScriptApp.getService().getUrl();
    if (publishedUrl) appUrl = publishedUrl;
  } catch (e) {}

  if (auditorEmail && auditorEmail.indexOf('@') !== -1) {
    try {
      MailApp.sendEmail(
        auditorEmail,
        '[IM VITALS] Action Required: ' + rows.length + ' New Audit' +
          (rows.length > 1 ? 's' : '') + ' Assigned - ' + templateTitle,
        buildScheduleDigest_(auditorName, templateTitle, rows, appUrl) // Pass the URL here
      );
      Logger.log('Digest for ' + rows.length + ' schedules sent from ' +
        currentUserEmail + ' to ' + auditorEmail);
    } catch (err) {
      Logger.log('Failed to send digest to ' + auditorEmail + ': ' + err.message);
    }
  } else {
    Logger.log('Skipped email dispatch: No valid recipient email address found.');
  }

  logActivity(
    'SYSTEM',
    'schedules',
    'BATCH-' + batchStamp,
    'CREATE',
    '',
    JSON.stringify({ count: rows.length, schedule_ids: rows.map(function (r) { return r.schedule_id; }) }),
    'Scheduled "' + templateTitle + '" at ' + rows.length + ' POD(s) for ' +
      auditorName + ' (' + auditorEmail + ').'
  );

  return {
    success: true,
    count: rows.length,
    schedule_ids: rows.map(function (r) { return r.schedule_id; }),
    email_sent_to: auditorEmail
  };
}

function buildScheduleDigest_(auditorName, templateTitle, rows, appUrl) {
  const first = rows[0];

  const byCity = {};
  rows.forEach(function (r) {
    const k = (r.cluster || '-') + ' / ' + (r.city || '-');
    if (!byCity[k]) byCity[k] = [];
    byCity[k].push(r);
  });

  let body =
    'Hello ' + auditorName + ',\n\n' +
    'You have been assigned ' + rows.length + ' audit' + (rows.length > 1 ? 's' : '') +
    ' on IM VITALS.\n\n' +
    'Audit Task Overview:\n' +
    '--------------------------------------------------\n' +
    '• Standard Title: ' + templateTitle + '\n' +
    '• Recurrence:     ' + first.frequency + '\n' +
    '• Priority:       ' + first.priority + '\n' +
    '• Start Date:     ' + first.start_date + '\n' +
    '• Due Date:       ' + first.due_date + '\n' +
    '• POD Count:      ' + rows.length + '\n' +
    '--------------------------------------------------\n\n' +
    'Assigned PODs:\n';

  Object.keys(byCity).sort().forEach(function (k) {
    body += '\n' + k + ' (' + byCity[k].length + ')\n';
    byCity[k].forEach(function (r) {
      body += '  - ' + r.location_id +
        (r.pod_id ? ' [' + r.pod_id + ']' : '') +
        '  → ' + r.schedule_id + '\n';
    });
  });

  // Inject the URL right before the footer
  body += '\nPerform Audit / Access Application Link:\n' + appUrl + '?page=audits\n';

  body += '\nPlease log in to IM VITALS to complete these inspections prior to ' +
    first.due_date + '.\n\nSent via IM VITALS Operations Engine\n';

  return body;
}


/**
 * API: Deletes a schedule by schedule_id.
 */
function apiDeleteSchedule(scheduleId) {
  if (!scheduleId) throw new Error("Schedule ID is required for deletion.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('schedules');
  if (!sheet) throw new Error("Sheet 'schedules' not found.");

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, count: 0 };

  const headers = data[0];
  const idIndex = headers.indexOf('schedule_id');
  if (idIndex === -1) throw new Error("Missing schedule_id column in schedules sheet.");

  let deleted = false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIndex]) === String(scheduleId)) {
      sheet.deleteRow(i + 1);
      deleted = true;
      break;
    }
  }

  logActivity('SYSTEM', 'schedules', scheduleId, 'DELETE', '', '', `Deleted schedule ${scheduleId}.`);
  return { success: deleted };
}

/**
 * API: Updates an existing Schedule.
 */
function apiUpdateSchedule(scheduleData) {
  const targetId = scheduleData.schedule_id;
  if (!targetId) throw new Error("Schedule ID is required to update.");

  apiDeleteSchedule(targetId);
  apiCreateSchedule(scheduleData);

  logActivity('SYSTEM', 'schedules', targetId, 'UPDATE', '', JSON.stringify(scheduleData), `Updated schedule ${targetId}.`);
  return { success: true, schedule_id: targetId };
}

function apiAddUser(userData) {
  if (!userData.email) throw new Error("Email address is required.");

  const role = String(userData.role || 'AUDITOR').toUpperCase();
  const isAuditor = role === 'AUDITOR';

  const homeCluster = isAuditor ? String(userData.home_cluster || '').trim() : 'N/A';
  
  if (isAuditor && (!homeCluster || homeCluster === 'N/A')) {
    throw new Error("Home Cluster is required for Auditors.");
  }

  const additionalCluster = isAuditor 
    ? normalizeClusterCsv_(userData.additional_cluster !== undefined ? userData.additional_cluster : userData.additional_clusters, homeCluster)
    : 'N/A';

  const nowISO = new Date().toISOString();

  const row = {
    user_id: userData.user_id || ('USR-' + Date.now()),
    email: userData.email,
    full_name: userData.full_name || '',
    role: role,
    home_cluster: homeCluster,
    additional_cluster: additionalCluster,
    active: userData.active !== undefined ? userData.active : true,
    last_login_at: userData.last_login_at || '',
    created_at: userData.created_at || nowISO,
    updated_at: nowISO
  };

  appendObjectToSheet('users', row);

  logActivity(
    'SYSTEM',
    'users',
    row.user_id,
    'CREATE_USER',
    '',
    JSON.stringify(row),
    `Added new user "${row.full_name}" (${row.email}) as ${role}.`
  );

  return { success: true, user_id: row.user_id };
}

function apiUpdateUser(userData) {
  try {
    const targetId = String(userData.user_id || userData.email).trim();
    if (!targetId) throw new Error("User ID or Email is required to update.");

    const existing = sheetToObjects('users').filter(function (u) {
      return String(u.user_id || '').trim() === targetId ||
             String(u.email || '').trim().toLowerCase() === targetId.toLowerCase();
    })[0] || {};

    const role = String(userData.role || existing.role || 'AUDITOR').toUpperCase();
    const isAuditor = role === 'AUDITOR';

    let homeCluster = 'N/A';
    let additionalCluster = 'N/A';

    if (isAuditor) {
      homeCluster = String(userData.home_cluster !== undefined ? userData.home_cluster : (existing.home_cluster || '')).trim();
      let additionalRaw = userData.additional_cluster !== undefined ? userData.additional_cluster : (userData.additional_clusters !== undefined ? userData.additional_clusters : existing.additional_cluster || '');
      additionalCluster = normalizeClusterCsv_(additionalRaw, homeCluster);
    }

    apiDeleteUser(targetId);

    const nowISO = new Date().toISOString();
    const row = {
      user_id: userData.user_id || existing.user_id || targetId,
      email: userData.email || existing.email || '',
      full_name: userData.full_name || userData.name || existing.full_name || '',
      role: role,
      home_cluster: homeCluster,
      additional_cluster: additionalCluster,
      active: userData.active !== undefined ? userData.active : (existing.active !== undefined ? existing.active : true),
      last_login_at: userData.last_login_at || existing.last_login_at || '',
      created_at: userData.created_at || existing.created_at || nowISO,
      updated_at: nowISO
    };

    appendObjectToSheet('users', row);
    SpreadsheetApp.flush();

    logActivity('SYSTEM', 'users', targetId, 'UPDATE_USER', JSON.stringify(existing), JSON.stringify(row), `Updated user details for "${row.full_name || targetId}".`);
    return { success: true, user_id: targetId };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: Deletes a user from the 'users' sheet tab
 */
function apiDeleteUser(payload) {
  try {
    const targetId = String(payload.user_id || payload.email || payload).trim();
    if (!targetId) throw new Error("User ID or Email is required for deletion.");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('users');
    if (!sheet) throw new Error("Sheet 'users' not found.");

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, count: 0 };

    const headers = data[0];
    let idIndex = headers.indexOf('user_id');
    let emailIndex = headers.indexOf('email');

    if (idIndex === -1) idIndex = 0;
    if (emailIndex === -1) emailIndex = 1;

    let deleted = false;
    for (let i = data.length - 1; i >= 1; i--) {
      const rowUserId = String(data[i][idIndex]).trim();
      const rowEmail = String(data[i][emailIndex]).trim();

      if (rowUserId === targetId || rowEmail === targetId) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    SpreadsheetApp.flush();
    logActivity('SYSTEM', 'users', targetId, 'DELETE_USER', '', '', `Deleted user ${targetId}.`);
    return { success: deleted };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: Updates an existing user in the 'users' sheet tab
 *
 * Reads the current row first so fields the caller omits (clusters, created_at,
 * role) survive the delete-then-append. apiAuthenticateUser routes every login
 * through here, so without this passthrough clusters would be wiped on sign-in.
 */
function apiUpdateUser(userData) {
  try {
    const targetId = String(userData.user_id || userData.email).trim();
    if (!targetId) throw new Error("User ID or Email is required to update.");

    const existing = sheetToObjects('users').filter(function (u) {
      return String(u.user_id || '').trim() === targetId ||
             String(u.email || '').trim().toLowerCase() === targetId.toLowerCase();
    })[0] || {};

    const homeCluster = String(
      userData.home_cluster !== undefined ? userData.home_cluster : (existing.home_cluster || '')
    ).trim();

    let additionalRaw;
    if (userData.additional_cluster !== undefined) additionalRaw = userData.additional_cluster;
    else if (userData.additional_clusters !== undefined) additionalRaw = userData.additional_clusters;
    else additionalRaw = existing.additional_cluster || '';

    apiDeleteUser(targetId);

    const nowISO = new Date().toISOString();
    const row = {
      user_id: userData.user_id || existing.user_id || targetId,
      email: userData.email || existing.email || '',
      full_name: userData.full_name || userData.name || existing.full_name || '',
      role: userData.role || existing.role || 'AUDITOR',
      home_cluster: homeCluster,
      additional_cluster: normalizeClusterCsv_(additionalRaw, homeCluster),
      active: userData.active !== undefined
        ? userData.active
        : (existing.active !== undefined ? existing.active : true),
      last_login_at: userData.last_login_at || existing.last_login_at || '',
      created_at: userData.created_at || existing.created_at || nowISO,
      updated_at: nowISO
    };

    appendObjectToSheet('users', row);
    SpreadsheetApp.flush();

    logActivity('SYSTEM', 'users', targetId, 'UPDATE_USER', JSON.stringify(existing), JSON.stringify(row), `Updated user details for "${row.full_name || targetId}".`);
    return { success: true, user_id: targetId };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function apiAuthenticateUser(payload) {
  try {
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();

    if (!name || !email) {
      return { success: false, message: "Full name and email are required." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('users');
    const nowISO = new Date().toISOString();

    if (!sheet) {
      sheet = ss.insertSheet('users');
      sheet.appendRow(['user_id', 'email', 'full_name', 'role', 'active', 'last_login_at', 'created_at', 'updated_at']);
    }

    const users = sheetToObjects('users');
    let existingUser = users.find(u => String(u.email).toLowerCase() === email);

    if (existingUser) {
      apiUpdateUser({
        ...existingUser,
        full_name: name || existingUser.full_name,
        last_login_at: nowISO
      });

      logActivity('SYSTEM', 'users', existingUser.user_id, 'LOGIN', '', '', `User "${name}" (${email}) logged in.`);

      return {
        success: true,
        user: {
          user_id: existingUser.user_id,
          name: name || existingUser.full_name,
          email: email,
          role: existingUser.role || 'AUDITOR'
        }
      };
    } else {
      const newUser = {
        user_id: 'USR-' + Date.now(),
        email: email,
        full_name: name,
        role: 'AUDITOR',
        active: true,
        last_login_at: nowISO,
        created_at: nowISO,
        updated_at: nowISO
      };

      appendObjectToSheet('users', newUser);
      logActivity('SYSTEM', 'users', newUser.user_id, 'REGISTER_LOGIN', '', '', `Registered and logged in user "${name}" (${email}).`);

      return {
        success: true,
        user: {
          user_id: newUser.user_id,
          name: name,
          email: email,
          role: newUser.role
        }
      };
    }
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: Records GPS, Barcode, Photo, and Signature metadata in the `evidence` sheet tab
 */
function apiRecordEvidence(evidenceData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('evidence');

  if (!sheet) {
    sheet = ss.insertSheet('evidence');
    const defaultHeaders = [
      'evidence_id', 'audit_id', 'action_id', 'response_id', 'question_id',
      'evidence_type', 'file_name', 'drive_file_id', 'file_url', 'mime_type',
      'original_size', 'compressed_size', 'upload_status', 'latitude', 'longitude',
      'gps_accuracy', 'gps_status', 'barcode_data', 'barcode_entry_mode',
      'signer_name', 'signer_role', 'uploaded_by', 'uploaded_at'
    ];
    sheet.appendRow(defaultHeaders);
  }

  const nowISO = new Date().toISOString();
  const evidenceRecord = {
    evidence_id: evidenceData.evidence_id || ('EVD-' + Utilities.getUuid()),
    audit_id: evidenceData.audit_id || '',
    action_id: evidenceData.action_id || '',
    response_id: evidenceData.response_id || '',
    question_id: evidenceData.question_id || '',
    evidence_type: evidenceData.evidence_type || 'PHOTO',
    file_name: evidenceData.file_name || '',
    drive_file_id: evidenceData.drive_file_id || '',
    file_url: evidenceData.file_url || '',
    mime_type: evidenceData.mime_type || '',
    original_size: evidenceData.original_size || '',
    compressed_size: evidenceData.compressed_size || '',
    upload_status: evidenceData.upload_status || 'COMPLETED',
    latitude: evidenceData.latitude || '',
    longitude: evidenceData.longitude || '',
    gps_accuracy: evidenceData.gps_accuracy || '',
    gps_status: evidenceData.gps_status || 'LOCATION_CAPTURED',
    barcode_data: evidenceData.barcode_data || '',
    barcode_entry_mode: evidenceData.barcode_entry_mode || 'CAMERA_SCAN',
    signer_name: evidenceData.signer_name || '',
    signer_role: evidenceData.signer_role || '',
    uploaded_by: evidenceData.uploaded_by || Session.getActiveUser().getEmail() || 'Auditor',
    uploaded_at: nowISO
  };

  appendObjectToSheet('evidence', evidenceRecord);

  logActivity(
    'SYSTEM',
    'evidence',
    evidenceRecord.evidence_id,
    'CREATE_EVIDENCE',
    '',
    JSON.stringify(evidenceRecord),
    `Recorded ${evidenceRecord.evidence_type} evidence for question ${evidenceRecord.question_id}.`
  );

  return { success: true, evidence_id: evidenceRecord.evidence_id };
}


/* ==========================================================================
 * AUDITOR SIDE
 * ========================================================================== */

// MATCHING IMAGE_5a6deb.png EXACTLY
const AUDIT_HEADERS = [
  'audit_id', 'schedule_id', 'template_id', 'template_version', 'location_id',
  'auditor_id', 'reviwer_id', 'reviewed_at', 'review_comment', 'priority',
  'status', 'scheduled_date', 'started_at', 'due_date', 'total_score',
  'max_score', 'rating', 'critical_feature', 'result', 'summary',
  'created_by', 'created_at', 'updated_at', 'template_name', 'auditor_name',
  'auditor_email', 'submitted_at', 'total_questions', 'answered_questions',
  'na_count', 'score_percent', 'failure_count', 'critical_failures',
  'city', 'cluster'
];

// MATCHING IMAGE_5a6d8d.png EXACTLY
const RESPONSE_HEADERS = [
  'response_id', 'audit_id', 'template_id', 'section_id', 'section_name',
  'question_id', 'question_text', 'response_type', 'response_value', 'is_na',
  'score', 'max_score', 'is_failure', 'critical_question', 'risk_category',
  'comment', 'evidence_count', 'evidence_urls', 'answered_by', 'answered_at'
];

const ACTION_HEADERS = [
  'action_id', 'audit_id', 'response_id', 'question_id', 'question_text',
  'location_id', 'title', 'description', 'priority', 'risk_category',
  'status', 'owner_email', 'due_date', 'created_by', 'created_at', 'updated_at'
];

const DRAFT_HEADERS = ['audit_id', 'schedule_id', 'auditor_email', 'draft_json', 'updated_at'];

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function updateRowByKey_(sheetName, keyColumn, keyValue, updates) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const headers = data[0].map(String);
  const keyIdx = headers.indexOf(keyColumn);
  if (keyIdx === -1) return false;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyValue)) {
      const row = data[i].slice();
      Object.keys(updates).forEach(function (k) {
        const c = headers.indexOf(k);
        if (c !== -1) row[c] = updates[k];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return true;
    }
  }
  return false;
}

function appendObjectsToSheet_(sheetName, headers, objects) {
  if (!objects || !objects.length) return 0;

  const sheet = ensureSheet_(sheetName, headers);
  const sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);

  const rows = objects.map(function (obj) {
    return sheetHeaders.map(function (h) {
      return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
    });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, sheetHeaders.length).setValues(rows);
  return rows.length;
}

function isOverdue_(dueDate) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

const NEGATIVE_VALUES_ = ['NO', 'FAIL', 'FAILED', 'NON_COMPLIANT', 'NOT_OK', 'ABSENT', 'FALSE', 'MISSING', 'REJECTED'];

function normToken_(v) {
  return String(v === undefined || v === null ? '' : v).trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function parseBool_(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

function safeJson_(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function optionScoreMap_(question) {
  const map = {};
  const scoreMap = safeJson_(question.score_map_json, null);
  if (scoreMap && typeof scoreMap === 'object' && !(scoreMap instanceof Array)) {
    Object.keys(scoreMap).forEach(function (k) { map[normToken_(k)] = Number(scoreMap[k]); });
  }
  const opts = safeJson_(question.options_json, null);
  if (opts instanceof Array) {
    opts.forEach(function (o) {
      if (o && typeof o === 'object' && o.score !== undefined) {
        map[normToken_(o.value !== undefined ? o.value : o.label)] = Number(o.score);
      }
    });
  }
  return map;
}

function isNegativeValue_(question, value) {
  const token = normToken_(value);
  if (!token) return false;

  const type = normToken_(question.response_type);
  if (type === 'RATING' || type === 'SCALE' || type === 'SCALE_1_5' || type === 'SCALE_1_10' || type === 'STAR_RATING') {
    const max = type === 'SCALE_1_10' ? 10 : (Number(question.scale_max) || 5);
    const n = Number(value);
    return n > 0 && n <= Math.ceil(max / 2);
  }

  return NEGATIVE_VALUES_.indexOf(token) !== -1;
}

function auditEngineScore_(question, answer) {
  const max = Number(question.max_score) || Number(question.points) || 0;
  const scored = question.scored === undefined || question.scored === '' ? true : parseBool_(question.scored);
  const blank = { score: 0, max: 0, counted: false, failure: false, critical: false };

  const hasValue = answer && (answer.na === true ||
    (answer.value instanceof Array ? answer.value.length > 0
      : answer.value !== undefined && answer.value !== null && String(answer.value).trim() !== ''));

  if (!hasValue) return blank;
  if (answer.na === true) return blank;

  const failure = isNegativeValue_(question, answer.value instanceof Array ? answer.value.join(',') : answer.value);
  const critical = failure && parseBool_(question.critical_question);

  if (!scored || max <= 0) {
    return { score: 0, max: 0, counted: false, failure: failure, critical: critical };
  }

  const type = normToken_(question.response_type);
  let score = max;

  if (type === 'RATING' || type === 'SCALE' || type === 'SCALE_1_5' || type === 'SCALE_1_10' || type === 'STAR_RATING') {
    const scaleMax = type === 'SCALE_1_10' ? 10 : (Number(question.scale_max) || 5);
    score = Math.round((Number(answer.value) / scaleMax) * max * 100) / 100;
  } else {
    const map = optionScoreMap_(question);
    const token = normToken_(answer.value instanceof Array ? answer.value.join(',') : answer.value);
    if (map[token] !== undefined && !isNaN(map[token])) {
      score = map[token];
    } else if (failure) {
      score = 0;
    }
  }

  return { score: score, max: max, counted: true, failure: failure, critical: critical };
}

/* -------------------------------------------------------------------------
 * Auditor data loader
 * ----------------------------------------------------------------------- */

/**
 * Everything the auditor workspace needs: their schedule assignments,
 * the full checklist templates, and their own submitted audits.
 */
function getAuditorData(payload) {
  payload = payload || {};

  const email = String(payload.email || Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const name = String(payload.name || '').trim().toLowerCase();
  
  // Capture user ID to ensure accurate row matching for drafts
  const userId = String(payload.user_id || '').trim();

  ensureSheet_('audits', AUDIT_HEADERS);
  ensureSheet_('response', RESPONSE_HEADERS);
  ensureSheet_('audit_drafts', DRAFT_HEADERS);

  const templates = getTemplatesGrouped();
  const allSchedules = sheetToObjects('schedules');
  const allAudits = sheetToObjects('audits');

  // Resolve the signed-in user's row so we know which clusters they cover
  const me = sheetToObjects('users').filter(function (u) {
    return String(u.email || '').trim().toLowerCase() === email ||
           (userId && String(u.user_id || '').trim() === userId);
  })[0] || {};

  const myClusters = userClusters_(me);
  const allLocations = getLocationsList();
  const scopedLocations = locationsForClusters_(allLocations, myClusters);

  const podByName = {};
  allLocations.forEach(function (l) {
    podByName[String(l.location_id).toLowerCase()] = l;
  });

  // Checks email, name, AND user_id (Column F) to find existing drafts
  const myAudits = allAudits.filter(function (a) {
    const auditEmail = String(a.auditor_email || '').trim().toLowerCase();
    const auditName = String(a.auditor_name || '').trim().toLowerCase();
    const auditUserId = String(a.auditor_id || '').trim();
    
    return (auditEmail === email) || (auditName === email) || (userId && auditUserId === userId);
  });

  const mySchedules = allSchedules.filter(function (s) {
    if (String(s.active).toLowerCase() === 'false') return false;
    const scheduleEmail = String(s.assigned_auditor_email || '').trim().toLowerCase();
    const scheduleName = String(s.assigned_auditor || '').trim().toLowerCase();
    return (scheduleEmail && scheduleEmail === email) || (name && scheduleName === name);
  });

  const assignments = mySchedules.map(function (s) {
    const template = templates.filter(function (t) {
      return String(t.template_id) === String(s.template_id) || String(t.template_code) === String(s.template_id);
    })[0];

    const related = myAudits.filter(function (a) {
      return String(a.schedule_id) === String(s.schedule_id);
    });

    const open = related.filter(function (a) {
      const st = normToken_(a.status);
      return st === 'IN_PROGRESS' || st === 'DRAFT';
    })[0];

    const submitted = related.filter(function (a) {
      const st = normToken_(a.status);
      return st === 'SUBMITTED' || st === 'COMPLETED' || st === 'APPROVED';
    });

    let auditStatus = 'NOT_STARTED';
    if (open) auditStatus = 'IN_PROGRESS';
    else if (submitted.length) auditStatus = 'SUBMITTED';

    // Back-fill cluster/city for rows written before those columns existed
    const pod = podByName[String(s.location_id || '').trim().toLowerCase()];

    return {
      schedule_id: s.schedule_id,
      template_id: s.template_id,
      template_name: s.template_name || (template ? template.template_name : s.template_id),
      template_version: s.template_version || (template ? template.template_version : 'v1.0'),
      pod_id: s.pod_id || (pod ? pod.pod_id : ''),
      location_id: s.location_id || 'All Locations',
      city: s.city || (pod ? pod.city : ''),
      cluster: s.cluster || (pod ? pod.cluster : ''),
      frequency: s.frequency || 'ONE_TIME',
      start_date: s.start_date || '',
      due_date: s.due_date || '',
      next_run_date: s.next_run_date || '',
      priority: s.priority || 'MEDIUM',
      questions_count: template ? template.questions_count : 0,
      sections_count: template ? template.sections_count : 0,
      estimated_minutes: template ? template.estimated_minutes : 0,
      audit_status: auditStatus,
      open_audit_id: open ? open.audit_id : '',
      submission_count: submitted.length,
      last_submitted_at: submitted.length ? submitted[submitted.length - 1].submitted_at : '',
      is_overdue: isOverdue_(s.due_date) && auditStatus !== 'SUBMITTED'
    };
  });

  return {
    user: {
      email: email,
      name: payload.name || '',
      user_id: me.user_id || userId,
      home_cluster: me.home_cluster || '',
      additional_cluster: me.additional_cluster || '',
      clusters: myClusters
    },
    assignments: assignments,
    templates: templates,
    audits: myAudits,
    clusters: myClusters,
    // Auditors only see PODs inside their clusters (all PODs if unmapped)
    locations: scopedLocations
  };
}

/* -------------------------------------------------------------------------
 * Draft persistence
 * ----------------------------------------------------------------------- */

function readAuditDraft_(auditId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('audit_drafts');
  if (!sheet || sheet.getLastRow() <= 1) return {};

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const idIdx = headers.indexOf('audit_id');
  const jsonIdx = headers.indexOf('draft_json');
  if (idIdx === -1 || jsonIdx === -1) return {};

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(auditId)) {
      return safeJson_(data[i][jsonIdx], {});
    }
  }
  return {};
}

function deleteAuditDraft_(auditId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('audit_drafts');
  if (!sheet || sheet.getLastRow() <= 1) return;

  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].map(String).indexOf('audit_id');
  if (idIdx === -1) return;

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIdx]) === String(auditId)) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * API: Autosaves the auditor's in-progress answers.
 */
function apiSaveAuditProgress(payload) {
  try {
    if (!payload || !payload.audit_id) throw new Error('audit_id is required.');

    const sheet = ensureSheet_('audit_drafts', DRAFT_HEADERS);
    const nowISO = new Date().toISOString();
    const draftJson = JSON.stringify(payload.answers || {});

    const updated = updateRowByKey_('audit_drafts', 'audit_id', payload.audit_id, {
      schedule_id: payload.schedule_id || '',
      auditor_email: payload.auditor_email || '',
      draft_json: draftJson,
      updated_at: nowISO
    });

    if (!updated) {
      appendObjectToSheet('audit_drafts', {
        audit_id: payload.audit_id,
        schedule_id: payload.schedule_id || '',
        auditor_email: payload.auditor_email || '',
        draft_json: draftJson,
        updated_at: nowISO
      });
    }

    updateRowByKey_('audits', 'audit_id', payload.audit_id, { updated_at: nowISO });

    return { success: true, saved_at: nowISO };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/* -------------------------------------------------------------------------
 * Start / submit
 * ----------------------------------------------------------------------- */

/**
 * API: Opens an audit. Resumes the existing IN_PROGRESS row (returning its
 * saved draft) or creates a fresh audit row.
 */
/**
 * API: Opens an audit. Resumes the existing IN_PROGRESS row (returning its
 * saved draft) or creates a fresh audit row.
 */
function apiStartAudit(payload) {
  try {
    payload = payload || {};
    if (!payload.schedule_id && !payload.template_id) {
      throw new Error('schedule_id or template_id is required.');
    }

    ensureSheet_('audits', AUDIT_HEADERS);
    ensureSheet_('audit_drafts', DRAFT_HEADERS);

    const nowISO = new Date().toISOString();
    const existingId = String(payload.audit_id || '').trim();
    const scheduleId = String(payload.schedule_id || '').trim();
    const auditorEmail = String(payload.auditor_email || '').trim().toLowerCase();

    const allAudits = sheetToObjects('audits');
    let found = null;

    // 1. Try to find by explicit audit_id first
    if (existingId) {
      found = allAudits.filter(function (a) {
        return String(a.audit_id) === existingId;
      })[0];
    }

    // 2. CRITICAL FIX: If no audit_id was passed, check if this schedule ALREADY has an open audit
    if (!found && scheduleId) {
      found = allAudits.filter(function (a) {
        return String(a.schedule_id) === scheduleId && 
               String(a.auditor_email || '').trim().toLowerCase() === auditorEmail &&
               normToken_(a.status) === 'IN_PROGRESS';
      })[0];
    }

    // 3. If we found an IN_PROGRESS audit, RESUME IT!
    if (found && normToken_(found.status) === 'IN_PROGRESS') {
      const targetAuditId = found.audit_id;
      updateRowByKey_('audits', 'audit_id', targetAuditId, { updated_at: nowISO });
      return {
        success: true,
        audit_id: targetAuditId,
        resumed: true,
        draft: readAuditDraft_(targetAuditId)
      };
    }

    // 4. Otherwise, generate a brand new audit record
    const auditId = 'AUD-' + Date.now();

    appendObjectToSheet('audits', {
      audit_id: auditId,
      schedule_id: payload.schedule_id || '',
      template_id: payload.template_id || '',
      template_name: payload.template_name || '',
      template_version: payload.template_version || 'v1.0',
      location_id: payload.location_id || 'All Locations',
      city: payload.city || '',
      cluster: payload.cluster || '',
      auditor_id: payload.auditor_id || '',
      auditor_name: payload.auditor_name || '',
      auditor_email: String(payload.auditor_email || '').trim().toLowerCase(),
      status: 'IN_PROGRESS',
      priority: payload.priority || 'MEDIUM',
      due_date: payload.due_date || '',
      started_at: nowISO,
      submitted_at: '',
      total_questions: Number(payload.total_questions) || 0,
      answered_questions: 0,
      na_count: 0,
      total_score: 0,
      max_score: 0,
      score_percent: 0,
      failure_count: 0,
      critical_failures: 0,
      created_at: nowISO,
      updated_at: nowISO
    });

    // Flush added here to prevent duplicate "ghost" row caching issues!
    SpreadsheetApp.flush(); 

    logActivity(
      payload.auditor_email || 'AUDITOR',
      'audits',
      auditId,
      'START_AUDIT',
      '',
      '',
      'Started audit "' + (payload.template_name || payload.template_id) + '" at ' + (payload.location_id || 'All Locations') + '.'
    );

    return { success: true, audit_id: auditId, resumed: false, draft: {} };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: Submits a completed audit — writes one `response` row per question,
 * finalises the `audits` row, and raises `actions` for critical failures.
 */
function apiSubmitAudit(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    payload = payload || {};
    const auditId = String(payload.audit_id || '').trim();
    if (!auditId) throw new Error('audit_id is required.');

    const answers = payload.answers || {};
    const summary = payload.summary || {}; // Calculated and sent from React
    const nowISO = new Date().toISOString();
    const auditorEmail = String(payload.auditor_email || '').trim().toLowerCase();

    const template = getTemplatesGrouped().filter(function (t) {
      return String(t.template_id) === String(payload.template_id) ||
             String(t.template_code) === String(payload.template_id);
    })[0];

    if (!template) throw new Error('Template ' + payload.template_id + ' was not found.');

    const responseRows = [];
    const actionRows = [];

    let totalScore = 0;
    let maxScore = 0;
    let answered = 0;
    let totalQuestions = 0;
    let naCount = 0;
    let failureCount = 0;
    let criticalFailures = 0;

    (template.sections || []).forEach(function (section) {
      (section.questions || []).forEach(function (question) {
        totalQuestions++;

        const answer = answers[question.question_id] || {};
        const result = auditEngineScore_(question, answer);

        const rawValue = answer.value instanceof Array ? answer.value.join(', ') : (answer.value || '');
        const isNa = answer.na === true;
        const evidence = answer.evidence || [];

        if (isNa) naCount++;
        if (isNa || String(rawValue).trim() !== '') answered++;

        totalScore += result.score;
        maxScore += result.max;
        if (result.failure) failureCount++;
        if (result.critical) criticalFailures++;

        const responseId = auditId + '-R-' + question.question_id;

        responseRows.push({
          response_id: responseId,
          audit_id: auditId,
          template_id: template.template_id,
          section_id: section.section_id,
          section_name: section.section_name,
          question_id: question.question_id,
          question_text: question.question_text,
          response_type: question.response_type,
          response_value: isNa ? 'NA' : rawValue,
          is_na: isNa,
          score: result.score,
          max_score: result.max,
          is_failure: result.failure,
          critical_question: parseBool_(question.critical_question),
          risk_category: question.risk_category || 'General',
          comment: answer.comment || '',
          evidence_count: evidence.length,
          evidence_urls: evidence.map(function (e) { return e.file_url || ''; }).filter(String).join(' | '),
          answered_by: auditorEmail,
          answered_at: nowISO
        });

        const wantsAction = normToken_(question.failure_response) === 'CREATE_ACTION';
        if (result.failure && (result.critical || wantsAction)) {
          actionRows.push({
            action_id: 'ACT-' + Date.now() + '-' + actionRows.length,
            audit_id: auditId,
            response_id: responseId,
            question_id: question.question_id,
            question_text: question.question_text,
            location_id: payload.location_id || 'All Locations',
            title: (result.critical ? 'Critical failure: ' : 'Non-compliance: ') + question.question_text,
            description: answer.comment || 'Raised automatically from audit ' + auditId + '.',
            priority: result.critical ? 'CRITICAL' : (payload.priority || 'MEDIUM'),
            risk_category: question.risk_category || 'General',
            status: 'OPEN',
            owner_email: '',
            due_date: '',
            created_by: auditorEmail,
            created_at: nowISO,
            updated_at: nowISO
          });
        }
      });
    });

    const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;

    // Clear old responses and write new ones
    deleteRowsByKey_('response', 'audit_id', auditId);
    appendObjectsToSheet_('response', RESPONSE_HEADERS, responseRows);

    if (actionRows.length) {
      appendObjectsToSheet_('actions', ACTION_HEADERS, actionRows);
    }

    // Build the final Audit Row mapped exactly to the 33 columns
    const auditRowData = {
      audit_id: auditId,
      schedule_id: payload.schedule_id || '',
      template_id: template.template_id,
      template_version: payload.template_version || 'v1.0',
      location_id: payload.location_id || 'All Locations',
      city: payload.city || '',
      cluster: payload.cluster || '',
      auditor_id: payload.auditor_id || '',
      reviwer_id: '',
      reviewed_at: '',
      review_comment: '',
      priority: payload.priority || 'MEDIUM',
      status: 'SUBMITTED',
      scheduled_date: nowISO,
      started_at: payload.started_at || nowISO,
      due_date: payload.due_date || '',
      total_score: Math.round(totalScore * 100) / 100,
      max_score: Math.round(maxScore * 100) / 100,
      rating: summary.rating || '',
      critical_feature: criticalFailures,
      result: failureCount > 0 ? 'FAILED' : 'PASSED',
      summary: 'Completed',
      created_by: payload.auditor_id || '',
      created_at: payload.created_at || nowISO,
      updated_at: nowISO,
      template_name: template.template_name,
      auditor_name: payload.auditor_name || '',
      auditor_email: auditorEmail,
      submitted_at: nowISO,
      total_questions: totalQuestions,
      answered_questions: answered,
      na_count: naCount,
      score_percent: scorePercent,
      failure_count: failureCount,
      critical_failures: criticalFailures
    };

    // Remove the IN_PROGRESS row and append the SUBMITTED row perfectly formatted
    deleteRowsByKey_('audits', 'audit_id', auditId);
    appendObjectsToSheet_('audits', AUDIT_HEADERS, [auditRowData]);

    deleteAuditDraft_(auditId);
    SpreadsheetApp.flush();

    logActivity(
      auditorEmail || 'AUDITOR',
      'audits',
      auditId,
      'SUBMIT_AUDIT',
      '',
      JSON.stringify({ score_percent: scorePercent, failures: failureCount, critical: criticalFailures }),
      'Submitted audit "' + template.template_name + '" — ' + scorePercent + '% (' + failureCount + ' failures, ' + criticalFailures + ' critical).'
    );

    return {
      success: true,
      audit_id: auditId,
      score_percent: scorePercent,
      total_score: Math.round(totalScore * 100) / 100,
      max_score: Math.round(maxScore * 100) / 100,
      responses_written: responseRows.length,
      actions_created: actionRows.length
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/** Deletes every row in a sheet whose keyColumn matches keyValue. */
function deleteRowsByKey_(sheetName, keyColumn, keyValue) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return 0;

  const data = sheet.getDataRange().getValues();
  const idx = data[0].map(String).indexOf(keyColumn);
  if (idx === -1) return 0;

  let deleted = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idx]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return deleted;
}

/* -------------------------------------------------------------------------
 * Evidence upload (photos / PDFs) to Drive
 * ----------------------------------------------------------------------- */

function getEvidenceFolder_() {
  const rootName = 'IM VITALS Evidence';
  const it = DriveApp.getFoldersByName(rootName);
  return it.hasNext() ? it.next() : DriveApp.createFolder(rootName);
}

/**
 * API: Accepts a base64 payload from the browser, stores it in Drive and
 * records the metadata row via apiRecordEvidence.
 */
function apiUploadEvidence(payload) {
  try {
    payload = payload || {};
    if (!payload.base64) throw new Error('No file data received.');

    const bytes = Utilities.base64Decode(payload.base64);
    const blob = Utilities.newBlob(
      bytes,
      payload.mime_type || 'application/octet-stream',
      payload.file_name || ('evidence-' + Date.now())
    );

    const folder = getEvidenceFolder_();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);

    const recorded = apiRecordEvidence({
      audit_id: payload.audit_id || '',
      question_id: payload.question_id || '',
      response_id: payload.response_id || '',
      evidence_type: payload.evidence_type || 'PHOTO',
      file_name: file.getName(),
      drive_file_id: file.getId(),
      file_url: file.getUrl(),
      mime_type: payload.mime_type || '',
      original_size: payload.original_size || '',
      compressed_size: blob.getBytes().length,
      upload_status: 'COMPLETED',
      latitude: payload.latitude || '',
      longitude: payload.longitude || '',
      gps_accuracy: payload.gps_accuracy || '',
      barcode_data: payload.barcode_data || '',
      uploaded_by: payload.uploaded_by || ''
    });

    return {
      success: true,
      evidence_id: recorded.evidence_id,
      file_name: file.getName(),
      file_url: file.getUrl(),
      drive_file_id: file.getId()
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getAuditReport(auditId) {
  try {
    const id = String(auditId || '').trim();
    if (!id) return { success: false, message: 'audit_id is required.' };

    ensureSheet_('audits', AUDIT_HEADERS);
    ensureSheet_('response', RESPONSE_HEADERS);
    ensureSheet_('actions', ACTION_HEADERS);

    const audit = sheetToObjects('audits').filter(function (a) {
      return String(a.audit_id) === id;
    })[0];

    if (!audit) return { success: false, message: 'Audit ' + id + ' was not found.' };

    const responses = sheetToObjects('response').filter(function (r) {
      return String(r.audit_id) === id;
    });

    const actions = sheetToObjects('actions').filter(function (a) {
      return String(a.audit_id) === id;
    });

    // ---- Per-section rollup (score, failures, N/A per section) ----
    const sectionMap = {};
    responses.forEach(function (r) {
      const key = String(r.section_name || 'General');
      if (!sectionMap[key]) {
        sectionMap[key] = {
          section_id: r.section_id || '',
          section_name: key,
          questions: 0,
          score: 0,
          max_score: 0,
          failures: 0,
          na: 0
        };
      }
      const s = sectionMap[key];
      s.questions++;
      s.score += Number(r.score) || 0;
      s.max_score += Number(r.max_score) || 0;
      if (parseBool_(r.is_failure)) s.failures++;
      if (parseBool_(r.is_na)) s.na++;
    });

    const sections = Object.keys(sectionMap).map(function (k) {
      const s = sectionMap[k];
      s.score_percent = s.max_score > 0
        ? Math.round((s.score / s.max_score) * 1000) / 10
        : 0;
      return s;
    });

    return {
      success: true,
      audit: audit,
      responses: responses,
      actions: actions,
      sections: sections
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: Full report payload for one audit — header stats, per-section rollup,
 * every response, the failed items with their evidence, and corrective actions.
 */
function getAuditReport(auditId) {
  try {
    const id = String(auditId || '').trim();
    if (!id) return { success: false, message: 'audit_id is required.' };

    ensureSheet_('audits', AUDIT_HEADERS);
    ensureSheet_('response', RESPONSE_HEADERS);
    ensureSheet_('actions', ACTION_HEADERS);

    const audit = sheetToObjects('audits').filter(function (a) {
      return String(a.audit_id) === id;
    })[0];

    if (!audit) return { success: false, message: 'Audit ' + id + ' was not found.' };

    const responses = sheetToObjects('response').filter(function (r) {
      return String(r.audit_id) === id;
    });

    const actions = sheetToObjects('actions').filter(function (a) {
      return String(a.audit_id) === id;
    });

    // ---- Evidence captured during this audit ----
    const evidence = sheetToObjects('evidence')
      .filter(function (e) { return String(e.audit_id) === id; })
      .map(function (e) {
        return {
          evidence_id: e.evidence_id,
          question_id: e.question_id,
          response_id: e.response_id,
          evidence_type: e.evidence_type || 'PHOTO',
          file_name: e.file_name || '',
          file_url: e.file_url || '',
          drive_file_id: e.drive_file_id || '',
          thumbnail_url: e.drive_file_id
            ? 'https://drive.google.com/thumbnail?id=' + e.drive_file_id + '&sz=w400'
            : '',
          mime_type: e.mime_type || '',
          latitude: e.latitude || '',
          longitude: e.longitude || '',
          barcode_data: e.barcode_data || '',
          uploaded_at: e.uploaded_at || ''
        };
      });

    // Photos are uploaded DURING the audit, so they carry question_id but no
    // response_id — match on question_id first, then fall back to the
    // pipe-joined urls already stored on the response row.
    responses.forEach(function (r) {
      r.evidence = evidence.filter(function (e) {
        return String(e.question_id) === String(r.question_id) ||
               (e.response_id && String(e.response_id) === String(r.response_id));
      });

      if (!r.evidence.length && r.evidence_urls) {
        r.evidence = String(r.evidence_urls).split('|')
          .map(function (u) { return u.trim(); })
          .filter(String)
          .map(function (u, i) {
            return {
              evidence_id: r.response_id + '-E' + i,
              question_id: r.question_id,
              file_url: u,
              thumbnail_url: '',
              evidence_type: 'PHOTO',
              file_name: 'Evidence ' + (i + 1)
            };
          });
      }
    });

    // ---- Failed items, critical first — powers "Failed Items & Evidence" ----
    const failedItems = responses
      .filter(function (r) { return parseBool_(r.is_failure); })
      .sort(function (a, b) {
        return (parseBool_(b.critical_question) ? 1 : 0) -
               (parseBool_(a.critical_question) ? 1 : 0);
      });

    // ---- Per-section rollup (score, failures, N/A per section) ----
    const sectionMap = {};
    responses.forEach(function (r) {
      const key = String(r.section_name || 'General');
      if (!sectionMap[key]) {
        sectionMap[key] = {
          section_id: r.section_id || '',
          section_name: key,
          questions: 0,
          score: 0,
          max_score: 0,
          failures: 0,
          na: 0
        };
      }
      const s = sectionMap[key];
      s.questions++;
      s.score += Number(r.score) || 0;
      s.max_score += Number(r.max_score) || 0;
      if (parseBool_(r.is_failure)) s.failures++;
      if (parseBool_(r.is_na)) s.na++;
    });

    const sections = Object.keys(sectionMap).map(function (k) {
      const s = sectionMap[k];
      s.score_percent = s.max_score > 0
        ? Math.round((s.score / s.max_score) * 1000) / 10
        : 0;
      return s;
    });

    return {
      success: true,
      audit: audit,
      responses: responses,
      actions: actions,
      sections: sections,
      evidence: evidence,
      failed_items: failedItems,
      review: {
        status: String(audit.status || 'SUBMITTED').toUpperCase(),
        reviewer_id: audit.reviwer_id || '',
        reviewed_at: audit.reviewed_at || '',
        review_comment: audit.review_comment || ''
      }
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: Reviewer decision on a submitted audit — APPROVED / REJECTED.
 */
function apiReviewAudit(payload) {
  try {
    payload = payload || {};
    const auditId = String(payload.audit_id || '').trim();
    const decision = normToken_(payload.decision);

    if (!auditId) throw new Error('audit_id is required.');
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new Error('decision must be APPROVED or REJECTED.');
    }

    ensureSheet_('audits', AUDIT_HEADERS);
    const nowISO = new Date().toISOString();

    const updated = updateRowByKey_('audits', 'audit_id', auditId, {
      status: decision,
      reviwer_id: payload.reviewer_id || payload.reviewer_email || '',
      reviewed_at: nowISO,
      review_comment: payload.comment || '',
      updated_at: nowISO
    });

    if (!updated) throw new Error('Audit ' + auditId + ' was not found.');
    SpreadsheetApp.flush();

    logActivity(
      payload.reviewer_email || 'REVIEWER',
      'audits',
      auditId,
      'REVIEW_AUDIT',
      '',
      decision,
      'Audit ' + auditId + ' marked ' + decision + '.'
    );

    return { success: true, audit_id: auditId, status: decision, reviewed_at: nowISO };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * API: "Track these findings" — raises `actions` rows for failed responses that
 * do not already have one. Idempotent: re-clicking creates nothing new.
 */
function apiTrackFindings(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    payload = payload || {};
    const auditId = String(payload.audit_id || '').trim();
    if (!auditId) throw new Error('audit_id is required.');

    ensureSheet_('actions', ACTION_HEADERS);

    const wanted = (payload.response_ids || []).map(String);
    const responses = sheetToObjects('response').filter(function (r) {
      if (String(r.audit_id) !== auditId) return false;
      if (!parseBool_(r.is_failure)) return false;
      return wanted.length ? wanted.indexOf(String(r.response_id)) !== -1 : true;
    });

    const existing = sheetToObjects('actions')
      .filter(function (a) { return String(a.audit_id) === auditId; })
      .map(function (a) { return String(a.response_id); });

    const audit = sheetToObjects('audits').filter(function (a) {
      return String(a.audit_id) === auditId;
    })[0] || {};

    const nowISO = new Date().toISOString();
    const rows = [];

    responses.forEach(function (r) {
      if (existing.indexOf(String(r.response_id)) !== -1) return;
      const critical = parseBool_(r.critical_question);

      rows.push({
        action_id: 'ACT-' + Date.now() + '-' + rows.length,
        audit_id: auditId,
        response_id: r.response_id,
        question_id: r.question_id,
        question_text: r.question_text,
        location_id: audit.location_id || 'All Locations',
        title: (critical ? 'Critical failure: ' : 'Non-compliance: ') + r.question_text,
        description: r.comment || 'Tracked from audit report ' + auditId + '.',
        priority: critical ? 'CRITICAL' : (payload.priority || 'MEDIUM'),
        risk_category: r.risk_category || 'General',
        status: 'OPEN',
        owner_email: payload.owner_email || audit.auditor_email || '',
        due_date: payload.due_date || '',
        created_by: payload.created_by || '',
        created_at: nowISO,
        updated_at: nowISO
      });
    });

    if (rows.length) appendObjectsToSheet_('actions', ACTION_HEADERS, rows);
    SpreadsheetApp.flush();

    logActivity(
      payload.created_by || 'SYSTEM',
      'actions',
      auditId,
      'TRACK_FINDINGS',
      '',
      String(rows.length),
      'Tracked ' + rows.length + ' finding(s) from audit ' + auditId + '.'
    );

    return {
      success: true,
      actions_created: rows.length,
      skipped: responses.length - rows.length
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * ===========================================================================
 * DASHBOARD API — Aggregated statistics for the dedicated Dashboard page
 * ===========================================================================
 */

/**
 * API: Returns dashboard statistics scoped to a single auditor.
 * Called from React via google.script.run.getAuditorDashboardData({email, user_id})
 */
function getAuditorDashboardData(payload) {
  payload = payload || {};
  var email = String(payload.email || '').trim().toLowerCase();
  var userId = String(payload.user_id || '').trim();

  var allAudits = sheetToObjects('audits');
  var allResponses = sheetToObjects('response');
  var allActions = sheetToObjects('actions');
  var templates = getTemplatesGrouped();

  // Filter to this auditor's audits
  var myAudits = allAudits.filter(function (a) {
    var auditEmail = String(a.auditor_email || '').trim().toLowerCase();
    var auditUid = String(a.auditor_id || '').trim();
    return (email && auditEmail === email) || (userId && auditUid === userId);
  });

  var myAuditIds = myAudits.map(function (a) { return String(a.audit_id); });

  // Filter responses to this auditor's audits
  var myResponses = allResponses.filter(function (r) {
    return myAuditIds.indexOf(String(r.audit_id)) !== -1;
  });

  // Filter actions to this auditor's audits
  var myActions = allActions.filter(function (a) {
    return myAuditIds.indexOf(String(a.audit_id)) !== -1;
  });

  var submitted = myAudits.filter(function (a) {
    var s = normToken_(a.status);
    return s === 'SUBMITTED' || s === 'APPROVED' || s === 'COMPLETED';
  });
  var inProgress = myAudits.filter(function (a) { return normToken_(a.status) === 'IN_PROGRESS'; });
  var passed = submitted.filter(function (a) { return normToken_(a.result) === 'PASSED'; });
  var failed = submitted.filter(function (a) { return normToken_(a.result) === 'FAILED'; });

  var avgScore = 0;
  if (submitted.length > 0) {
    avgScore = Math.round(
      submitted.reduce(function (s, a) { return s + (Number(a.score_percent) || 0); }, 0)
      / submitted.length * 10
    ) / 10;
  }

  var passRate = submitted.length > 0 ? Math.round((passed.length / submitted.length) * 1000) / 10 : 0;

  var openActions = myActions.filter(function (a) { return normToken_(a.status) === 'OPEN'; });

  // Score distribution
  var scoreBuckets = [
    { range: '0–20%', count: 0, color: '#ef4444' },
    { range: '21–40%', count: 0, color: '#f97316' },
    { range: '41–60%', count: 0, color: '#f59e0b' },
    { range: '61–80%', count: 0, color: '#84cc16' },
    { range: '81–100%', count: 0, color: '#10b981' }
  ];
  submitted.forEach(function (a) {
    var pct = Number(a.score_percent) || 0;
    if (pct <= 20) scoreBuckets[0].count++;
    else if (pct <= 40) scoreBuckets[1].count++;
    else if (pct <= 60) scoreBuckets[2].count++;
    else if (pct <= 80) scoreBuckets[3].count++;
    else scoreBuckets[4].count++;
  });

  // Pass/Fail
  var passFail = [
    { label: 'Passed', count: passed.length, color: '#10b981' },
    { label: 'Failed', count: failed.length, color: '#ef4444' }
  ];

  // Status breakdown
  var statusMap = {};
  myAudits.forEach(function (a) {
    var st = normToken_(a.status) || 'UNKNOWN';
    statusMap[st] = (statusMap[st] || 0) + 1;
  });
  var statusColors = { SUBMITTED: '#10b981', IN_PROGRESS: '#f59e0b', APPROVED: '#3b82f6', REJECTED: '#ef4444', COMPLETED: '#8b5cf6', DRAFT: '#94a3b8', UNKNOWN: '#cbd5e1' };
  var statusBreakdown = Object.keys(statusMap).map(function (k) {
    return { label: k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }), count: statusMap[k], color: statusColors[k] || '#94a3b8' };
  });

  // By location
  var locMap = {};
  submitted.forEach(function (a) {
    var loc = a.location_id || 'Unknown';
    if (!locMap[loc]) locMap[loc] = { count: 0, sum: 0, failures: 0 };
    locMap[loc].count++;
    locMap[loc].sum += Number(a.score_percent) || 0;
    if (normToken_(a.result) === 'FAILED') locMap[loc].failures++;
  });
  var byLocation = Object.keys(locMap).map(function (loc) {
    return { location: loc, avgScore: Math.round(locMap[loc].sum / locMap[loc].count * 10) / 10, auditCount: locMap[loc].count, failures: locMap[loc].failures };
  }).sort(function (a, b) { return b.auditCount - a.auditCount; });

  // By template
  var tmplMap = {};
  submitted.forEach(function (a) {
    var tmpl = templates.filter(function (t) { return String(t.template_id) === String(a.template_id); })[0];
    var name = a.template_name || (tmpl ? tmpl.template_name : 'Unknown');
    if (!tmplMap[name]) tmplMap[name] = { count: 0, sum: 0, failures: 0 };
    tmplMap[name].count++;
    tmplMap[name].sum += Number(a.score_percent) || 0;
    if (normToken_(a.result) === 'FAILED') tmplMap[name].failures++;
  });
  var byTemplate = Object.keys(tmplMap).map(function (name) {
    return { template: name, avgScore: Math.round(tmplMap[name].sum / tmplMap[name].count * 10) / 10, auditCount: tmplMap[name].count, failures: tmplMap[name].failures };
  }).sort(function (a, b) { return b.auditCount - a.auditCount; });

  // Risk distribution
  var riskMap = {};
  myResponses.forEach(function (r) {
    if (parseBool_(r.is_failure)) {
      var risk = r.risk_category || 'General';
      riskMap[risk] = (riskMap[risk] || 0) + 1;
    }
  });
  var riskDistribution = Object.keys(riskMap).map(function (risk) {
    return { risk: risk, count: riskMap[risk] };
  }).sort(function (a, b) { return b.count - a.count; });

  // Recent audits
  var recentAudits = submitted
    .map(function (a) {
      return {
        audit_id: a.audit_id,
        template_name: a.template_name || '',
        location_id: a.location_id || '—',
        score_percent: Number(a.score_percent) || 0,
        result: normToken_(a.result) || '—',
        rating: a.rating || '—',
        failure_count: Number(a.failure_count) || 0,
        critical_failures: Number(a.critical_failures) || 0,
        submitted_at: a.submitted_at || ''
      };
    })
    .sort(function (a, b) { return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(); })
    .slice(0, 10);

  // Activity timeline (14 days)
  var now = new Date();
  var days = [];
  for (var d = 13; d >= 0; d--) {
    var day = new Date(now);
    day.setDate(day.getDate() - d);
    var dayStr = day.toISOString().split('T')[0];
    var dayLabel = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var count = 0;
    submitted.forEach(function (a) {
      var sd = a.submitted_at ? new Date(a.submitted_at) : null;
      if (sd && sd.toISOString().split('T')[0] === dayStr) count++;
    });
    days.push({ date: dayLabel, count: count });
  }

  // Rating distribution
  var ratingMap = {};
  submitted.forEach(function (a) {
    var r = a.rating || 'Unrated';
    if (r === '—' || !r) r = 'Unrated';
    ratingMap[r] = (ratingMap[r] || 0) + 1;
  });
  var ratingDistribution = Object.keys(ratingMap).map(function (k) {
    return { rating: k, count: ratingMap[k] };
  });

  return {
    kpis: {
      totalAudits: myAudits.length,
      submittedCount: submitted.length,
      inProgressCount: inProgress.length,
      passedCount: passed.length,
      failedCount: failed.length,
      avgScore: avgScore,
      passRate: passRate,
      openActionsCount: openActions.length,
      complianceScore: avgScore
    },
    scoreDistribution: scoreBuckets,
    statusBreakdown: statusBreakdown,
    passFail: passFail,
    byLocation: byLocation,
    byTemplate: byTemplate,
    riskDistribution: riskDistribution,
    recentAudits: recentAudits,
    ratingDistribution: ratingDistribution,
    activityTimeline: days
  };
}