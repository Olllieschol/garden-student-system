import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import FadeIn from '../components/FadeIn'

const services = [
  {
    id: 'custom-systems',
    title: 'Custom AI Systems',
    subtitle: 'Tools built around your business — not the other way around.',
    description:
      'Most businesses are stuck paying for software that does too much or too little. I build practical, lightweight tools that fit the way you actually work — replacing expensive subscriptions, clunky spreadsheets, and manual processes.',
    examples: [
      'Member retention dashboards that flag at-risk clients before they leave',
      'Client reactivation systems that automatically re-engage past customers',
      'Enrollment management tools that replace manual admin work',
      'Internal workflows that connect your existing tools together',
    ],
    note: 'Every system I build is designed to be simple enough that you and your team can actually use it — no technical background required.',
  },
  {
    id: 'consulting',
    title: 'AI Consulting',
    subtitle: 'A fresh set of eyes on how your business runs day-to-day.',
    description:
      'Sometimes you know things could be running better, but you\'re not sure where to start. I\'ll sit down with you, look at how your business operates, and point out the spots where AI can genuinely save you time and money.',
    examples: [
      'Identifying repetitive tasks that can be automated',
      'Finding where you\'re spending money on tools you don\'t need',
      'Mapping out a practical plan for using AI in your business',
      'Giving you an honest assessment — including where AI isn\'t the answer',
    ],
    note: 'The first audit is always free. No pressure, no confusing jargon — just a straightforward conversation about what\'s possible.',
  },
  {
    id: 'lessons',
    title: 'AI Lessons for Business',
    subtitle: 'Get your team confident with AI, without the jargon.',
    description:
      'AI tools are only useful if people actually know how to use them. I run 1-on-1 and small team sessions focused on practical skills your team can start using the same day — not theory, not hype.',
    examples: [
      'Using AI to draft emails, proposals, and client communications faster',
      'Setting up AI assistants for common business tasks',
      'Understanding what AI can and can\'t do (so you don\'t waste time)',
      'Building confidence with tools like ChatGPT, Claude, and others',
    ],
    note: 'Sessions are relaxed, practical, and tailored to what your business actually does. No one gets left behind.',
  },
  {
    id: 'tutoring',
    title: 'AI Tutoring for Individuals',
    subtitle: 'Learn AI at your own pace, from the basics up.',
    description:
      'You don\'t need to own a business to benefit from AI. Whether you want to be more productive at work, explore a personal project, or just understand what all the fuss is about — I\'ll help you get started without the overwhelm.',
    examples: [
      'Getting more done at work with AI writing and research tools',
      'Using AI for personal projects, study, or creative work',
      'Understanding AI from scratch — no experience needed',
      'Building a daily AI habit that actually saves you time',
    ],
    note: 'These sessions are completely beginner-friendly. If you can use a web browser, you\'re ready.',
  },
]

export default function Services() {
  return (
    <>
      {/* Header */}
      <section className="px-5 md:px-10 lg:px-20 pt-12 pb-8 md:pt-28 md:pb-16">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl text-dark mb-4">
              Services
            </h1>
            <p className="text-muted text-lg md:text-xl leading-relaxed max-w-xl">
              Whether you need something built, some guidance, or want to learn from scratch — here's how I work with people.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Service sections */}
      {services.map((service, i) => (
        <section
          key={service.id}
          id={service.id}
          className={`px-5 md:px-10 lg:px-20 py-14 md:py-36 ${i % 2 === 0 ? '' : 'bg-warm-gray'}`}
        >
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl text-dark mb-2">
                {service.title}
              </h2>
              <p className="text-accent font-semibold text-base md:text-lg mb-6">
                {service.subtitle}
              </p>
              <p className="text-muted text-base md:text-lg leading-relaxed mb-8 max-w-2xl">
                {service.description}
              </p>

              <div className="mb-8">
                <p className="text-dark text-xs font-bold uppercase tracking-widest mb-4">
                  Examples
                </p>
                <ul className="space-y-3">
                  {service.examples.map((example) => (
                    <li key={example} className="flex items-start gap-3">
                      <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      <span className="text-muted text-base leading-relaxed">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-muted text-base leading-relaxed mb-8 max-w-2xl italic">
                {service.note}
              </p>

              <Link
                to="/contact"
                className="inline-flex items-center gap-2 border-2 border-dark text-dark font-semibold text-sm px-6 py-3 rounded-full hover:bg-dark hover:text-white transition-colors"
              >
                Get in Touch
                <ArrowRight className="w-4 h-4" />
              </Link>
            </FadeIn>
          </div>
        </section>
      ))}

      {/* Bottom CTA */}
      <section className="px-5 md:px-10 lg:px-20 py-20 md:py-36">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark mb-4">
              Not sure what you need?
            </h2>
            <p className="text-muted text-base md:text-lg mb-8 max-w-md mx-auto">
              That's completely fine. Book a free chat and we'll figure it out together.
            </p>
            <a
              href="https://calendly.com/olliescholefield/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-dark text-white font-semibold text-base px-8 py-4 rounded-full hover:bg-accent transition-colors"
            >
              Book a Free Audit
              <ArrowRight className="w-4 h-4" />
            </a>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
