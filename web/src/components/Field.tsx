import { useState, type InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

// A visible label tied to its input, so screen readers and clicks on the label both work.
// Password inputs get a show/hide button, like the mockups.
export function Field({ label, hint, id, type, ...inputProps }: FieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const isPassword = type === 'password'
  const input = (
    <input id={inputId} aria-describedby={hintId} type={isPassword && showPassword ? 'text' : type} {...inputProps} />
  )

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      {isPassword ? (
        <div className="password-wrap">
          {input}
          <button
            type="button"
            className="icon-button"
            aria-label={`Show ${label.toLowerCase()}`}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            <EyeIcon crossedOut={showPassword} />
          </button>
        </div>
      ) : (
        input
      )}
      {hint && (
        <small id={hintId} className="hint">
          {hint}
        </small>
      )}
    </div>
  )
}

// Plain SVG, so no icon package is needed. A slash means "click to hide again".
function EyeIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossedOut && <path d="M4 4l16 16" />}
    </svg>
  )
}
