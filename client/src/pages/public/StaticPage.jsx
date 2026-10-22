import { STATIC_PAGES } from './staticContent'
import NotFound from './NotFound'
import Icon from '../../components/ui/Icon'

export default function StaticPage({ slug }) {
  const page = STATIC_PAGES[slug]
  if (!page) return <NotFound />
  return (
    <article className="mx-auto" style={{ maxWidth: '44rem' }}>
      <h1 className="h2 mb-3">{page.title}</h1>
      <div className="alert alert-warning small d-flex gap-2" role="note"><Icon name="info" size={20} className="flex-none" />Draft wording. It must be reviewed before the shop goes live.</div>
      {page.sections.map(([heading, body]) => (
        <section key={heading} className="mb-4"><h2 className="h5">{heading}</h2><p className="mb-0">{body}</p></section>
      ))}
    </article>
  )
}
