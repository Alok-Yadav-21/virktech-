import { Component } from 'react'

// Without this, any error while drawing a page leaves a blank screen with no hint why. This shows a message and a way out.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error) { console.error('Page failed to draw:', error) }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h1 className="h4">Something went wrong</h1>
        <p className="text-secondary">The page could not load. This usually fixes itself with a fresh copy of the site.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
      </div>
    )
  }
}
