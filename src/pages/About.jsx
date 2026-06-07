import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import MediaPlaceholder from '../components/MediaPlaceholder'

export default function About() {
  return (
    <>
      {/* Header + Photo */}
      <section className="px-5 md:px-10 lg:px-20 pt-12 pb-16 md:pt-28 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:gap-20">
            {/* Photo */}
            <FadeIn className="md:w-5/12 mb-10 md:mb-0">
              <MediaPlaceholder
                label="Photo of Ollie"
                aspectRatio="3/4"
                className="max-w-xs mx-auto md:max-w-none md:sticky md:top-24"
              />
            </FadeIn>

            {/* Text */}
            <div className="md:w-7/12">
              <FadeIn>
                <h1 className="font-display font-extrabold text-4xl md:text-6xl text-dark mb-8">
                  About me
                </h1>
              </FadeIn>

              <div className="space-y-6 text-muted text-base md:text-lg leading-relaxed">
                <FadeIn delay={0.05}>
                  <p>
                    I got into AI before most people knew what to do with it. Not because of some grand plan — just genuine curiosity about what these tools could actually do for real people.
                  </p>
                </FadeIn>
                <FadeIn delay={0.1}>
                  <p>
                    What I found was that most businesses weren't using it, not because it wasn't useful, but because nobody was explaining it in plain language. Everything was either too technical, too expensive, or too vague. So I started doing that — showing people what was actually possible, practically, without the hype.
                  </p>
                </FadeIn>
                <FadeIn delay={0.15}>
                  <p>
                    I'm 18, based on the North Shore in Sydney, and I've already helped local businesses replace expensive software, reconnect with lost clients, and save hours of admin every week.
                  </p>
                </FadeIn>
                <FadeIn delay={0.2}>
                  <p>
                    Now I build custom tools for businesses, run consulting sessions, and teach people how to use AI in their day-to-day work. Some of my clients are gym owners. Some run schools. Some are just curious people who want to keep up with the world.
                  </p>
                </FadeIn>
                <FadeIn delay={0.25}>
                  <p>
                    I work with businesses across Sydney's North Shore in person, and with clients everywhere else remotely. Whether it's a face-to-face session at your office or a video call — it works the same.
                  </p>
                </FadeIn>
                <FadeIn delay={0.3}>
                  <p>
                    If you're curious about what AI could do for you, let's have a chat. No pressure, no jargon — just a conversation.
                  </p>
                </FadeIn>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 md:px-10 lg:px-20 py-20 md:py-36 bg-warm-gray">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <h2 className="font-display font-extrabold text-3xl md:text-5xl text-dark mb-4">
              Let's have a chat
            </h2>
            <p className="text-muted text-base md:text-lg mb-8 max-w-md mx-auto">
              Whether you've got a specific idea or you're just exploring — I'm happy to talk it through.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-dark text-white font-semibold text-base px-8 py-4 rounded-full hover:bg-accent transition-colors"
            >
              Let's Have a Chat
              <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
