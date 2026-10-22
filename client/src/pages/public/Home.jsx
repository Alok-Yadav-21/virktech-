import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import ProductCard, { ProductCardSkeleton } from '../../components/ui/ProductCard'
import { Chip, ErrorState, SectionHead } from '../../components/ui/primitives'
import { CATEGORY_IMAGES, REPAIR_ISSUES } from '../../constants'

const STEPS = [
  ['Book online', 'Tell us what is wrong and pick your branch. It takes about a minute.'],
  ['Drop it off or post it', 'We check it over and send you a price. Nothing is done until you say yes.'],
  ['Approve, then collect', 'Track every step on your phone and pay when you collect.'],
]

function Rail({ children, loading, error, retry }) {
  if (error) return <ErrorState onRetry={retry}>We could not load this just now.</ErrorState>
  return (
    <div className="vt-rail">
      {loading
        ? Array.from({ length: 4 }, (_, i) => <div key={i} className="vt-productwrap"><ProductCardSkeleton /></div>)
        : children}
    </div>
  )
}

export default function Home() {
  const { branch, branches, openPicker } = useBranch()
  const navigate = useNavigate()
  const [postcode, setPostcode] = useState('')
  const products = useFetch('/products')
  const categories = useFetch('/categories')

  const list = products.data || []
  const deals = list.filter((p) => p.wasPrice > p.price).sort((a, b) => b.wasPrice / b.price - a.wasPrice / a.price).slice(0, 8)
  const refurb = list.filter((p) => p.condition === 'Refurbished').slice(0, 8)
  const count = branches.length

  const findBranch = (e) => {
    e.preventDefault()
    navigate(`/branches?postcode=${encodeURIComponent(postcode.trim())}`)
  }

  return (
    <>
      <section className="vt-hero" aria-labelledby="hero-title">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <button type="button" className="vt-hero-branch vt-rise" onClick={openPicker}>
                <Icon name="pin" size={18} />
                {branch ? <>Collecting from <strong>{branch.area}</strong></> : 'Choose your branch'}
                <Icon name="down" size={16} />
              </button>
              <h1 id="hero-title" className="vt-hero-title vt-rise vt-rise-2">Fix it, buy it, sell it.</h1>
              <p className="vt-hero-sub vt-rise vt-rise-2">
                Phone and laptop repairs, refurbished devices and trade-ins{count ? ` at ${count} branches` : ' at branches'} across south-east London and Kent.
              </p>
              <div className="row g-2 g-md-3 vt-rise vt-rise-3" style={{ maxWidth: '26rem' }}>
                <div className="col-6"><Link to="/app/book" className="btn btn-lime btn-lg w-100 px-2">Book a repair</Link></div>
                <div className="col-6"><Link to="/shop" className="btn btn-light btn-lg w-100 px-2">Shop devices</Link></div>
              </div>
            </div>
            <div className="col-lg-6 vt-rise vt-rise-3">
              <div className="vt-hero-img">
                <img src="/img/hero-laptop.jpg" alt="A technician's hands replacing a component inside an open laptop" width="1200" height="900" fetchpriority="high" />
                <div className="vt-hero-note">
                  <Icon name="shield" size={22} className="flex-none" style={{ color: 'var(--vt-green-600)' }} />
                  You approve the price before any repair starts.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="pt-4 pb-2" aria-labelledby="issues-title">
          <h2 id="issues-title" className="h4 mb-3">What needs fixing?</h2>
          <div className="vt-rail">
            {REPAIR_ISSUES.map((i) => (
              <Chip key={i.label} as={Link} to={`/app/book${i.problem ? `?problem=${encodeURIComponent(i.problem)}` : ''}`} className="vt-chip vt-issue">
                <Icon name={i.icon} size={20} />{i.label}
              </Chip>
            ))}
          </div>
        </section>

        <section className="py-4" aria-labelledby="cats-title">
          <SectionHead title={<span id="cats-title">Shop by category</span>} to="/shop" />
          <div className="vt-rail">
            {categories.loading && Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="vt-tile"><span className="vt-skeleton" style={{ aspectRatio: 1, borderRadius: '1.25rem', marginBottom: 8 }} /><span className="vt-skeleton" style={{ height: 14, width: '70%' }} /></div>
            ))}
            {categories.data?.map((c) => (
              <Link key={c.id} to={`/shop?category=${encodeURIComponent(c.name)}`} className="vt-tile">
                <div className="vt-tile-img">
                  {CATEGORY_IMAGES[c.name] && <img src={CATEGORY_IMAGES[c.name]} alt="" width="240" height="240" loading="lazy" decoding="async" />}
                </div>
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="py-2" aria-label="Vape range">
          <Link to="/vapes" className="vt-card vt-card--tint vt-row text-body text-decoration-none">
            <span className="vt-row-icon"><Icon name="drop" size={22} /></span>
            <span className="vt-row-main"><strong>Vapes <span className="vt-pill vt-pill--warn ms-1">18+</span></strong><span className="text-secondary small">Pods, e-liquids and coils</span></span>
            <span className="vt-row-end"><Icon name="right" size={18} /></span>
          </Link>
        </section>

        {(products.loading || products.error || deals.length > 0) && (
          <section className="py-3" aria-labelledby="deals-title">
            <SectionHead title={<span id="deals-title">Price drops</span>} to="/shop?deals=1" linkLabel="See all deals" />
            <Rail loading={products.loading} error={products.error} retry={products.reload}>
              {deals.map((p) => <div key={p.id} className="vt-productwrap"><ProductCard p={p} /></div>)}
            </Rail>
          </section>
        )}

        {refurb.length > 0 && (
          <section className="py-3" aria-labelledby="refurb-title">
            <SectionHead title={<span id="refurb-title">Refurbished</span>} to="/shop?condition=Refurbished" />
            <Rail>{refurb.map((p) => <div key={p.id} className="vt-productwrap"><ProductCard p={p} /></div>)}</Rail>
          </section>
        )}

        <section className="py-4" aria-labelledby="how-title">
          <div className="row g-4 align-items-center">
            <div className="col-lg-5">
              <h2 id="how-title" className="h3 mb-2">Repairs without the guesswork</h2>
              <p className="text-secondary mb-3">Know the price and where your device is, from the first tap to collection.</p>
              <Link to="/app/book" className="btn btn-primary d-none d-lg-inline-flex">Book a repair<Icon name="arrow" size={18} /></Link>
            </div>
            <div className="col-lg-7">
              <ol className="vt-steps vt-card p-3 p-md-4">
                {STEPS.map(([title, text], i) => (
                  <li key={title} className="vt-step is-done">
                    <span className="vt-dot" aria-hidden="true">{i + 1}</span>
                    <span><strong className="d-block" style={{ color: 'var(--vt-ink)' }}>{title}</strong><span className="text-secondary" style={{ fontWeight: 400 }}>{text}</span></span>
                  </li>
                ))}
              </ol>
              <Link to="/app/book" className="btn btn-primary w-100 mt-3 d-lg-none">Book a repair<Icon name="arrow" size={18} /></Link>
            </div>
          </div>
        </section>

        <section className="py-3" aria-labelledby="sell-title">
          <div className="vt-band">
            <div className="row g-0 align-items-stretch">
              <div className="col-md-6 p-4 p-md-5 d-flex flex-column justify-content-center">
                <h2 id="sell-title" className="h2 text-white mb-2">Got an old phone in a drawer?</h2>
                <p className="mb-4" style={{ maxWidth: '38ch' }}>Tell us what you have and we will send you an offer. You choose whether to accept it.</p>
                <div><Link to="/app/sell" className="btn btn-lime btn-lg">Get an offer<Icon name="arrow" size={18} /></Link></div>
              </div>
              <div className="col-md-6">
                <div className="vt-band-img"><img src="/img/iphone-trio.jpg" alt="Three phones in red, white and blue" width="1200" height="675" loading="lazy" decoding="async" /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-4" aria-labelledby="find-title">
          <div className="vt-card vt-card--tint p-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <span className="d-grid flex-none rounded-circle" style={{ placeItems: 'center', width: 48, height: 48, background: 'var(--vt-green-600)', color: '#fff' }}><Icon name="pin" /></span>
              <div>
                <h2 id="find-title" className="h5 mb-0">Find your nearest branch</h2>
                <p className="text-secondary mb-0 small">{count ? `${count} branches across south-east London and Kent.` : 'Across south-east London and Kent.'}</p>
              </div>
            </div>
            <form className="input-group" onSubmit={findBranch}>
              <input className="form-control" aria-label="Your postcode" placeholder="Your postcode, e.g. SE18 6EX" autoComplete="postal-code" enterKeyHint="search" required value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              <button className="btn btn-primary">Find</button>
            </form>
          </div>
        </section>
      </div>
    </>
  )
}
