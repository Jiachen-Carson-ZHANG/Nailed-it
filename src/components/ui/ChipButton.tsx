type ChipButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

export function ChipButton({ label, selected, onClick }: ChipButtonProps) {
  return (
    <button
      aria-pressed={selected}
      className={selected ? 'chip chip-selected' : 'chip'}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
