export function ExamSheetOutline({
  className = '',
  detail = false,
}: {
  className?: string
  detail?: boolean
}) {
  return (
    <svg viewBox="0 0 720 760" className={className} aria-hidden="true">
      <rect x="135" y="75" width="420" height="590" rx="30" fill="#fff" stroke="#2c3e50" strokeWidth="7" />
      <rect x="190" y="130" width="235" height="20" rx="10" fill="#EAE4E2" />
      {detail ? (
        <>
          <rect x="185" y="205" width="320" height="24" rx="12" fill="#F2EFED" />
          <rect x="185" y="250" width="320" height="24" rx="12" fill="#F2EFED" />
        </>
      ) : null}
    </svg>
  )
}
