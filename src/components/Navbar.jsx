import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/client-stories', label: 'Client Stories' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <nav className="sticky top-0 z-50 bg-warm-white/90 backdrop-blur-md border-b border-warm-border">
      <div className="max-w-6xl mx-auto px-5 md:px-8 flex items-center justify-between h-16 md:h-[4.5rem]">
        {/* Logo */}
        <Link to="/" className="font-display font-extrabold text-lg md:text-xl text-dark tracking-tight" onClick={() => setOpen(false)}>
          Ollie Scholefield
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm font-medium transition-colors hover:text-dark ${
                pathname === to ? 'text-dark' : 'text-muted'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/contact"
            className="ml-1 bg-dark text-white font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-accent transition-colors"
          >
            Book a Free Audit
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3">
          <Link
            to="/contact"
            className="bg-dark text-white font-semibold text-xs px-4 py-2 rounded-full hover:bg-accent transition-colors"
            onClick={() => setOpen(false)}
          >
            Free Audit
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="p-2 -mr-2 text-dark"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden bg-warm-white border-b border-warm-border"
          >
            <div className="px-5 py-6 flex flex-col gap-5">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={`font-medium text-lg transition-colors ${
                    pathname === to ? 'text-dark' : 'text-muted'
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="mt-2 bg-dark text-white font-semibold text-center text-base px-6 py-3.5 rounded-full hover:bg-accent transition-colors"
              >
                Book a Free Audit
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
