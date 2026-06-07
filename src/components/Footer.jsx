import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-16">
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
              <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">LinkedIn</a>
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
