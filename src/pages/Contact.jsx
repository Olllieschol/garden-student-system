import { useState } from 'react'
import FadeIn from '../components/FadeIn'

const options = [
  'Free Business Audit',
  'AI Lessons',
  'AI Tutoring',
  'Just Curious',
  'Other',
]

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    interest: '',
    message: '',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Thanks for reaching out! (This form isn\'t connected yet — just a placeholder.)')
  }

  return (
    <>
      {/* Header */}
      <section className="px-5 md:px-8 pt-12 pb-8 md:pt-20 md:pb-12">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl text-dark mb-4">
              Let's have a chat
            </h1>
            <p className="text-muted text-lg md:text-xl leading-relaxed max-w-lg">
              Whether you've got a project in mind or you're just curious about what AI could do for you — drop me a message.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Form */}
      <section className="px-5 md:px-8 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row md:gap-16">
            {/* Form column */}
            <div className="md:w-7/12">
              <FadeIn>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="name" className="block text-dark text-sm font-semibold mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-warm-gray border border-warm-border rounded-xl px-4 py-3.5 text-base text-dark placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-dark text-sm font-semibold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      className="w-full bg-warm-gray border border-warm-border rounded-xl px-4 py-3.5 text-base text-dark placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-dark text-sm font-semibold mb-2">
                      Phone <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full bg-warm-gray border border-warm-border rounded-xl px-4 py-3.5 text-base text-dark placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                      placeholder="04XX XXX XXX"
                    />
                  </div>
                  <div>
                    <label htmlFor="interest" className="block text-dark text-sm font-semibold mb-2">
                      What are you after?
                    </label>
                    <select
                      id="interest"
                      name="interest"
                      value={form.interest}
                      onChange={handleChange}
                      required
                      className="w-full bg-warm-gray border border-warm-border rounded-xl px-4 py-3.5 text-base text-dark focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23555550' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                      }}
                    >
                      <option value="" disabled>Select an option</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-dark text-sm font-semibold mb-2">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      rows={5}
                      className="w-full bg-warm-gray border border-warm-border rounded-xl px-4 py-3.5 text-base text-dark placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
                      placeholder="Tell me a bit about what you're looking for..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="mt-2 bg-dark text-white font-semibold text-base px-8 py-4 rounded-full hover:bg-accent transition-colors w-full sm:w-auto"
                  >
                    Send Message
                  </button>
                  <p className="text-muted text-sm mt-4 leading-relaxed">
                    I'll get back to you within 24 hours to lock in a time. The audit takes around 30 minutes and is completely free — no commitment, no pressure.
                  </p>
                </form>
              </FadeIn>
            </div>

            {/* Sidebar */}
            <div className="md:w-5/12 mt-12 md:mt-0">
              <FadeIn delay={0.1}>
                <div className="bg-warm-gray rounded-2xl p-6 md:p-8 mb-6">
                  <h3 className="font-display font-bold text-xl text-dark mb-3">Prefer to book a time directly?</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Pick a time that works for you and we'll have a relaxed chat about your business.
                  </p>
                  <div className="bg-placeholder rounded-xl flex items-center justify-center h-48">
                    <span className="text-muted text-sm">Calendly Embed Placeholder</span>
                  </div>
                </div>
                <div className="bg-warm-gray rounded-2xl p-6 md:p-8">
                  <h3 className="font-display font-bold text-xl text-dark mb-3">Based in Sydney</h3>
                  <p className="text-muted text-sm leading-relaxed">
                    Available for in-person sessions across Sydney's North Shore. Remote sessions available everywhere else.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
