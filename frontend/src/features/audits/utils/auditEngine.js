export function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

export function isNegativeAnswer(question, value) {
  const token = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return [
    'NO',
    'FAIL',
    'FAILED',
    'UNSAFE',
    'NON_COMPLIANT',
    'ABSENT',
    'NOT_COMPLETE',
    'INCOMPLETE',
    'REJECTED'
  ].includes(token);
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
  const sectionScores = [];

  (template?.sections || []).forEach((sec) => {
    let sectionEarned = 0;
    let sectionMax = 0;
    (sec.questions || []).forEach((q) => {
      totalQuestions++;
      const ans = answers[q.question_id] || {};
      const qMax = q.scored === undefined ? 1 : (parseBool(q.scored) ? 1 : 0);
      
      const hasVal = ans.na || (ans.value !== undefined && String(ans.value).trim() !== '');
      if (hasVal) answeredCount++;

      // Req 31: N/A excludes the question from the max possible score completely
      if (ans.na) {
        naCount++;
        return; 
      }

      if (!hasVal) {
        maxPossible += qMax; 
        sectionMax += qMax;
        return;
      }

      const isFail = isNegativeAnswer(q, ans.value);
      const isCritical = parseBool(q.critical_question);

      maxPossible += qMax;
      sectionMax += qMax;

      if (isFail) {
        failures++;
        if (isCritical) criticalFailures++;
      } else {
        totalScore += qMax; 
        sectionEarned += qMax;
      }
    });
    sectionScores.push({ earned: sectionEarned, max: sectionMax, weight: Number(sec.section_weight) });
  });

  const hasSectionWeights = sectionScores.length > 0 &&
    (template?.sections || []).every((sec) => sec.section_weight !== null && sec.section_weight !== undefined && sec.section_weight !== '') &&
    Math.abs(sectionScores.reduce((total, section) => total + section.weight, 0) - 100) < 0.01;
  const applicableWeight = sectionScores.reduce((total, section) =>
    total + (section.max > 0 ? section.weight : 0), 0);
  const percent = hasSectionWeights && applicableWeight > 0
    ? Math.round(sectionScores.reduce((total, section) =>
        total + (section.max > 0 ? (section.earned / section.max) * section.weight : 0), 0
      ) / applicableWeight * 100)
    : maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

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
  
  if (t === 'YES_NO' || t === 'PASS_FAIL' || t === 'COMPLETE_NOT_COMPLETE' || t === 'CHOICE' || t === 'SAFE_UNSAFE') return 'CHOICE';
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
  if (t === 'COMPLETE_NOT_COMPLETE') return [{ label: 'Complete', value: 'COMPLETE' }, { label: 'Not Complete', value: 'NOT_COMPLETE', negative: true }];
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
