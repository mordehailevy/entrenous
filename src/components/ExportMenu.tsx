import { useEffect, useRef, useState } from 'react';

interface ExportMenuProps {
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export function ExportMenu({ onExportCsv, onExportPdf }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-m-2 p-2 text-xs font-medium text-gray-500 hover:text-ink"
      >
        ⬇️ Exporter
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onExportCsv();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-gray-50"
          >
            Format CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onExportPdf();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-gray-50"
          >
            Format PDF
          </button>
        </div>
      )}
    </div>
  );
}
