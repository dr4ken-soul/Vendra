'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Supplier } from '@/lib/types';
import {
  Button,
  Checkbox,
  Dialog,
  ErrorMessage,
  Field,
  InfoMessage,
  StepProgress,
  SuccessMessage,
  TextInput,
} from './ui';
import { formatMoney } from '@/lib/format';

interface LineDraft {
  key: string;
  productLabel: string;
  quotedQuantity: string;
  unitLabel: string;
  quotedUnitPrice: string;
  agreedQuantity: string;
  agreedUnitPrice: string;
}

const STEPS = ['Supplier and quote', 'Agreed terms', 'Evidence and review'];

/**
 * /app/deals/new — three-step capture (FRONTEND_SPEC 4.5).
 *
 * Nothing is written to memory until the retailer confirms a factual event on
 * step 3. Saving as a draft writes no event at all.
 */
export function DealCaptureWizard({
  suppliers,
  shopId,
  currencyCode,
  today,
}: {
  suppliers: Supplier[];
  shopId: string;
  currencyCode: string;
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [supplierId, setSupplierId] = useState('');
  const [dealDate, setDealDate] = useState(today);
  const [headline, setHeadline] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([
    newLine(currencyCode),
  ]);

  // Tracks whether a deal id exists for this wizard instance, as state so the
  // render can read it. Mirrored into a ref for use inside async handlers.
  const [dealId, setDealId] = useState<string | null>(null);
  const dealIdRef = useRef<string | null>(null);

  const setDealIdBoth = (id: string | null) => {
    dealIdRef.current = id;
    setDealId(id);
  };

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const [evidence, setEvidence] = useState<
    Array<{ id: string; name: string; size: number; status: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [savedDealId, setSavedDealId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supplierRef = useRef<HTMLSelectElement>(null);
  const productRef = useRef<HTMLInputElement>(null);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const hasSuppliers = suppliers.length > 0;

  /**
   * The review summary needs a headline before the retailer types one. It is
   * derived at render time rather than written into state by an effect, so
   * there is no cascading render and the retailer can still override it.
   */
  const filledLabels = lines.map((l) => l.productLabel.trim()).filter(Boolean);
  const effectiveHeadline =
    headline.trim() ||
    (supplier && filledLabels.length > 0
      ? `${filledLabels.length} item${filledLabels.length === 1 ? '' : 's'} from ${supplier.display_name}`
      : '');

  // Typing in the headline field opts the retailer out of the derived value.
  const onHeadlineChange = (value: string) => setHeadline(value);

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((previous) =>
      previous.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };

        // "Terms match the quote" copies quoted values into agreed values.
        if (termsAgreed) {
          if (patch.quotedQuantity !== undefined) next.agreedQuantity = patch.quotedQuantity;
          if (patch.quotedUnitPrice !== undefined) next.agreedUnitPrice = patch.quotedUnitPrice;
          if (patch.unitLabel !== undefined) next.unitLabel = patch.unitLabel;
        }
        return next;
      }),
    );
  };

  const removeLine = (key: string) => {
    setLines((previous) => (previous.length === 1 ? previous : previous.filter((l) => l.key !== key)));
  };

  const validateStep = (target: number): boolean => {
    const errors: Record<string, string> = {};
    setFieldErrors({});

    if (target > 0) {
      if (!supplierId) {
        errors.supplierId = 'Choose a supplier.';
        setFieldErrors(errors);
        supplierRef.current?.focus();
        return false;
      }
      if (!dealDate) {
        errors.dealDate = 'Enter the deal date.';
        setFieldErrors(errors);
        return false;
      }
      const filled = lines.filter((l) => l.productLabel.trim());
      if (filled.length === 0) {
        errors.lines = 'Add at least one item.';
        setFieldErrors(errors);
        productRef.current?.focus();
        return false;
      }
    }

    return true;
  };

  const goToStep = (target: number) => {
    if (target > step && !validateStep(target)) return;
    setStep(target);
    setError(null);
  };

  const createSupplier = async () => {
    if (newSupplierName.trim().length < 1) {
      setSupplierError('Enter a supplier name.');
      return;
    }

    setCreatingSupplier(true);
    setSupplierError(null);

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          displayName: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setSupplierError(payload?.error?.message ?? 'The supplier could not be added.');
        return;
      }

      setSupplierId(payload.supplier.id);
      setSupplierDialogOpen(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
      router.refresh();
    } catch {
      setSupplierError('We could not reach Vendra. Check your connection and try again.');
    } finally {
      setCreatingSupplier(false);
    }
  };

  const uploadEvidence = async (files: FileList) => {
    if (!dealIdRef.current) {
      setUploadError('Save the deal first, then attach your quote or receipt.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const request = await fetch('/api/evidence/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            dealId: dealIdRef.current,
            fileName: file.name,
            contentType: file.type,
            byteSize: file.size,
          }),
        });

        const requestPayload = await request.json();
        if (!request.ok) {
          setUploadError(requestPayload?.error?.message ?? 'That file could not be prepared for upload.');
          continue;
        }

        const upload = await fetch(
          `${requestPayload.signedUrl}?token=${encodeURIComponent(requestPayload.token)}`,
          { method: 'PUT', headers: { 'Content-Type': file.type }, body: file },
        );

        if (!upload.ok) {
          setUploadError(`“${file.name}” did not finish uploading. Try again.`);
          continue;
        }

        const complete = await fetch('/api/evidence/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            objectKey: requestPayload.objectKey,
            dealId: dealIdRef.current,
            fileName: file.name,
            contentType: file.type,
            byteSize: file.size,
          }),
        });

        const completePayload = await complete.json();
        if (!complete.ok) {
          setUploadError(completePayload?.error?.message ?? `“${file.name}” could not be recorded.`);
          continue;
        }

        setEvidence((previous) => [
          ...previous,
          {
            id: completePayload.evidence.id,
            name: completePayload.evidence.original_filename,
            size: completePayload.evidence.byte_size,
            status: 'attached',
          },
        ]);
      }
    } catch {
      setUploadError('The upload could not be completed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (asDraft: boolean) => {
    if (!validateStep(2)) {
      setStep(0);
      return;
    }

    setSaveState('saving');
    setError(null);
    setFieldErrors({});

    const payload = {
      shopId,
      supplierId,
      dealDate,
      headline: effectiveHeadline.trim() || null,
      expectedDeliveryAt: expectedDelivery ? new Date(`${expectedDelivery}T09:00:00`).toISOString() : null,
      deliveryNote: deliveryNote.trim() || null,
      termsAgreed,
      saveAsDraft: asDraft,
      lines: lines
        .filter((l) => l.productLabel.trim())
        .map((l) => ({
          productLabel: l.productLabel.trim(),
          unitLabel: l.unitLabel.trim() || null,
          quotedQuantity: numericOrNull(l.quotedQuantity),
          quotedUnitPrice: numericOrNull(l.quotedUnitPrice),
          agreedQuantity: termsAgreed ? numericOrNull(l.agreedQuantity) : null,
          agreedUnitPrice: termsAgreed ? numericOrNull(l.agreedUnitPrice) : null,
        })),
    };

    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setSaveState('error');
        setError(result?.error?.message ?? 'The deal could not be saved. Your entries are still here — try again.');
        setFieldErrors(result?.error?.fields ?? {});
        return;
      }

      setDealIdBoth(result.deal.id);
      setSavedDealId(result.deal.id);
      setSaveState('saved');
      setSuccessMessage(result.message ?? 'Deal saved.');

      // A draft has no deal id to navigate to in a "saved" sense, but it does
      // exist, so link to it rather than leaving the retailer stranded.
      if (asDraft) {
        setTimeout(() => router.push(`/app/deals/${result.deal.id}`), 900);
      }
    } catch {
      setSaveState('error');
      setError('We could not reach Vendra. Your entries are still here — check your connection and try again.');
    }
  };

  /* ---------------------------------------------------------------------
     SUCCESS
     ------------------------------------------------------------------- */

  if (savedDealId) {
    return (
      <div className="mx-auto w-full max-w-[900px]">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-sm)] md:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Deal saved
          </h1>
          <div className="mt-4">
            <SuccessMessage>{successMessage}</SuccessMessage>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => router.push(`/app/deals/${savedDealId}`)} type="button">
              Open this deal
            </Button>
            <Button variant="secondary" onClick={() => router.push('/app/deals')} type="button">
              Back to deals
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------
     WIZARD
     ------------------------------------------------------------------- */

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="mb-6 flex flex-col gap-2">
        <h1
          id="page-heading"
          tabIndex={-1}
          className="font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--text-primary)] focus:outline-none md:text-4xl"
        >
          Capture a deal
        </h1>
        <p className="max-w-[60ch] font-body text-sm leading-relaxed text-[var(--text-secondary)]">
          Save the quote first. Agreed terms, delivery and any issue come after.
        </p>
      </div>

      <StepProgress steps={STEPS} current={step} />

      <div className="mt-7 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-sm)] md:p-8">
        {/* ---------------- STEP 1 ---------------- */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Supplier" htmlFor="supplier" required error={fieldErrors.supplierId}>
                <div className="flex gap-2">
                  <select
                    id="supplier"
                    ref={supplierRef}
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    aria-invalid={fieldErrors.supplierId ? true : undefined}
                    aria-describedby={fieldErrors.supplierId ? 'supplier-error' : undefined}
                    className={`min-h-11 w-full appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 pr-10 font-body text-sm text-[var(--text-primary)] transition-colors duration-[120ms] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] ${
                      fieldErrors.supplierId ? 'border-[var(--error)]' : ''
                    }`}
                  >
                    <option value="">{hasSuppliers ? 'Choose a supplier' : 'No suppliers yet'}</option>
                    {suppliers.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              <div className="flex items-end">
                <Button variant="secondary" type="button" onClick={() => setSupplierDialogOpen(true)}>
                  Add supplier
                </Button>
              </div>

              <Field
                label="Date of this deal"
                htmlFor="dealDate"
                required
                help="When the supplier quoted you. The expected delivery date is a separate field in the next step."
                error={fieldErrors.dealDate}
              >
                <TextInput
                  id="dealDate"
                  type="date"
                  value={dealDate}
                  onChange={(e) => setDealDate(e.target.value)}
                  error={fieldErrors.dealDate}
                />
              </Field>

              <Field label="Deal summary" htmlFor="headline" help="Optional. Shown in your deal list.">
                <TextInput
                  id="headline"
                  value={headline}
                  onChange={(e) => onHeadlineChange(e.target.value)}
                  maxLength={200}
                />
              </Field>
            </div>

            {/* LINE ITEMS */}
            <div className="mt-2 border-t border-[var(--border-default)] pt-5">
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Items on this deal
              </h2>
              <p className="mt-1 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                Currency is {currencyCode}, taken from your shop settings.
              </p>

              {fieldErrors.lines && (
                <p role="alert" className="mt-2 font-body text-xs text-[var(--error)]">
                  {fieldErrors.lines}
                </p>
              )}

              <ul className="mt-5">
                {lines.map((line, index) => (
                  <li
                    key={line.key}
                    className="grid grid-cols-1 gap-3 border-b border-[var(--border-subtle)] py-4 md:grid-cols-[minmax(0,1fr)_120px_120px_140px_auto] md:items-end"
                  >
                    <Field label={index === 0 ? 'Product or item' : 'Item'} htmlFor={`label-${line.key}`}>
                      <TextInput
                        id={`label-${line.key}`}
                        ref={index === 0 ? productRef : undefined}
                        value={line.productLabel}
                        onChange={(e) => updateLine(line.key, { productLabel: e.target.value })}
                        placeholder="e.g. Tomato paste"
                      />
                    </Field>

                    <Field label="Quoted quantity" htmlFor={`qty-${line.key}`}>
                      <TextInput
                        id={`qty-${line.key}`}
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        value={line.quotedQuantity}
                        onChange={(e) => updateLine(line.key, { quotedQuantity: e.target.value })}
                      />
                    </Field>

                    <Field label="Unit" htmlFor={`unit-${line.key}`}>
                      <TextInput
                        id={`unit-${line.key}`}
                        value={line.unitLabel}
                        onChange={(e) => updateLine(line.key, { unitLabel: e.target.value })}
                        placeholder="carton"
                      />
                    </Field>

                    <Field label={`Quoted price (${currencyCode})`} htmlFor={`price-${line.key}`}>
                      <TextInput
                        id={`price-${line.key}`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={line.quotedUnitPrice}
                        onChange={(e) => updateLine(line.key, { quotedUnitPrice: e.target.value })}
                      />
                    </Field>

                    <div className="flex items-end pb-1">
                      <Button
                        variant="quiet"
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        aria-label={`Remove ${line.productLabel || `item ${index + 1}`}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                variant="secondary"
                type="button"
                className="mt-4"
                onClick={() => setLines((previous) => [...previous, newLine(currencyCode)])}
              >
                Add another item
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 2 ---------------- */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <Checkbox
                id="termsAgreed"
                checked={termsAgreed}
                onChange={(e) => {
                  const agreed = e.target.checked;
                  setTermsAgreed(agreed);
                  if (agreed) {
                    setLines((previous) =>
                      previous.map((line) => ({
                        ...line,
                        agreedQuantity: line.agreedQuantity || line.quotedQuantity,
                        agreedUnitPrice: line.agreedUnitPrice || line.quotedUnitPrice,
                        unitLabel: line.unitLabel,
                      })),
                    );
                  }
                }}
                label="Terms match the quote"
                help="Unticking this saves the deal as a quote without implying you agreed."
              />
            </div>

            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Agreed terms
              </h2>
              <p className="mt-1 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                {termsAgreed
                  ? 'These match the quote. Change any value that was negotiated differently.'
                  : 'Not agreed yet. Leave these blank until you confirm with the supplier.'}
              </p>
            </div>

            <ul>
              {lines.map((line, index) => (
                <li
                  key={line.key}
                  className="grid grid-cols-1 gap-3 border-b border-[var(--border-subtle)] py-4 md:grid-cols-[minmax(0,1fr)_120px_120px_140px] md:items-end"
                >
                  <Field label={index === 0 ? 'Product or item' : 'Item'} htmlFor={`a-label-${line.key}`}>
                    <TextInput id={`a-label-${line.key}`} value={line.productLabel} disabled />
                  </Field>

                  <Field label="Agreed quantity" htmlFor={`a-qty-${line.key}`}>
                    <TextInput
                      id={`a-qty-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      value={line.agreedQuantity}
                      onChange={(e) => updateLine(line.key, { agreedQuantity: e.target.value })}
                      disabled={!termsAgreed}
                    />
                  </Field>

                  <Field label="Unit" htmlFor={`a-unit-${line.key}`}>
                    <TextInput
                      id={`a-unit-${line.key}`}
                      value={line.unitLabel}
                      onChange={(e) => updateLine(line.key, { unitLabel: e.target.value })}
                      disabled={!termsAgreed}
                    />
                  </Field>

                  <Field label={`Agreed price (${currencyCode})`} htmlFor={`a-price-${line.key}`}>
                    <TextInput
                      id={`a-price-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={line.agreedUnitPrice}
                      onChange={(e) => updateLine(line.key, { agreedUnitPrice: e.target.value })}
                      disabled={!termsAgreed}
                    />
                  </Field>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Expected delivery date" htmlFor="expectedDelivery">
                <TextInput
                  id="expectedDelivery"
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                />
              </Field>

              <Field label="Delivery note" htmlFor="deliveryNote" help="Optional. Where, when or any condition.">
                <TextInput id="deliveryNote" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {/* ---------------- STEP 3 ---------------- */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Quote or receipt
              </h2>
              <p className="mt-1 font-body text-xs leading-relaxed text-[var(--text-muted)]">
                Save the deal first, then attach a photo of the message, a screenshot or a receipt. JPEG, PNG,
                WebP, HEIC or PDF, up to 25 MB. Files stay private to your shop.
              </p>

              {!dealId && (
                <div className="mt-3">
                  <InfoMessage>
                    Your deal has not been saved yet. Use “Save draft” first, then reopen the deal to attach files.
                  </InfoMessage>
                </div>
              )}

              <label
                className="mt-4 flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-wash)] p-5 text-center transition-colors duration-[120ms] hover:border-[var(--accent-border)]"
              >
                <span className="font-body text-sm font-semibold text-[var(--text-primary)]">
                  {uploading ? 'Uploading…' : 'Add quote or receipt'}
                </span>
                <span className="font-body text-xs text-[var(--text-muted)]">
                  Choose a file from your phone or computer
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  className="sr-only"
                  disabled={!dealId || uploading}
                  onChange={(event) => {
                    if (event.target.files?.length) void uploadEvidence(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>

              {uploadError && (
                <div className="mt-3">
                  <ErrorMessage>{uploadError}</ErrorMessage>
                </div>
              )}

              {evidence.length > 0 && (
                <ul className="mt-4 border-t border-[var(--border-default)]">
                  {evidence.map((file) => (
                    <li
                      key={file.id}
                      className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-2 font-body text-sm"
                    >
                      <span className="min-w-0 truncate text-[var(--text-primary)]">{file.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--success)]">
                        Attached
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                Review
              </h2>
              <dl className="mt-4 flex flex-col">
                <ReviewRow label="Supplier" value={supplier?.display_name ?? 'Not chosen'} />
                <ReviewRow label="Date of this deal" value={dealDate} />
                <ReviewRow label="Summary" value={effectiveHeadline || 'Not recorded'} />
                <ReviewRow
                  label="Terms"
                  value={
                    termsAgreed
                      ? 'Agreed — recorded as a confirmed term'
                      : 'Not agreed yet — saved as a quote'
                  }
                />
                <ReviewRow label="Expected delivery" value={expectedDelivery || 'Not recorded'} />
                <ReviewRow
                  label="Items"
                  value={`${lines.filter((l) => l.productLabel.trim()).length} item(s), ${formatMoney(
                    quotedTotal(lines),
                    currencyCode,
                  )} quoted`}
                />
                <ReviewRow
                  label="Evidence"
                  value={evidence.length === 0 ? 'None attached yet' : `${evidence.length} file(s)`}
                />
              </dl>

              <div className="mt-4">
                <InfoMessage>
                  Saving writes the quote to your shop’s records. If terms are agreed, they are written as a
                  separate confirmed record. Vendra adds those confirmed facts to your shop’s deal memory.
                </InfoMessage>
              </div>
            </section>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Not saved'
                    : dealId
                      ? 'Draft saved'
                      : 'Not saved yet'}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => void save(true)}
                  disabled={saveState === 'saving'}
                >
                  Save draft
                </Button>
                <Button type="button" onClick={() => void save(false)} disabled={saveState === 'saving'}>
                  {saveState === 'saving' ? 'Saving…' : 'Save deal'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- WIZARD FOOTER (steps 1-2) ---------------- */}
        {step < 2 && (
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="quiet"
              type="button"
              onClick={() => goToStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            <Button type="button" onClick={() => goToStep(step + 1)}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <Button variant="quiet" type="button" onClick={() => goToStep(1)}>
              Back
            </Button>
          </div>
        )}
      </div>

      {/* ---------------- ADD SUPPLIER DIALOG ---------------- */}
      <Dialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        title="Add a supplier"
        description="Save only the details you need to recognise this supplier in your own records."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setSupplierDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void createSupplier()} disabled={creatingSupplier}>
              {creatingSupplier ? 'Adding…' : 'Add supplier'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Supplier name" htmlFor="newSupplierName" required error={supplierError ?? undefined}>
            <TextInput
              id="newSupplierName"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="e.g. Okonkwo Wholesale"
              error={supplierError ?? undefined}
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="newSupplierPhone"
            help="Optional. Stored only in your shop and never shared with another shop."
          >
            <TextInput
              id="newSupplierPhone"
              type="tel"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="font-body text-sm text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-body text-sm text-[var(--text-primary)] sm:text-right">{value}</dd>
    </div>
  );
}

function newLine(currencyCode: string): LineDraft {
  void currencyCode;
  return {
    key: crypto.randomUUID(),
    productLabel: '',
    quotedQuantity: '',
    unitLabel: '',
    quotedUnitPrice: '',
    agreedQuantity: '',
    agreedUnitPrice: '',
  };
}

function numericOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function quotedTotal(lines: LineDraft[]): number | null {
  let total = 0;
  let seen = false;
  for (const line of lines) {
    const price = numericOrNull(line.quotedUnitPrice);
    if (price === null) continue;
    const quantity = numericOrNull(line.quotedQuantity) ?? 1;
    total += price * quantity;
    seen = true;
  }
  return seen ? total : null;
}