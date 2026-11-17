import { BrandLogo } from '../common/BrandLogo';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, Cloud, Flag, FolderOpen, ListChecks, Menu, Plus, Search, Target, Repeat2, RotateCcw, UsersRound, X } from 'lucide-react';
import { navigate } from '../../utils/navigation';
import { PlannerPreview } from './PlannerPreview';
import './LandingPage.css';

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [motion, setMotion] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!media.matches);
    update(); media.addEventListener('change', update);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('lp-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    root.current?.querySelectorAll('.lp-reveal').forEach(el => observer.observe(el));
    return () => { media.removeEventListener('change', update); observer.disconnect(); };
  }, []);
  const start = () => navigate(signedIn ? '/app' : '/auth?mode=signup');
  return <div ref={root} className={`landing-page ${motion ? '' : 'lp-still'}`}>
    <a className="lp-skip" href="#landing-main">Skip to content</a>
    <header className="lp-header"><a className="lp-logo" href="/" aria-label="Todop home"><BrandLogo /></a>
      <nav className={menuOpen ? 'lp-nav is-open' : 'lp-nav'} aria-label="Main navigation"><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#your-space" onClick={() => setMenuOpen(false)}>Your space</a><a href="#features" onClick={() => setMenuOpen(false)}>The little details</a></nav>
      <button className="lp-signin" onClick={() => navigate(signedIn ? '/app' : '/auth')}>{signedIn ? 'Open planner' : 'Sign in'}<ArrowUpRight size={17} /></button><button className="lp-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X /> : <Menu />}</button>
    </header>
    <main id="landing-main">
      <section className="lp-hero"><div className="lp-hero-copy"><p className="lp-eyebrow"><span /> A LITTLE STRUCTURE. A LOT MORE SPACE.</p><h1>Less in your head.<br />More in <em>your day.</em><svg className="lp-underline" viewBox="0 0 280 15" aria-hidden="true"><path d="M4 10 Q120 -5 276 8" /></svg></h1><p className="lp-hero-description">Plan your day, track project milestones, and share a workspace with your team. Keep working on your personal tasks offline.</p><div className="lp-hero-actions"><button className="lp-button lp-button-dark" onClick={start}>Find your focus <ArrowUpRight size={18} /></button><a className="lp-demo-link" href="#demo">Take a little look <ArrowDown size={16} /></a></div><p className="lp-hero-footnote"><span className="lp-tiny-check"><Check size={11} /></span> Your plans. Your pace. A calmer kind of productive.</p></div><PlannerPreview signedIn={signedIn} /></section>
      <div className="lp-usecases"><span>ROOM FOR EVERY PART OF LIFE</span><p>Work in progress <i>✳</i> Side projects <i>✳</i> Everyday things <i>✳</i> Whatever’s next</p></div>
      <section className="lp-section lp-how lp-reveal" id="how-it-works"><div className="lp-section-top"><div><p className="lp-eyebrow">FROM “I SHOULD” TO “IT’S DONE”</p><h2>A clearer day starts<br />with a <em>smaller step.</em></h2></div><p>You bring the ambition.<br />Todop gives it a place to land.</p></div><div className="lp-steps">
        <article><div className="lp-step-art lp-capture"><div><Plus size={16} /><span>Get that idea out of your head</span><span className="lp-input-caret" /></div><span className="lp-art-tag"><ListChecks size={13} /> One task. A good start.</span></div><span className="lp-step-number">01 / GET IT DOWN</span><h3>Make a little room.</h3><p>Capture a task, add the details, and break the big things into smaller subtasks. Start wherever you are.</p></article>
        <article><div className="lp-step-art lp-organize"><div><span className="lp-mini-folder"><FolderOpen size={20} /></span><strong>The next big thing</strong><span className="lp-organize-line" /><span className="lp-organize-line short" /><span className="lp-organize-chip">3 things moving forward <ArrowRight size={12} /></span></div><span className="lp-organize-sticker">a place for it all ↗</span></div><span className="lp-step-number">02 / FIND ITS PLACE</span><h3>A plan that makes sense.</h3><p>Give related tasks a project. Add deadlines when they matter, or leave room for ideas that need a little time.</p></article>
        <article><div className="lp-step-art lp-finish"><div className="lp-completion-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" /></svg><Check size={33} strokeWidth={2} /></div><span className="lp-finish-spark">✳</span><span className="lp-finish-note">That’s one less thing.</span></div><span className="lp-step-number">03 / KEEP MOVING</span><h3>Notice the progress.</h3><p>Watch deadlines count down, check things off, and find your finished work in the archive. Every small win counts.</p></article>
      </div></section>
      <section className="lp-space lp-reveal" id="your-space"><div className="lp-space-visual" aria-hidden="true"><div className="lp-space-grid" /><div className="lp-window lp-window-calendar"><div className="lp-window-label"><CalendarDays size={15} /> A LITTLE PERSPECTIVE</div><div className="lp-mini-week">{'MTWTFSS'.split('').map((d, i) => <span key={i}>{d}</span>)}</div><div className="lp-mini-week lp-mini-dates">{[12,13,14,15,16,17,18].map(d => <span className={d === 14 ? 'highlight' : ''} key={d}>{d}</span>)}</div><div className="lp-calendar-event"><span />Make time for the good stuff</div></div><div className="lp-window lp-window-search"><Search size={18} /><span>That idea from last week…</span><span className="lp-keycap">↵</span></div><div className="lp-window lp-window-project"><FolderOpen size={23} /><span><strong>A space for every project.</strong><small>The big plans and the little ones.</small></span><ArrowUpRight size={19} /></div><div className="lp-space-star">✳</div></div><div className="lp-space-copy"><p className="lp-eyebrow">ONE PLANNER. THE WHOLE PICTURE.</p><h2>Your plans.<br />A little more<br /> <em>perspective.</em></h2><p>Some days need a list. Others need the bigger picture. Move between your upcoming tasks, projects, and calendar without losing your train of thought.</p><ul><li><CalendarDays size={17} /><span>See your deadlines in a monthly calendar.</span></li><li><Search size={17} /><span>Find active and completed tasks in a moment.</span></li><li><FolderOpen size={17} /><span>Keep every project in its own little world.</span></li></ul><button className="lp-text-link" onClick={() => navigate('/demo')}>Try the full demo <ArrowUpRight size={18} /></button></div></section>
      <section className="lp-section lp-details lp-reveal" id="features" aria-labelledby="landing-features-heading">
        <div className="lp-section-top">
          <h2 id="landing-features-heading">Plan your work.<br /><em>Bring your team along.</em></h2>
        </div>
        <div className="lp-detail-grid">
          <article><Flag size={25} aria-hidden="true" /><h3>Project Roadmaps</h3>
            <p>Set milestones, link prerequisites, and see which deadlines are at risk when a task slips.</p></article>
          <article><UsersRound size={25} aria-hidden="true" /><h3>Shared Workspaces</h3>
            <p>Sign in, invite collaborators, and edit the same projects and roadmaps together. Shared edits need a connection, and your personal planner stays separate.</p></article>
          <article><Cloud size={25} aria-hidden="true" /><h3>Offline editing and sync</h3>
            <p>Open your personal planner online once on each device. Keep editing offline, then sync when Todop is open and back online.</p></article>
          <article><Target size={25} aria-hidden="true" /><h3>Focus with My Day</h3>
            <p>Choose up to three active tasks and give today’s work a place of its own.</p></article>
          <article><Repeat2 size={25} aria-hidden="true" /><h3>Recurring tasks</h3>
            <p>Repeat a task daily, weekly, monthly, or at your own interval. The next occurrence appears when you finish.</p></article>
          <article><RotateCcw size={25} aria-hidden="true" /><h3>Undo and recovery</h3>
            <p>Undo a completion or deletion. Recover deleted tasks and their subtasks for up to 30 days.</p></article>
        </div>
      </section>
      <section className="lp-cta lp-reveal"><span className="lp-cta-spark" aria-hidden="true">✳</span><p className="lp-eyebrow">A FRESH PAGE IS A GOOD PLACE TO START</p><h2>Make space for<br /><em>what’s next.</em></h2><button className="lp-button lp-button-dark" onClick={start}>Let’s make a little progress <ArrowUpRight size={18} /></button><button className="lp-cta-local" onClick={() => navigate('/app')}>Or try it on this device. No account needed. <ArrowRight size={14} /></button></section>
    </main><footer className="lp-footer"><a className="lp-logo" href="/" aria-label="Todop home"><BrandLogo small /></a><p>A little direction for your everyday.</p><button className="lp-motion" aria-pressed={!motion} onClick={() => setMotion(v => !v)}>{motion ? 'Pause motion' : 'Play motion'}<span className={motion ? 'is-on' : ''} /></button><span>One thing at a time. © {new Date().getFullYear()} Todop</span></footer>
  </div>;
}
