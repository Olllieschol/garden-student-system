import { Play } from 'lucide-react'

export default function MediaPlaceholder({ label, aspectRatio = '16/9', isVideo = false, className = '' }) {
  return (
    <div
      className={`relative flex items-center justify-center bg-placeholder rounded-2xl overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-dark/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-dark transition-colors">
            <Play className="w-7 h-7 md:w-8 md:h-8 text-white ml-1" fill="white" />
          </div>
        </div>
      )}
      <span className="text-muted text-sm md:text-base font-body select-none px-4 text-center">
        {label}
      </span>
    </div>
  )
}
