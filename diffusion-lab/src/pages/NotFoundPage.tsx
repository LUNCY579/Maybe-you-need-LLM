import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page">
      <h1 className="page-title">That page does not exist</h1>
      <p className="page-lede">
        The course is here: <Link to="/lessons">the lessons</Link>, <Link to="/labs">the laboratories</Link>,{' '}
        <Link to="/practice">the practice bank</Link>, <Link to="/equations">the equations</Link> and{' '}
        <Link to="/sources">the sources</Link>.
      </p>
    </div>
  )
}
