import { Navigate, useParams } from 'react-router-dom'
import WorkDone from './WorkDone'
export default function Costs() {
  const { category = '' } = useParams()
  if (category === 'work-done') return <WorkDone />
  return <Navigate to="/project-management/work-done" replace />
}
