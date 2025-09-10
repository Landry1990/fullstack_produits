import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}