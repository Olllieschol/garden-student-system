import { Link } from 'react-router-dom'


export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-5 md:px-10 lg:px-20 py-12 md:py-24">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Left */}
          <div>
            <p className="font-display font-extrabold text-xl text-white">Ollie Scholefield</p>
            <p className="text-white/50 text-sm mt-1">North Shore, Sydney</p>
            <a href="mailto:olliescholefield@gmail.com" className="text-white/50 text-sm mt-1 hover:text-white transition-colors block">olliescholefield@gmail.com</a>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
            <div className="flex flex-col gap-3">
              <Link to="/" className="text-sm text-white/50 hover:text-white transition-colors">Home</Link>
              <Link to="/services" className="text-sm text-white/50 hover:text-white transition-colors">Services</Link>
              <Link to="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/client-stories" className="text-sm text-white/50 hover:text-white transition-colors">Client Stories</Link>
              <Link to="/contact" className="text-sm text-white/50 hover:text-white transition-colors">Contact</Link>
              <a href="https://calendly.com/olliescholefield/30min" target="_blank" rel="noopener noreferrer" className="text-sm text-accent font-semibold hover:text-accent-dark transition-colors">Book a Free Audit</a>
              <a href="https://www.linkedin.com/in/ollie-scholefield-28a065325/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:inline;verticalAlign:middle;marginRight:6px"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Ollie Scholefield. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
