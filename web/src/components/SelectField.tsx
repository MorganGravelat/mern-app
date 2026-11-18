import type { SelectHTMLAttributes } from 'react'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
  emptyLabel?: string // adds a first "no choice" option, e.g. "All statuses"
}

export function SelectField({ label, options, emptyLabel, id, ...selectProps }: SelectFieldProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="field">
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} {...selectProps}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
