export const remainingSectionWeight = (sections, sectionIndex) => {
  const otherWeight = sections.reduce((total, section, index) =>
    index === sectionIndex ? total : total + (Number(section.section_weight) || 0), 0);
  return Math.max(0, Math.round((100 - otherWeight) * 100) / 100);
};

export const limitSectionWeight = (value, sections, sectionIndex) => {
  if (value === '') return '';
  const weight = Number(value);
  if (!Number.isFinite(weight)) return '';
  if (weight < 0) return '0';
  const maximum = remainingSectionWeight(sections, sectionIndex);
  return weight > maximum ? String(maximum) : value;
};
