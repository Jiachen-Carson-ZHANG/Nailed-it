'use client';

type AnalyzeChipProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
  quantity?: number;
  unitLabel?: string;
  onQuantityChange?: (n: number) => void;
};

export function AnalyzeChip({
  label,
  active,
  onToggle,
  quantity,
  unitLabel,
  onQuantityChange,
}: AnalyzeChipProps) {
  const showQty = active && quantity !== undefined && onQuantityChange;

  return (
    <button
      type="button"
      className={`analyze-chip${active ? ' analyze-chip-active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
    >
      <span className="analyze-chip-label">{label}</span>
      {showQty && (
        <span className="analyze-qty-stepper" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="analyze-qty-btn"
            onClick={() => onQuantityChange(Math.max(1, (quantity ?? 1) - 1))}
            aria-label="减少数量"
          >−</button>
          <input
            type="number"
            className="analyze-qty-input"
            value={quantity}
            min={1}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const n = Math.max(1, Math.round(Number(e.target.value) || 1));
              onQuantityChange(n);
            }}
            aria-label="数量"
          />
          <button
            type="button"
            className="analyze-qty-btn"
            onClick={() => onQuantityChange((quantity ?? 1) + 1)}
            aria-label="增加数量"
          >+</button>
          {unitLabel && <span className="analyze-qty-unit">{unitLabel}</span>}
        </span>
      )}
    </button>
  );
}

type AddChipProps = {
  onClick: () => void;
  label?: string;
};

export function AddChip({ onClick, label = '+' }: AddChipProps) {
  return (
    <button type="button" className="analyze-chip analyze-chip-add" onClick={onClick} aria-label="添加选项">
      {label}
    </button>
  );
}
