type ChipButtonProps = {
  disabled?: boolean;
  label: string;
  selected: boolean;
  onClick: () => void;
};

export function ChipButton({ disabled = false, label, selected, onClick }: ChipButtonProps) {
  return (
    <button
      aria-pressed={selected}
      className={selected ? 'chip chip-selected' : 'chip'}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
