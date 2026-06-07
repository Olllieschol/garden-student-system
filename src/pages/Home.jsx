import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Zap } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import MediaPlaceholder from '../components/MediaPlaceholder'

const services = [
  {
    title: 'Custom AI Systems',
    description: 'Tools built around your business — not the other way around.',
    to: '/services',
  },
  {
    title: 'AI Consulting',
    description: 'A fresh set of eyes on how your business runs day-to-day.',
    to: '/services',
  },
  {
    title: 'AI Lessons for Business',
    description: 'Get your team confident with AI, without the jargon.',
    to: '/services',
  },
  {
    title: 'AI Tutoring',
    description: 'Learn AI at your own pace, from the basics up.',
    to: '/services',
  },
]

const steps = [
  {
    number: '01',
    title: 'Book a free chat',
    description: 'We\'ll have a relaxed conversation about your business and where you\'re spending too much time.',
  },
  {
    number: '02',
    title: 'I figure out what you need',
    description: 'I\'ll map out exactly where AI can help — and where it can\'t. No fluff, just honest advice.',
  },
  {
    number: '03',
    title: 'I build it, teach it, or both',
    description: 'Whether you need a custom tool, training, or just some guidance — we\'ll get it sorted.',
  },
]

export default function Home() {
  return (
    <>
      {/* ──────── HERO ──────── */}
      <section className="px-5 md:px-8 pt-8 pb-16 md:pt-14 md:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:gap-14">

            {/* ── Collage — top on mobile, right on desktop ── */}
            <div className="order-1 md:order-2 md:w-[48%] mb-10 md:mb-0">
              <FadeIn delay={0.1}>
                <div className="relative mx-auto" style={{ maxWidth: '360px' }}>
                  {/* Main photo */}
                  <MediaPlaceholder
                    label="Photo of Ollie"
                    aspectRatio="3/4"
                    className="w-full rounded-3xl"
                  />

                  {/* Floating card — top left */}
                  <div className="absolute -top-3 -left-3 bg-dark text-white rounded-2xl px-4 py-3 shadow-xl shadow-dark/20 max-w-[160px]">
                    <p className="font-display font-bold text-sm leading-snug">Built for real businesses</p>
                  </div>

                  {/* Floating pill — bottom left */}
                  <div className="absolute -bottom-4 -left-3 bg-accent text-white rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2">
                    <Zap className="w-4 h-4 shrink-0" fill="white" />
                    <span className="font-semibold text-sm whitespace-nowrap">Save Time with AI</span>
                  </div>

                  {/* Floating location — top right */}
                  <div className="absolute -top-3 -right-3 bg-warm-white border border-warm-border rounded-xl px-3 py-2 shadow-md flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-dark font-semibold text-xs whitespace-nowrap">North Shore, Sydney</span>
                  </div>

                  {/* Floating small card — bottom right */}
                  <div className="absolute -bottom-4 -right-3 bg-warm-white border border-warm-border rounded-2xl px-4 py-3 shadow-md">
                    <p className="text-xs text-muted">First audit</p>
                    <p className="font-display font-bold text-base text-accent leading-tight">Always free</p>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* ── Text — below photo on mobile, left on desktop ── */}
            <div className="order-2 md:order-1 md:w-[52%] md:pt-4">
              <FadeIn>
                <h1 className="font-display font-extrabold text-[3.5rem] md:text-[5rem] lg:text-[5.75rem] leading-[0.95] text-dark mb-5">
                  Ollie<br />Scholefield
                </h1>
                <p className="font-display font-bold text-[1.2rem] md:text-[1.4rem] leading-snug text-accent mb-4">
                  Making AI simple. For your business, your team, or just yourself.
                </p>
                <p className="text-muted text-sm leading-relaxed mb-8 max-w-xs">
                  I help businesses save time with AI and teach individuals how to use it — practically, without the hype.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://calendly.com/olliescholefield/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-dark text-white font-semibold text-sm px-6 py-3.5 rounded-full hover:bg-accent transition-colors"
                  >
                    Book a Free Audit
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <Link
                    to="/client-stories"
                    className="inline-flex items-center gap-2 border border-warm-border text-dark font-medium text-sm px-6 py-3.5 rounded-full hover:border-dark transition-colors"
                  >
                    See client work
                  </Link>
                </div>
              </FadeIn>
            </div>

          </div>
        </div>
      </section>

      {/* ──────── VIDEO SECTION ──────── */}
      <section className="px-5 md:px-8 py-16 md:py-24 bg-warm-gray">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark text-center mb-3">
              See what we've built
            </h2>
            <p className="text-muted text-base md:text-lg text-center max-w-xl mx-auto mb-10">
              A quick look at how AI is actually helping real businesses save time, cut costs, and get more done.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <MediaPlaceholder
              label="Highlight Reel Video — 60–90 second overview of client work, interviews, and tools built"
              aspectRatio="16/9"
              isVideo
              className="w-full"
            />
          </FadeIn>
        </div>
      </section>

      {/* ──────── SERVICES PREVIEW ──────── */}
      <section className="px-5 md:px-8 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark mb-3">
              How I can help
            </h2>
            <p className="text-muted text-base md:text-lg mb-10 max-w-lg">
              Whether you need something built, a second opinion, or just want to learn — there's a good starting point for you.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-4">
            {services.map((service, i) => (
              <FadeIn key={service.title} delay={i * 0.08}>
                <Link
                  to={service.to}
                  className="group block bg-warm-gray rounded-2xl p-6 md:p-7 border-l-4 border-accent hover:shadow-lg hover:shadow-dark/5 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <h3 className="font-display font-bold text-lg md:text-xl text-dark mb-2">
                    {service.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    {service.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:text-accent-dark transition-colors">
                    Learn more
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ──────── HOW IT WORKS ──────── */}
      <section className="px-5 md:px-8 py-16 md:py-24 bg-warm-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark text-center mb-12 md:mb-16">
              How it works
            </h2>
          </FadeIn>

          <div className="relative flex flex-col gap-10 md:gap-14">
            <div className="absolute left-[1.6rem] md:left-[2rem] top-12 bottom-12 w-px bg-accent/25" />

            {steps.map((step, i) => (
              <FadeIn key={step.number} delay={i * 0.1}>
                <div className="relative flex gap-5 md:gap-8 items-start">
                  <div className="shrink-0 w-13 h-13 md:w-16 md:h-16 bg-dark rounded-2xl flex items-center justify-center">
                    <span className="font-display font-extrabold text-xl md:text-2xl text-accent leading-none select-none">
                      {step.number}
                    </span>
                  </div>
                  <div className="pt-2">
                    <h3 className="font-display font-bold text-xl md:text-2xl text-dark mb-2">
                      {step.title}
                    </h3>
                    <p className="text-muted text-base leading-relaxed max-w-md">
                      {step.description}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ──────── FINAL CTA ──────── */}
      <section className="px-5 md:px-8 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark mb-4">
              Curious how AI could <span className="text-accent">help you?</span>
            </h2>
            <p className="text-muted text-base md:text-lg mb-8 max-w-md mx-auto">
              Book a free chat and I'll give you an honest idea of where AI can make a difference for your business — no strings attached.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-dark text-white font-semibold text-base px-8 py-4 rounded-full hover:bg-accent transition-colors"
            >
              Let's Chat
              <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
