export function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

export function isNegativeAnswer(question, value) {
  const token = String(value || '').trim().toUpperCase();
  return ['NO', 'FAIL', 'FAILED', 'NON_COMPLIANT', 'ABSENT', 'REJECTED'].includes(token);
}

export function getComplianceRating(percent, hasCritical) {
  if (hasCritical) return 'CRITICAL';
  if (percent >= 90) return 'Excellent';
  if (percent >= 80) return 'Good';
  if (percent >= 70) return 'Needs Attention';
  return 'Critical';
}

export function computeAuditScore(template, answers) {
  let totalScore = 0;
  let maxPossible = 0;
  let answeredCount = 0;
  let totalQuestions = 0;
  let naCount = 0;
  let failures = 0;
  let criticalFailures = 0;

  (template?.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      totalQuestions++;
      const ans = answers[q.question_id] || {};
      const qMax = Number(q.max_score) || Number(q.points) || 0;
      
      const hasVal = ans.na || (ans.value !== undefined && String(ans.value).trim() !== '');
      if (hasVal) answeredCount++;

      // Req 31: N/A excludes the question from the max possible score completely
      if (ans.na) {
        naCount++;
        return; 
      }

      if (!hasVal) {
        maxPossible += qMax; 
        return;
      }

      const isFail = isNegativeAnswer(q, ans.value);
      const isCritical = parseBool(q.critical_question);

      maxPossible += qMax;

      if (isFail) {
        failures++;
        if (isCritical) criticalFailures++;
      } else {
        totalScore += qMax; 
      }
    });
  });

  const percent = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

  return {
    total: totalQuestions,
    answered: answeredCount,
    naCount,
    score: totalScore,
    max: maxPossible,
    percent,
    failures,
    criticalFailures,
    rating: getComplianceRating(percent, criticalFailures > 0)
  };
}

export function validateAudit(template, answers) {
  const problems = [];
  (template?.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      const ans = answers[q.question_id] || {};
      const isReq = q.required === undefined ? true : parseBool(q.required);
      const hasVal = ans.na || (ans.value !== undefined && String(ans.value).trim() !== '');

      if (isReq && !hasVal) {
        problems.push({ question_id: q.question_id, section_name: sec.section_name, question_text: q.question_text, reason: 'Answer required' });
      }
      
      const isFail = hasVal && !ans.na && isNegativeAnswer(q, ans.value);
      const needsComment = isFail && q.comment_required !== 'NEVER';
      if (needsComment && !String(ans.comment || '').trim()) {
        problems.push({ question_id: q.question_id, section_name: sec.section_name, question_text: q.question_text, reason: 'Comment required for failure' });
      }
    });
  });
  return problems;
}

export function getInputKind(question) {
  const t = String(question.response_type || '').toUpperCase().replace(/[\s-]+/g, '_');
  
  if (t === 'YES_NO' || t === 'PASS_FAIL' || t === 'CHOICE' || t === 'SAFE_UNSAFE') return 'CHOICE';
  if (t === 'MULTI_SELECT' || t === 'MULTI') return 'MULTI';
  
  // Keep standard scales as buttons
  if (t === 'SCALE' || t === 'SCALE_1_5' || t === 'SCALE_1_10' || t === 'STAR_RATING') return 'SCALE';
  
  // NEW: Rating is treated as its own specific numeric input kind
  if (t === 'RATING') return 'RATING';
  
  if (t === 'NUMBER') return 'NUMBER';
  if (t === 'DATE') return 'DATE';
  if (t === 'LONG_TEXT' || t === 'PARAGRAPH') return 'LONG_TEXT';
  
  // Codes are scanned into the answer itself, so they get their own kind
  if (
    t === 'BARCODE' ||
    t === 'QR' ||
    t === 'QR_CODE' ||
    t === 'QRCODE' ||
    t === 'BARCODE_QR' ||
    t === 'QR_BARCODE' ||
    t === 'SCAN' ||
    t === 'SCANNER'
  ) {
    return 'SCAN';
  }
  
  if (t === 'PHOTO' || t === 'SIGNATURE' || t === 'GPS') return 'CAPTURE';
  return 'TEXT';
}

export function getResponseOptions(question) {
  const t = String(question.response_type || '').toUpperCase();
  if (t === 'YES_NO') return [{ label: 'Yes', value: 'YES' }, { label: 'No', value: 'NO', negative: true }];
  if (t === 'PASS_FAIL') return [{ label: 'Pass', value: 'PASS' }, { label: 'Fail', value: 'FAIL', negative: true }];
  if (t === 'SAFE_UNSAFE') return [{ label: 'Safe', value: 'SAFE' }, { label: 'Unsafe', value: 'UNSAFE', negative: true }];
  try {
    const parsed = JSON.parse(question.options_json || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {}
  return [];
}

export function getScaleMax(question) {
  const t = String(question.response_type || '').toUpperCase();
  if (t === 'SCALE_1_10') return 10;
  return Number(question.scale_max) || 5;
}

export function commentRequired(question, answer) {
  if (answer.na) return false;
  const req = String(question.comment_required || 'NEVER').toUpperCase();
  if (req === 'ALWAYS') return true;
  if (req === 'ON_FAILURE' && isNegativeAnswer(question, answer.value)) return true;
  return false;
}

export function evidenceRequired(question, answer) {
  if (answer.na) return false;
  const req = String(question.evidence_policy || 'OPTIONAL').toUpperCase();
  if (req === 'REQUIRED') return true;
  if (req === 'REQUIRED_ON_FAILURE' && isNegativeAnswer(question, answer.value)) return true;
  return false;
}

export function hasValue(answer) {
  if (!answer) return false;
  if (answer.na) return true;
  if (Array.isArray(answer.value)) return answer.value.length > 0;
  return answer.value !== undefined && answer.value !== null && String(answer.value).trim() !== '';
}