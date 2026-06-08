import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from "lucide-react"
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
      <div className="max-w-7xl mx-auto px-5 md:px-10 lg:px-20 flex items-center justify-between h-16 md:h-[4.5rem]">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <img src="/logo.svg" alt="Ollie Scholefield" className="h-12 w-12 rounded-full" />
          <span className="font-display font-extrabold text-lg md:text-xl text-dark tracking-tight">Ollie Scholefield</span>
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
          <a
            href="https://www.linkedin.com/in/ollie-scholefield-28a065325/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-dark transition-colors"
            aria-label="LinkedIn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a
            href="https://calendly.com/olliescholefield/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 bg-dark text-white font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-accent transition-colors"
          >
            Book a Free Audit
          </a>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3">
          <a
            href="https://calendly.com/olliescholefield/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-dark text-white font-semibold text-xs px-4 py-2 rounded-full hover:bg-accent transition-colors"
          >
            Free Audit
          </a>
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
              <a
                href="https://calendly.com/olliescholefield/30min"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-2 bg-dark text-white font-semibold text-center text-base px-6 py-3.5 rounded-full hover:bg-accent transition-colors"
              >
                Book a Free Audit
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
