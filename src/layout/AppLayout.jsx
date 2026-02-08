import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="app-root">
      <Header onToggleSidebar={() => setCollapsed(v => !v)} />
      <div className="app-container">
        <Sidebar collapsed={collapsed} />
        <main className="main-content">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  )
}