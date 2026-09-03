import Link from 'next/link'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import styles from './home.module.css'
import { AuthHashForwarder } from '@/components/auth/AuthHashForwarder'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-dm-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], style: ['italic'], variable: '--font-playfair' })

const PUBLIC_SITE = 'https://theprhub.com.au'

function ArrowIcon({ stroke = 'var(--color-accent-mint-bright)' }: { stroke?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export default function HomePage() {
  return (
    <main className={`${styles.page} ${dmSans.variable} ${playfair.variable}`}>
      <AuthHashForwarder />
      {/* ═══ HEADER ═══ */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoPr}>pr</span>
            <span>hub.</span>
          </div>
          <div className={styles.brandMeta}>
            <span className={styles.brandName}>The PR Hub</span>
            <span className={styles.brandOs}>COMPANY OS</span>
          </div>
        </div>
        <Link href="/admin" className={styles.btnBlack}>
          <span>SIGN IN</span>
          <ArrowIcon />
        </Link>
      </header>

      {/* ═══ HERO ═══ */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          <span>INTERNAL OPERATIONS PLATFORM</span>
        </div>
        <h1 className={styles.heroTitle}>PR &amp; Comms for thought leaders, disruptors and high&#8209;growth brands</h1>
        <p className={styles.heroSub}>
          The single sign-in for everyone behind The PR Hub — the agency building profile, raising awareness and accelerating growth for entrepreneurs and business leaders.
        </p>
        <div className={styles.heroChips}>
          <span className={styles.heroChip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-mint-bright)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <span>RLS-SECURED SUPABASE</span>
          </span>
          <span className={styles.heroChip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-mint-bright)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span>ONE ACCOUNT, ONE DOOR</span>
          </span>
          <span className={styles.heroChip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-mint-bright)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            <span>CONFIDENTIAL BY DESIGN</span>
          </span>
        </div>
      </section>

      {/* ═══ THREE DOORS ═══ */}
      <section className={styles.doors}>
        <div className={styles.door}>
          <span className={styles.doorTag}>PR HUB STAFF</span>
          <h2 className={styles.doorTitle}>Admin Console</h2>
          <p className={styles.doorDesc}>Run the agency. Clients, campaigns, media coverage, content and reporting — all in one place.</p>
          <Link href="/admin" className={styles.btnBlack}>
            <span>ENTER ADMIN CONSOLE</span>
            <ArrowIcon />
          </Link>
          <span className={styles.doorHelp}>
            Staff access only. <a href="mailto:hello@theprhub.com.au">Trouble signing in?</a>
          </span>
        </div>

        <div className={styles.door}>
          <span className={styles.doorTag}>INTERNAL TEAM</span>
          <h2 className={styles.doorTitle}>Team Workspace</h2>
          <p className={styles.doorDesc}>For PR Hub publicists, writers and account managers. Your clients, coverage targets and day-to-day tools.</p>
          <Link href="/team" className={styles.btnOutline}>
            <span>ENTER TEAM WORKSPACE</span>
            <ArrowIcon stroke="var(--color-primary-dark)" />
          </Link>
          <span className={styles.doorHelp}>
            Invited team members. <a href="mailto:hello@theprhub.com.au">Get help</a>
          </span>
        </div>

        <div className={`${styles.door} ${styles.doorMint}`}>
          <span className={styles.doorTag}>CLIENTS</span>
          <h2 className={styles.doorTitle}>Client Portal</h2>
          <p className={styles.doorDesc}>For PR Hub clients: your campaigns, coverage reports, media opportunities and approvals.</p>
          <Link href="/portal" className={styles.btnBlack}>
            <span>ENTER CLIENT PORTAL</span>
            <ArrowIcon />
          </Link>
          <span className={styles.doorHelp}>
            New client? <a href={PUBLIC_SITE}>Talk to The PR Hub</a>
          </span>
        </div>
      </section>

      {/* ═══ WHAT MAKES THE PR HUB UNIQUE ═══ */}
      <section className={styles.unique}>
        <div className={styles.uniqueHeader}>
          <span className={styles.uniqueLabel}>WHAT MAKES THE PR HUB UNIQUE</span>
          <h2 className={styles.uniqueTitle}>Strategy first. No fluff.</h2>
          <p className={styles.uniqueSub}>The same approach clients rely on, now running the platform behind the scenes.</p>
        </div>
        <div className={styles.uniqueGrid}>
          <div className={styles.uniqueItem}>
            <h3 className={styles.uniqueItemTitle}>Strategy</h3>
            <p className={styles.uniqueItemBody}>We understand your business before planning the campaign — communications built around where you&apos;re going, not just what&apos;s news today.</p>
          </div>
          <div className={styles.uniqueItem}>
            <h3 className={styles.uniqueItemTitle}>Agility</h3>
            <p className={styles.uniqueItemBody}>Agility, flexibility, confidentiality and speed — crucial when deadlines are tight and the story is moving.</p>
          </div>
          <div className={styles.uniqueItem}>
            <h3 className={styles.uniqueItemTitle}>Results</h3>
            <p className={styles.uniqueItemBody}>Coverage across Tier 1 business media, TV, radio and trade — work that leads to business results and new leads, not just clippings.</p>
          </div>
        </div>
      </section>

      {/* ═══ QUOTE BAND ═══ */}
      <section className={styles.quote}>
        <blockquote className={styles.quoteText}>
          &ldquo;The PR Hub are strategic and understand the importance of building a founder&rsquo;s profile and their brand. They are resourceful, driven and incredibly hard working. There is no fluff.&rdquo;
        </blockquote>
        <span className={styles.quoteAttr}>TARYN WILLIAMS, CEO &amp; FOUNDER | THE RIGHT FIT &amp; WINK MODELS</span>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className={styles.footer}>
        <nav className={styles.footerLinks}>
          <a href={PUBLIC_SITE}>PUBLIC SITE</a>
          <a href={`${PUBLIC_SITE}/who-we-are/`}>WHO WE ARE</a>
          <a href={`${PUBLIC_SITE}/contact/`}>CONTACT</a>
        </nav>
        <div className={styles.footerMeta}>
          <a href="tel:+61294230195">+61 2 9423 0195</a>
          <a href="mailto:hello@theprhub.com.au">hello@theprhub.com.au</a>
          <span>© 2026 The PR Hub · Sydney NSW</span>
        </div>
      </footer>
    </main>
  )
}
