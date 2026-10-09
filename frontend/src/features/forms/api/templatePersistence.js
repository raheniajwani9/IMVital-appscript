export const isMissingTemplateFunction = (error, functionName) => {
  const message = String(error?.message || '');
  return (error?.code === 'PGRST202' || /could not find the function/i.test(message)) &&
    message.includes(functionName);
};

const insertLegacySections = async (supabase, templateId, sections) => {
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const sectionId = `${templateId}-SEC-${sectionIndex + 1}`;
    const { error: sectionError } = await supabase.from('sections').insert({
      section_id: sectionId,
      template_id: templateId,
      section_name: section.section_name || `Section ${sectionIndex + 1}`,
      section_order: sectionIndex + 1,
      section_instructions: section.section_instructions || '',
      section_category: section.section_category || 'General',
      section_weight: Number(section.section_weight)
    });
    if (sectionError) throw sectionError;

    const questions = (section.questions || [])
      .filter((question) => question.question_text?.trim())
      .map((question, questionIndex) => ({
        question_id: `${sectionId}-Q${questionIndex + 1}`,
        template_id: templateId,
        section_id: sectionId,
        question_text: question.question_text,
        question_order: questionIndex + 1,
        response_type: question.response_type,
        required: question.is_required,
        scored: question.scored,
        max_score: question.scored === false ? 0 : 1,
        failure_response: question.failure_response,
        critical_question: question.critical_question,
        na_allowed: question.na_allowed,
        risk_category: question.risk_category,
        comment_required: question.comment_required,
        evidence_policy: question.evidence_policy
      }));

    if (questions.length) {
      const { error: questionsError } = await supabase.from('question_bank').insert(questions);
      if (questionsError) throw questionsError;
    }
  }
};

// The version-publishing RPC may not copy newly added section fields yet.
// Apply them to the current version after it creates the section rows.
export const saveCurrentSectionDetails = async (supabase, templateId, sections) => {
  const { data: template, error: templateError } = await supabase.from('templates')
    .select('current_version_id').eq('template_id', templateId).single();
  if (templateError) throw templateError;

  let query = supabase.from('sections').select('section_id, section_order')
    .eq('template_id', templateId);
  if (template.current_version_id) query = query.eq('template_version_id', template.current_version_id);
  const { data: savedSections, error: sectionsError } = await query;
  if (sectionsError) throw sectionsError;

  for (const [index, section] of sections.entries()) {
    const saved = (savedSections || []).find((row) => Number(row.section_order) === index + 1);
    if (!saved) throw new Error(`Section ${index + 1} was not saved.`);
    const { error } = await supabase.from('sections').update({
      section_category: section.section_category || 'General',
      section_weight: Number(section.section_weight)
    }).eq('section_id', saved.section_id);
    if (error) throw error;
  }
};

export const createLegacyTemplate = async (
  supabase,
  templateId,
  formData,
  creatorName
) => {
  const { error: templateError } = await supabase
    .from('templates')
    .insert({
      template_id: templateId,
      template_name: formData.template_name,
      template_category: formData.template_category,
      template_description: formData.template_description,
      template_status: 'Published',
      template_version: 'v1.0',
      estimated_minutes: Number(formData.estimated_minutes) || 15,
      active: true,
      created_by: creatorName,
      last_edited_by: creatorName
    });

  if (templateError) throw templateError;

  await insertLegacySections(supabase, templateId, formData.sections);

  const versionId = crypto.randomUUID();

  const { error: versionError } = await supabase
    .from('template_versions')
    .insert({
      id: versionId,
      template_id: templateId,
      version_number: 1,
      version_label: 'v1.0',
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
      created_by: creatorName,
      change_summary: 'Initial version',
      template_name: formData.template_name,
      template_category: formData.template_category,
      template_description: formData.template_description,
      estimated_minutes: Number(formData.estimated_minutes) || 15
    });

  if (versionError) throw versionError;

  const { error: sectionsError } = await supabase
    .from('sections')
    .update({ template_version_id: versionId })
    .eq('template_id', templateId)
    .is('template_version_id', null);

  if (sectionsError) throw sectionsError;

  const { error: questionsError } = await supabase
    .from('question_bank')
    .update({ template_version_id: versionId })
    .eq('template_id', templateId)
    .is('template_version_id', null);

  if (questionsError) throw questionsError;

  const { error: currentVersionError } = await supabase
    .from('templates')
    .update({ current_version_id: versionId })
    .eq('template_id', templateId);

  if (currentVersionError) throw currentVersionError;
};
