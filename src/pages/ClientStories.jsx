import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import MediaPlaceholder from '../components/MediaPlaceholder'

const stories = [
  {
    name: 'Mark',
    context: 'Gym Owner',
    quote: '"Ollie built us a member retention system that does what our old software did — but better and for a fraction of the cost."',
    description:
      'Mark was paying for expensive retention software that half his staff didn\'t know how to use. I built a custom dashboard that tracks member engagement, flags at-risk members automatically, and sends personalised check-ins — all tailored to how his gym actually operates.',
    result: 'Replaced a $400/month subscription with a system that works better and costs almost nothing to run.',
  },
  {
    name: 'Sarah',
    context: 'Business Owner',
    quote: '"We had hundreds of past clients we\'d lost touch with. Ollie set up a system that started reconnecting us automatically."',
    description:
      'Sarah\'s business had years of client data sitting in spreadsheets, doing nothing. I set up an AI-powered follow-up system that re-engages past clients with personalised messages based on their history — without Sarah or her team having to write a single email manually.',
    result: 'Within weeks, old clients were booking again. Revenue from returning clients increased significantly in the first month.',
  },
  {
    name: 'Northside Academy',
    context: 'School',
    quote: '"Our enrollment process was buried in spreadsheets and manual emails. Ollie streamlined the whole thing."',
    description:
      'The admin team at Northside Academy was spending hours every week on enrollment paperwork, follow-up emails, and tracking applications across multiple spreadsheets. I built a unified system that handles applications, sends automated follow-ups, and gives the team a clear view of every student\'s status.',
    result: 'Admin time on enrollment dropped by around 60%, freeing the team to focus on the students instead of paperwork.',
  },
]

export default function ClientStories() {
  return (
    <>
      {/* Header */}
      <section className="px-5 md:px-10 lg:px-20 pt-12 pb-8 md:pt-28 md:pb-16">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl text-dark mb-4">
              Client Stories
            </h1>
            <p className="text-muted text-lg md:text-xl leading-relaxed max-w-xl">
              Real businesses, real results. Here's what it looks like when AI is done practically.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Stories */}
      <section className="px-5 md:px-10 lg:px-20 pb-16 md:pb-32">
        <div className="max-w-7xl mx-auto flex flex-col gap-16 md:gap-24">
          {stories.map((story, i) => (
            <FadeIn key={story.name} delay={i * 0.05}>
              <article className="flex flex-col md:flex-row md:items-start md:gap-20">
                <div className="md:w-1/2 mb-6 md:mb-0">
                  <MediaPlaceholder
                    label={`Client Interview — ${story.name}, ${story.context}`}
                    aspectRatio="16/9"
                    isVideo
                    className="w-full"
                  />
                </div>
                <div className="md:w-1/2">
                  <p className="text-accent text-xs font-bold uppercase tracking-widest mb-1">
                    {story.context}
                  </p>
                  <h2 className="font-display font-extrabold text-2xl md:text-3xl text-dark mb-4">
                    {story.name}
                  </h2>
                  <blockquote className="text-dark text-base md:text-lg leading-relaxed mb-4 italic">
                    {story.quote}
                  </blockquote>
                  <p className="text-muted text-base leading-relaxed mb-4">
                    {story.description}
                  </p>
                  <p className="text-dark text-base leading-relaxed font-semibold">
                    {story.result}
                  </p>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 md:px-10 lg:px-20 py-20 md:py-36 bg-warm-gray">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark mb-4">
              Want results like these?
            </h2>
            <p className="text-muted text-base md:text-lg mb-8 max-w-md mx-auto">
              Every project starts with a free conversation. No commitment, no pressure — just an honest chat about what's possible.
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
