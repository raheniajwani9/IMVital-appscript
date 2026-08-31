import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function DatePicker({value,onChange,label,placeholder = 'Select date',required = false,min,max,disabled = false,className = ''}) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          max={max}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-9 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        />
        <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
      </div>
    </div>
  );
}