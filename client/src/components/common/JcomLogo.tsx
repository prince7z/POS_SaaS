
interface JcomLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
  subtext?: string
}

export function JcomLogo({ size = 'md', showText = true, className = '', subtext }: JcomLogoProps) {
  const iconBoxSizes = {
    sm: 'w-7 h-7 text-xs border-[1px]',
    md: 'w-9 h-9 text-sm border-[1.5px]',
    lg: 'w-11 h-11 text-base border-[1.5px]',
    xl: 'w-14 h-14 text-xl border-2',
  }

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon: White background, black Jcom text in Helvetica */}
      <div
        className={`${iconBoxSizes[size]} bg-white border-zinc-300 rounded-xl flex items-center justify-center font-extrabold text-black shadow-xs flex-shrink-0 select-none`}
        style={{ fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif' }}
      >
        Jcom
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <span
            className={`${textSizes[size]} font-extrabold text-zinc-950 tracking-tight leading-none`}
            style={{ fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif' }}
          >
            Jcom
          </span>
          {subtext !== undefined ? (
            subtext ? (
              <span className="text-[10px] text-zinc-500 font-mono font-medium tracking-widest uppercase mt-1">
                {subtext}
              </span>
            ) : null
          ) : null}
        </div>
      )}
    </div>
  )
}

export default JcomLogo
