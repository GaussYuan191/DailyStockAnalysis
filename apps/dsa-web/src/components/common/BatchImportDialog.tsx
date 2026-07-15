import type React from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useUiLanguage } from '../../contexts/UiLanguageContext';
import { analysisApi } from '../../api/analysis';

interface BatchImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitComplete: (submittedCount: number, skippedCount: number) => void;
  onError: (message: string) => void;
  existingStockCodes: Set<string>;
}

export const BatchImportDialog: React.FC<BatchImportDialogProps> = ({
  isOpen,
  onClose,
  onSubmitComplete,
  onError,
  existingStockCodes,
}) => {
  const { t } = useUiLanguage();
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (el && isOpen) {
      el.focus();
    }
  };

  const handleSubmit = async () => {
    const allCodes = inputValue
      .split(/[,，\s\n]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (allCodes.length === 0) {
      onError(t('home.batchImportNoCodes'));
      return;
    }

    // Deduplicate within the input itself
    const uniqueCodes = [...new Set(allCodes)];

    // Split into existing (skip) and new (submit)
    const newCodes: string[] = [];
    const skippedCodes: string[] = [];
    for (const code of uniqueCodes) {
      if (existingStockCodes.has(code) || existingStockCodes.has(code.replace(/\.(SH|SZ|BJ)$/i, ''))) {
        skippedCodes.push(code);
      } else {
        newCodes.push(code);
      }
    }

    if (newCodes.length === 0) {
      onError(t('home.batchImportAllSkipped'));
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let lastError: string | null = null;

    for (const code of newCodes) {
      try {
        await analysisApi.analyzeAsync({
          stockCode: code,
          reportType: 'detailed',
          selectionSource: 'import',
        });
        successCount++;
      } catch (err) {
        if (err instanceof Error) {
          lastError = err.message;
        }
      }
    }

    setIsSubmitting(false);
    if (successCount > 0) {
      onSubmitComplete(successCount, skippedCodes.length);
      onClose();
    } else if (lastError) {
      onError(lastError);
    } else {
      onError(t('home.batchImportNoCodes'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const parsedCount = inputValue
    .split(/[,，\s\n]+/)
    .filter((c) => c.trim().length > 0).length;
  const isZh = t('common.confirm') === '确定';

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-xl border border-border/70 bg-elevated p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-medium text-foreground">
          {t('home.batchImportTitle')}
        </h3>
        <p className="mb-3 text-xs text-muted-text">
          {t('home.batchImportPlaceholder')}
        </p>
        <textarea
          ref={setTextareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('home.batchImportPlaceholder')}
          disabled={isSubmitting}
          rows={4}
          className="w-full resize-none rounded-xl border border-border/70 bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-text/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-text">
          <span>
            {parsedCount} {isZh ? '只' : 'stocks'}
          </span>
          <span className="hidden sm:inline">Ctrl+Enter</span>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-border/70 px-4 py-2 text-sm font-medium text-secondary-text transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !inputValue.trim()}
            className="btn-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {t('home.batchImportSubmitting')}
              </>
            ) : (
              t('common.confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
};
