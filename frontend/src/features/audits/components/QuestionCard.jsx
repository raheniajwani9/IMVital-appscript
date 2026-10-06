import React, { useRef, useState } from 'react';
import {AlertTriangle,Info,Camera,Paperclip,X,Loader2,MessageSquare,Star,ScanLine} from 'lucide-react';
import ScannerModal from './ScannerModal';
import {getInputKind,getResponseOptions,getScaleMax,parseBool,commentRequired,evidenceRequired,isNegativeAnswer,hasValue
} from '../utils/auditEngine';
import { supabase } from '../../../shared/lib/supabaseClient'; 

const MAX_EVIDENCE_MB = 8;

export default function QuestionCard({
  question,
  index,
  answer = {},
  onChange,
  auditId,
  currentUser,
  invalidReason
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  const kind = getInputKind(question);
  const options = getResponseOptions(question);
  const isRequired = question.required === undefined ? true : parseBool(question.required);
  const isCritical = parseBool(question.critical_question);
  const naAllowed = parseBool(question.na_allowed);
  const needsComment = commentRequired(question, answer);
  const needsEvidence = evidenceRequired(question, answer);
  const isFail = hasValue(answer) && !answer.na && isNegativeAnswer(question, answer.value);
  const helpText = question.help_text || question.template_instructions || question.section_instructions || '';
  const evidence = answer.evidence || [];

  const showEvidence = !answer.na && (kind === 'CAPTURE' || needsEvidence || isFail);

  const patch = (updates) => onChange(question.question_id, { ...answer, ...updates });

  const setValue = (value) => patch({ value, na: false });

  const toggleMulti = (value) => {
    const current = Array.isArray(answer.value) ? answer.value : [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    patch({ value: next, na: false });
  };

  const toggleNa = () => {
    if (answer.na) {
      patch({ na: false });
    } else {
      patch({ na: true, value: '' });
    }
  };

  const handleScanFill = (code) => {
    setScanOpen(false);
    const clean = String(code || '').trim();
    if (!clean) return;
    setValue(clean);
  };

  // 2. Updated to use local data store Storage
  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploadError('');

    const oversized = files.find((f) => f.size > MAX_EVIDENCE_MB * 1024 * 1024);
    if (oversized) {
      setUploadError(`"${oversized.name}" is larger than ${MAX_EVIDENCE_MB}MB.`);
      event.target.value = '';
      return;
    }

    setUploading(true);

    try {
      // Process files one by one (or Promise.all)
      for (const file of files) {
        // Generate a clean, unique file path: auditId/timestamp_filename
        const fileExt = file.name.split('.').pop();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${auditId}/${Date.now()}_${safeName}`;

        if (!navigator.onLine) {
          throw new Error('You must be online to upload evidence right now.');
        }

        // Upload directly to local data store storage bucket named 'evidence'
        const { data, error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get the public URL to save into the database
        const { data: publicUrlData } = supabase.storage
          .from('evidence')
          .getPublicUrl(filePath);

        // Update the state with the new evidence record
        const record = {
          evidence_id: `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
          mime_type: file.type,
          evidence_type: file.type.startsWith('image/') ? 'PHOTO' : 'FILE',
          uploaded_by: currentUser?.email || ''
        };

        onChange(question.question_id, (prev) => ({
          ...prev,
          evidence: [...(prev.evidence || []), record]
        }));
      }

    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || 'Failed to upload evidence.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeEvidence = (evidenceId) => {
    patch({ evidence: evidence.filter((e) => e.evidence_id !== evidenceId) });
  };

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 transition-all ${
        invalidReason
          ? 'border-rose-300 ring-2 ring-rose-500/10'
          : isFail
          ? 'border-amber-300'
          : 'border-slate-200/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
          {index}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-sm font-bold text-slate-900 leading-snug">
            {question.question_text}
            {isRequired && <span className="text-rose-500 ml-1">*</span>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isCritical && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60 text-[9px] font-bold uppercase">
                <AlertTriangle className="w-2.5 h-2.5" /> Critical
              </span>
            )}
            {Number(question.points) > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60 text-[9px] font-bold uppercase">
                {question.max_score || question.points} pts
              </span>
            )}
            {question.risk_category && question.risk_category !== 'General' && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-bold uppercase">
                {question.risk_category}
              </span>
            )}
            {needsEvidence && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 text-[9px] font-bold uppercase">
                Evidence required
              </span>
            )}
          </div>

          {helpText && (
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 font-medium leading-relaxed pt-0.5">
              <Info className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
              <span>{helpText}</span>
            </div>
          )}
        </div>

        {naAllowed && (
          <button
            type="button"
            onClick={toggleNa}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all cursor-pointer ${
              answer.na
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            N/A
          </button>
        )}
      </div>

      {!answer.na && (
        <div className="pl-9">
          {kind === 'CHOICE' && (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const selected = String(answer.value ?? '') === String(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValue(opt.value)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selected
                        ? opt.negative
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {kind === 'MULTI' && (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const selected = Array.isArray(answer.value) && answer.value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleMulti(opt.value)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {kind === 'SCALE' && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: getScaleMax(question) }, (_, i) => i + 1).map((n) => {
                const selected = Number(answer.value) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setValue(n)}
                    className={`w-10 h-10 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
              <div className="flex items-center gap-1 pl-2 text-[10px] font-bold text-slate-400 uppercase">
                <Star className="w-3 h-3" /> of {getScaleMax(question)}
              </div>
            </div>
          )}

          {/* RATING INPUT (Strictly 1 to 5) */}
          {kind === 'RATING' && (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="5"
                step="1"
                value={answer.value ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setValue(''); // Allow clearing the input
                  } else {
                    // Force the number to stay between 1 and 5
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      setValue(Math.max(1, Math.min(5, num)));
                    }
                  }
                }}
                placeholder="1 - 5"
                className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
              />
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                Enter a rating (1 to 5)
              </div>
            </div>
          )}

          {kind === 'NUMBER' && (
            <input
              type="number"
              step="any"
              value={answer.value ?? ''}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter a value"
              className="w-48 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          )}

          {kind === 'DATE' && (
            <input
              type="date"
              value={answer.value ?? ''}
              onChange={(e) => setValue(e.target.value)}
              className="w-48 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          )}

          {kind === 'TEXT' && (
            <input
              type="text"
              value={answer.value ?? ''}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type your observation"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          )}

          {kind === 'LONG_TEXT' && (
            <textarea
              rows={3}
              value={answer.value ?? ''}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type your observation"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
            />
          )}

          {kind === 'SCAN' && (
            <div className="space-y-2">
              {answer.value ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <ScanLine className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-mono text-xs font-bold text-emerald-800 truncate">
                      {answer.value}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanOpen(true)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase transition-colors cursor-pointer"
                  >
                    Rescan
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('')}
                    className="px-3 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  <ScanLine className="w-4 h-4" /> Scan barcode / QR code
                </button>
              )}
            </div>
          )}

          {kind === 'CAPTURE' && (
            <div className="text-[11px] font-semibold text-slate-500">
              Attach the required capture below, then mark it confirmed.
              <button
                type="button"
                disabled={evidence.length === 0}
                onClick={() => setValue(answer.value === 'CAPTURED' ? '' : 'CAPTURED')}
                className={`ml-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                  evidence.length === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : answer.value === 'CAPTURED'
                    ? 'bg-emerald-600 text-white border-emerald-600 cursor-pointer'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                {answer.value === 'CAPTURED' ? 'Confirmed' : 'Mark captured'}
              </button>
            </div>
          )}
        </div>
      )}

      {!answer.na && (
        <div className="pl-9 space-y-1.5">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <MessageSquare className="w-3 h-3" />
            Comment {needsComment && <span className="text-rose-500">(required)</span>}
          </label>
          <textarea
            rows={2}
            value={answer.comment ?? ''}
            onChange={(e) => patch({ comment: e.target.value })}
            placeholder={needsComment ? 'Explain the non-compliance...' : 'Optional notes'}
            className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-y ${
              needsComment && !String(answer.comment || '').trim()
                ? 'border-rose-300 focus:border-rose-500'
                : 'border-slate-200 focus:border-blue-500'
            }`}
          />
        </div>
      )}

      {showEvidence && (
        <div className="pl-9 space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFiles}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              {uploading ? 'Uploading' : isFail || kind === 'CAPTURE' || needsEvidence ? 'Add evidence' : 'Add photo'}
            </button>
            {evidence.length > 0 && (
              <span className="text-[10px] font-bold text-slate-400">{evidence.length} attached</span>
            )}
          </div>

          {uploadError && (
            <div className="text-[10px] font-bold text-rose-600">{uploadError}</div>
          )}

          {evidence.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {evidence.map((e) => (
                <div
                  key={e.evidence_id}
                  className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-semibold text-slate-600 max-w-[220px]"
                >
                  <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                  {e.file_url ? (
                    <a
                      href={e.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:text-blue-600"
                    >
                      {e.file_name}
                    </a>
                  ) : (
                    <span className="truncate">{e.file_name}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeEvidence(e.evidence_id)}
                    className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {invalidReason && (
        <div className="pl-9 flex items-center gap-1.5 text-[10px] font-bold text-rose-600 uppercase tracking-wider">
          <AlertTriangle className="w-3 h-3" /> {invalidReason}
        </div>
      )}

      <ScannerModal
        open={scanOpen}
        title="Scan barcode / QR"
        onScan={handleScanFill}
        onClose={() => setScanOpen(false)}
      />
    </div>
  );
}