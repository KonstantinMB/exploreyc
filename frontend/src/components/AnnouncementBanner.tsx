export function AnnouncementBanner() {
  return (
    <a
      href="https://www.ycombinator.com/apply"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-0 left-0 right-0 z-50 block bg-[#FB651E] hover:bg-[#E65C00] transition-colors md:relative md:z-auto"
    >
      <div className="container mx-auto px-3 py-1.5 md:py-1 flex items-center justify-center gap-1.5 text-white">
        <span className="text-xs md:text-sm">🚀</span>
        <span className="text-[11px] md:text-xs font-mono font-medium text-center whitespace-nowrap">
          <span className="sm:hidden">YC S26 open</span>
          <span className="hidden sm:inline">YC Summer 2026 applications open</span>
        </span>
        <svg
          className="w-3 h-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      </div>
    </a>
  );
}
