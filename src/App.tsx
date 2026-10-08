import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  bracket,
  clubs,
  fixtures,
  resolveClub,
  standings,
  tonight,
  type Match,
} from './data/competition'

type View = 'home' | 'tonight' | 'path' | 'clubs'

const views: View[] = ['home', 'tonight', 'path', 'clubs']

function viewFromHash(): View {
  const raw = window.location.hash.replace('#', '') as View
  return views.includes(raw) ? raw : 'home'
}

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function CrestMark({ onHero }: { onHero?: boolean }) {
  const stroke = onHero ? '#E8C547' : '#0B5F3A'
  const fill = onHero ? '#E8C547' : '#0B5F3A'
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M32 10 L48 22 V42 L32 54 L16 42 V22 Z"
        stroke={stroke}
        strokeWidth="3"
        fill="none"
      />
      <circle cx="32" cy="32" r="6" fill={fill} />
    </svg>
  )
}

function Nav({
  view,
  setView,
}: {
  view: View
  setView: (v: View) => void
}) {
  const links: { id: View; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'tonight', label: 'Tonight' },
    { id: 'path', label: 'Path' },
    { id: 'clubs', label: 'Clubs' },
  ]

  return (
    <header className={`topnav ${view === 'home' ? 'on-hero' : ''}`}>
      <button className="brand-mark" onClick={() => setView('home')} type="button">
        <CrestMark onHero={view === 'home'} />
        <span>PINNACLE</span>
      </button>
      <nav className="nav-links" aria-label="Primary">
        {links.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-current={view === l.id ? 'page' : undefined}
            onClick={() => setView(l.id)}
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

function Hero({ go }: { go: (v: View) => void }) {
  return (
    <section className="hero" aria-label="PINNACLE home">
      <div className="hero-visual" />
      <div className="hero-pitch-lines" aria-hidden />
      <div className="hero-flood" aria-hidden />
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="hero-brand">
          PINN<em>ACLE</em>
        </h1>
        <p className="hero-lead">
          Europe&apos;s elite clubs. One road from the group nights to the final under the lights.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={() => go('tonight')}>
            Watch tonight
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => go('path')}>
            Open the path
          </button>
        </div>
      </motion.div>
      <div className="scroll-hint">Match night</div>
    </section>
  )
}

function Scoreline({ match }: { match: Match }) {
  const home = resolveClub(match.homeId)
  const away = resolveClub(match.awayId)
  const live = match.status === 'live'

  return (
    <div className="live-feature">
      {live && (
        <div className="live-badge">
          <span className="live-dot" />
          Live · {match.minute}&prime;
        </div>
      )}
      {!live && (
        <div className="live-badge" style={{ color: 'var(--mist)' }}>
          {match.status === 'upcoming' ? 'Upcoming' : 'Full time'} · {match.kickoff}
        </div>
      )}
      <div className="match-scoreline">
        <div className="club-side">
          <div className="short">{home.short}</div>
          <div className="name">{home.name}</div>
        </div>
        <div className="score-block">
          <div className="score">
            {match.homeScore ?? '–'}–{match.awayScore ?? '–'}
          </div>
          <div className="meta">{match.round}</div>
        </div>
        <div className="club-side away">
          <div className="short">{away.short}</div>
          <div className="name">{away.name}</div>
        </div>
      </div>
      <div className="match-meta">
        <span>{match.venue}</span>
        <span>{match.kickoff}</span>
      </div>
      {match.events && match.events.length > 0 && (
        <div className="events">
          {match.events.map((e) => (
            <span key={e}>{e}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function TonightView() {
  const feature = tonight.find((m) => m.status === 'live') ?? tonight[0]
  const rest = fixtures.filter((m) => m.id !== feature.id)

  return (
    <div className="page">
      <div className="page-head">
        <h2>Tonight under the lights</h2>
        <p>Quarter-final first legs — scores, kickoffs, and the nights that decide the path.</p>
      </div>
      <Scoreline match={feature} />
      <hr className="section-rule" />
      <div className="fixture-list">
        {rest.map((m) => {
          const home = resolveClub(m.homeId)
          const away = resolveClub(m.awayId)
          return (
            <article className="fixture-row" key={m.id}>
              <div className="kick">
                {m.round} · {m.kickoff}
                {m.status === 'live' && <span className="status-chip">Live</span>}
              </div>
              <div className="home">{home.name}</div>
              <div className={`center ${m.status === 'upcoming' ? 'vs' : ''}`}>
                {m.status === 'upcoming'
                  ? 'VS'
                  : `${m.homeScore ?? 0}–${m.awayScore ?? 0}`}
              </div>
              <div className="away">{away.name}</div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function PathView() {
  const rounds: Array<'R16' | 'QF' | 'SF' | 'Final'> = ['R16', 'QF', 'SF', 'Final']
  const labels = {
    R16: 'Round of 16',
    QF: 'Quarter-finals',
    SF: 'Semi-finals',
    Final: 'The Final',
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Path to the final</h2>
        <p>From the last sixteen to one night in May — every tie that still matters.</p>
      </div>
      <div className="bracket-grid">
        {rounds.map((round) => (
          <section className="bracket-round" key={round}>
            <h3>{labels[round]}</h3>
            <div className="tie-list">
              {bracket
                .filter((t) => t.round === round)
                .map((t) => {
                  const home = resolveClub(t.homeId)
                  const away = resolveClub(t.awayId)
                  const decided = Boolean(t.winnerId)
                  return (
                    <div className="tie" key={t.id}>
                      <div
                        className={`team ${
                          t.winnerId === t.homeId
                            ? 'winner'
                            : decided
                              ? 'muted'
                              : ''
                        }`}
                      >
                        {home.name}
                      </div>
                      <div className="agg">
                        {decided
                          ? `${t.homeAgg}–${t.awayAgg}`
                          : t.homeId === 'tba'
                            ? '—'
                            : 'vs'}
                      </div>
                      <div
                        className={`team right ${
                          t.winnerId === t.awayId
                            ? 'winner'
                            : decided
                              ? 'muted'
                              : ''
                        }`}
                      >
                        {away.name}
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        ))}
      </div>
      <p className="path-note">
        PINNACLE tracks the road as it unfolds — aggregates, venues, and who still has a claim
        on Europe&apos;s biggest night.
      </p>
    </div>
  )
}

function ClubsView() {
  return (
    <div className="page">
      <div className="page-head">
        <h2>The clubs still standing</h2>
        <p>League-phase form that carried Europe&apos;s strongest sides into the knockout rounds.</p>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Club</th>
            <th className="num">P</th>
            <th className="num">W</th>
            <th className="num">D</th>
            <th className="num">L</th>
            <th className="num">GD</th>
            <th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const club = resolveClub(row.clubId)
            return (
              <tr key={row.clubId}>
                <td>
                  <div className="club-cell">
                    <span className="crest" style={{ background: club.color }} />
                    <span>
                      {i + 1}. {club.name}
                    </span>
                  </div>
                </td>
                <td className="num">{row.played}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.drawn}</td>
                <td className="num">{row.lost}</td>
                <td className="num">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                <td className="num">
                  <strong>{row.pts}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="club-grid">
        {clubs.slice(0, 8).map((c) => (
          <div className="club-item" key={c.id} style={{ borderColor: c.color === '#FFFFFF' || c.color === '#FDE100' ? 'var(--ink)' : c.color }}>
            <div className="club-name">{c.name}</div>
            <div className="club-meta">
              {c.city} · {c.country}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>PINNACLE</strong> — invented companion for Europe&apos;s elite club nights.
      </div>
      <div>Not affiliated with UEFA. Demo scores for illustration.</div>
    </footer>
  )
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' ? viewFromHash() : 'home',
  )

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: View) => {
    setView(next)
    const hash = next === 'home' ? '' : `#${next}`
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash || window.location.pathname)
    }
  }

  return (
    <div className="app">
      <Nav view={view} setView={go} />
      <AnimatePresence mode="wait">
        <motion.main
          key={view}
          {...fade}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === 'home' && <Hero go={go} />}
          {view === 'tonight' && <TonightView />}
          {view === 'path' && <PathView />}
          {view === 'clubs' && <ClubsView />}
        </motion.main>
      </AnimatePresence>
      {view !== 'home' && <Footer />}
    </div>
  )
}
