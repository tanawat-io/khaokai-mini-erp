export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center rounded-md border border-warmgray-300">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-lg text-warmgray-600 disabled:text-warmgray-300"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium text-warmgray-900">{value}</span>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-lg text-warmgray-600"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
