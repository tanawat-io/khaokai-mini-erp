import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

// Native <select> becomes unusable once the option list is long (e.g. 20+ ingredients) —
// no way to search, and the browser's built-in list has no height cap. This is a drop-in
// replacement with the same value/onChange(value) shape as the native selects it replaces.
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  emptyLabel = 'ไม่พบรายการที่ค้นหา',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q === '' ? options : options.filter((o) => o.label.toLowerCase().includes(q));

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlighted(0);
      inputRef.current?.focus();
    }
  }, [open]);

  function selectOption(opt: SearchableSelectOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt) selectOption(opt);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {open ? (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selected?.label ?? placeholder}
          className="min-h-touch w-full rounded-md border border-orange-400 px-3 text-[15px] outline-none ring-1 ring-orange-400"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-touch w-full items-center justify-between rounded-md border border-warmgray-300 bg-white px-3 text-left text-[15px]"
        >
          <span className={`truncate ${selected ? 'text-warmgray-900' : 'text-warmgray-400'}`}>{selected?.label ?? placeholder}</span>
          <span aria-hidden className="ml-2 shrink-0 text-warmgray-400">
            ▾
          </span>
        </button>
      )}
      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-warmgray-200 bg-white py-1 shadow-raised"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-warmgray-400">{emptyLabel}</div>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => selectOption(opt)}
                className={`flex min-h-touch w-full items-center px-3 text-left text-[15px] ${
                  i === highlighted ? 'bg-orange-50 text-orange-700' : 'text-warmgray-700'
                } ${opt.value === value ? 'font-medium' : ''}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
