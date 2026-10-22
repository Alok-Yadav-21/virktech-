import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui/primitives'

export default function NotFound() {
  return (
    <EmptyState icon="search" title="That page does not exist" action={<Link to="/" className="btn btn-primary">Go to the home page</Link>}>
      The link may be old or mistyped.
    </EmptyState>
  )
}
