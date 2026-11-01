import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, Circle, Cloud, FolderOpen, LayoutList, ListChecks, Menu, Plus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { navigate } from '../../utils/navigation';
import './LandingPage.css';

const exampleTasks = [
  { title: 'Make space for the big idea', project: 'Personal', time: '2 H 30M', color: 'purple' },
  { title: 'Put the finishing touches on it', project: 'Studio refresh', time: '4 H 15M', color: 'orange' },
  { title: 'Take a proper screen break', project: 'Personal', time: '6 H 00M', color: 'green' },
];
function PlannerDemo() {
  const [tab, setTab] = useState('Today');
  const [done, setDone] = useState<number[]>([0]);
  const progress = Math.round(done.length / exampleTasks.length * 100);
  return <div className="lp-demo-scene" id="demo">
    <div className="lp-orbit lp-orbit-one" aria-hidden="true" /><div className="lp-orbit lp-orbit-two" aria-hidden="true" />
    <div className="lp-float-note lp-float-clock"><span className="lp-note-dot" />A little clarity goes a long way.</div>
    <div className="lp-planner">
      <div className="lp-demo-bar"><span className="lp-demo-brand"><span>✓</span> todop.</span><span className="lp-example">INTERACTIVE PREVIEW</span><span className="lp-demo-avatar">Y</span></div>
      <div className="lp-demo-layout"><div className="lp-demo-rail" aria-hidden="true"><LayoutList className={tab === 'Today' ? 'selected' : ''} size={18} /><FolderOpen className={tab === 'Projects' ? 'selected' : ''} size={18} /><CalendarDays className={tab === 'Calendar' ? 'selected' : ''} size={18} /><Search size={18} /><span className="lp-rail-bottom"><Circle size={18} /></span></div>
      <div className="lp-demo-content"><div className="lp-demo-heading"><div><span className="lp-micro">A FRESH START</span><h2>Your day, in focus<span>.</span></h2></div><span className="lp-demo-plus" aria-hidden="true"><Plus size={17} /></span></div>
        <div className="lp-demo-tabs" role="tablist" aria-label="Explore the planner preview">{['Today', 'Projects', 'Calendar'].map(item => <button id={`demo-tab-${item}`} aria-controls="demo-panel" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
        <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`}>
        {tab === 'Today' && <div className="lp-demo-tasks">{exampleTasks.map((task, index) => <button key={task.title} className={`lp-demo-task ${done.includes(index) ? 'is-done' : ''}`} aria-pressed={done.includes(index)} onClick={() => setDone(previous => previous.includes(index) ? previous.filter(i => i !== index) : [...previous, index])}><span className="lp-demo-check">{done.includes(index) && <Check size={12} strokeWidth={3} />}</span><span className="lp-task-info"><strong>{task.title}</strong><small><span className={`lp-dot ${task.color}`} />{task.project}</small></span><span className="lp-task-time">{done.includes(index) ? <CheckCheck size={15} /> : task.time}</span></button>)}</div>}
        {tab === 'Projects' && <div className="lp-demo-projects">{['Studio refresh', 'Personal', 'The next big thing'].map((name, i) => <div key={name}><span className={`lp-project-icon project-${i}`}><FolderOpen size={18} /></span><strong>{name}</strong><small>{i + 2} ideas taking shape</small><span className="lp-project-line"><i style={{ width: `${30 + i * 25}%` }} /></span></div>)}</div>}
        {tab === 'Calendar' && <div className="lp-demo-calendar"><div><ChevronLeft size={14} /><strong>A little perspective</strong><ChevronRight size={14} /></div><div className="lp-calendar-cells">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <small key={i}>{d}</small>)}{Array.from({ length: 21 }, (_, i) => <span className={[3, 7, 10, 15].includes(i) ? 'has-plan' : ''} key={i}>{i + 1}{[3, 7, 10, 15].includes(i) && <i />}</span>)}</div></div>}
        </div>
        <div className="lp-demo-progress"><div><span>Small steps. Real progress.</span><strong aria-live="polite">{done.length} of 3 done</strong></div><div className="lp-progress-track"><span style={{ width: `${progress}%` }} /></div></div>
      </div></div>
    </div>
    <div className="lp-float-note lp-float-done"><span className="lp-done-icon"><Check size={18} /></span><div><strong>{done.length === 3 ? 'Look at you go.' : 'One thing at a time.'}</strong><small>That’s how good days happen.</small></div><Sparkles size={16} /></div>
    <span className="lp-demo-caption">A sample day. Tap a task. Feel the progress.</span>
  </div>;
}

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
    <header className="lp-header"><a className="lp-logo" href="/" aria-label="Todop home"><span><Check size={22} strokeWidth={3} /></span>todop<span className="lp-logo-period">.</span></a>
      <nav className={menuOpen ? 'lp-nav is-open' : 'lp-nav'} aria-label="Main navigation"><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#your-space" onClick={() => setMenuOpen(false)}>Your space</a><a href="#features" onClick={() => setMenuOpen(false)}>The little details</a></nav>
      <button className="lp-signin" onClick={() => navigate(signedIn ? '/app' : '/auth')}>{signedIn ? 'Open planner' : 'Sign in'}<ArrowUpRight size={17} /></button><button className="lp-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X /> : <Menu />}</button>
    </header>
    <main id="landing-main">
      <section className="lp-hero"><div className="lp-hero-copy"><p className="lp-eyebrow"><span /> A LITTLE STRUCTURE. A LOT MORE SPACE.</p><h1>Less in your head.<br />More in <em>your day.</em><svg className="lp-underline" viewBox="0 0 280 15" aria-hidden="true"><path d="M4 10 Q120 -5 276 8" /></svg></h1><p className="lp-hero-description">Big plans. Small tasks. That thing you almost forgot.<br className="lp-desktop-break" /> Give it all a home, and give yourself a little breathing room.</p><div className="lp-hero-actions"><button className="lp-button lp-button-dark" onClick={start}>Find your focus <ArrowUpRight size={18} /></button><a className="lp-demo-link" href="#demo">Take a little look <ArrowDown size={16} /></a></div><p className="lp-hero-footnote"><span className="lp-tiny-check"><Check size={11} /></span> Your plans. Your pace. A calmer kind of productive.</p></div><PlannerDemo /></section>
      <div className="lp-usecases"><span>ROOM FOR EVERY PART OF LIFE</span><p>Work in progress <i>✳</i> Side projects <i>✳</i> Everyday things <i>✳</i> Whatever’s next</p></div>
      <section className="lp-section lp-how lp-reveal" id="how-it-works"><div className="lp-section-top"><div><p className="lp-eyebrow">FROM “I SHOULD” TO “IT’S DONE”</p><h2>A clearer day starts<br />with a <em>smaller step.</em></h2></div><p>You bring the ambition.<br />Todop gives it a place to land.</p></div><div className="lp-steps">
        <article><div className="lp-step-art lp-capture"><div><Plus size={16} /><span>Get that idea out of your head</span><span className="lp-input-caret" /></div><span className="lp-art-tag"><ListChecks size={13} /> One task. A good start.</span></div><span className="lp-step-number">01 / GET IT DOWN</span><h3>Make a little room.</h3><p>Capture a task, add the details, and break the big things into smaller subtasks. Start wherever you are.</p></article>
        <article><div className="lp-step-art lp-organize"><div><span className="lp-mini-folder"><FolderOpen size={20} /></span><strong>The next big thing</strong><span className="lp-organize-line" /><span className="lp-organize-line short" /><span className="lp-organize-chip">3 things moving forward <ArrowRight size={12} /></span></div><span className="lp-organize-sticker">a place for it all ↗</span></div><span className="lp-step-number">02 / FIND ITS PLACE</span><h3>A plan that makes sense.</h3><p>Give related tasks a project. Add deadlines when they matter, or leave room for ideas that need a little time.</p></article>
        <article><div className="lp-step-art lp-finish"><div className="lp-completion-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" /></svg><Check size={33} strokeWidth={2} /></div><span className="lp-finish-spark">✳</span><span className="lp-finish-note">That’s one less thing.</span></div><span className="lp-step-number">03 / KEEP MOVING</span><h3>Notice the progress.</h3><p>Watch deadlines count down, check things off, and find your finished work in the archive. Every small win counts.</p></article>
      </div></section>
      <section className="lp-space lp-reveal" id="your-space"><div className="lp-space-visual" aria-hidden="true"><div className="lp-space-grid" /><div className="lp-window lp-window-calendar"><div className="lp-window-label"><CalendarDays size={15} /> A LITTLE PERSPECTIVE</div><div className="lp-mini-week">{'MTWTFSS'.split('').map((d, i) => <span key={i}>{d}</span>)}</div><div className="lp-mini-week lp-mini-dates">{[12,13,14,15,16,17,18].map(d => <span className={d === 14 ? 'highlight' : ''} key={d}>{d}</span>)}</div><div className="lp-calendar-event"><span />Make time for the good stuff</div></div><div className="lp-window lp-window-search"><Search size={18} /><span>That idea from last week…</span><span className="lp-keycap">↵</span></div><div className="lp-window lp-window-project"><FolderOpen size={23} /><span><strong>A space for every project.</strong><small>The big plans and the little ones.</small></span><ArrowUpRight size={19} /></div><div className="lp-space-star">✳</div></div><div className="lp-space-copy"><p className="lp-eyebrow">ONE PLANNER. THE WHOLE PICTURE.</p><h2>Your plans.<br />A little more<br /> <em>perspective.</em></h2><p>Some days need a list. Others need the bigger picture. Move between your upcoming tasks, projects, and calendar without losing your train of thought.</p><ul><li><CalendarDays size={17} /><span>See your deadlines in a monthly calendar.</span></li><li><Search size={17} /><span>Find active and completed tasks in a moment.</span></li><li><FolderOpen size={17} /><span>Keep every project in its own little world.</span></li></ul><button className="lp-text-link" onClick={() => navigate('/app')}>Explore the planner <ArrowUpRight size={18} /></button></div></section>
      <section className="lp-section lp-details lp-reveal" id="features"><div className="lp-section-top"><div><p className="lp-eyebrow">THOUGHTFUL BY DESIGN</p><h2>The little things.<br /><em>They make a difference.</em></h2></div><p>Less friction between<br />you and what matters.</p></div><div className="lp-detail-grid"><article><Cloud size={25} /><h3>Pick up where you left off.</h3><p>Sign in for a private cloud workspace across devices. Your tasks, projects, and preferences travel together.</p></article><article><ShieldCheck size={25} /><h3>A little peace of mind.</h3><p>Prefer to keep it local? Use the device planner offline. Export a backup whenever you want a copy of your own.</p></article><article><Sparkles size={25} /><h3>Make yourself at home.</h3><p>Light or dark. A text size that feels right. A quiet space you can make your own, right down to the details.</p></article></div></section>
      <section className="lp-cta lp-reveal"><span className="lp-cta-spark" aria-hidden="true">✳</span><p className="lp-eyebrow">A FRESH PAGE IS A GOOD PLACE TO START</p><h2>Make space for<br /><em>what’s next.</em></h2><button className="lp-button lp-button-dark" onClick={start}>Let’s make a little progress <ArrowUpRight size={18} /></button><button className="lp-cta-local" onClick={() => navigate('/app')}>Or try it on this device. No account needed. <ArrowRight size={14} /></button></section>
    </main><footer className="lp-footer"><a className="lp-logo" href="/" aria-label="Todop home"><span><Check size={19} strokeWidth={3} /></span>todop.</a><p>A little direction for your everyday.</p><button className="lp-motion" aria-pressed={!motion} onClick={() => setMotion(v => !v)}>{motion ? 'Pause motion' : 'Play motion'}<span className={motion ? 'is-on' : ''} /></button><span>One thing at a time. © {new Date().getFullYear()} Todop</span></footer>
  </div>;
}
