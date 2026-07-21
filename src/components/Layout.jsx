import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from './ConfirmDialog'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◧', roles: ['admin', 'staff_gudang', 'frontliner'] },
  { to: '/scan', label: 'Scan Stok Keluar', icon: '⎘', roles: ['admin', 'staff_gudang', 'frontliner'] },
  { to: '/stok', label: 'Stok Gudang', icon: '▤', roles: ['admin', 'staff_gudang'] },
  { to: '/mutasi', label: 'Input Mutasi', icon: '⇄', roles: ['admin', 'staff_gudang'] },
  { to: '/transfer', label: 'Transfer Antar Gudang', icon: '↔', roles: ['admin'] },
  { to: '/riwayat', label: 'Riwayat Transaksi', icon: '≡', roles: ['admin', 'staff_gudang', 'frontliner'] },
  { to: '/master-posm', label: 'Master POSM', icon: '◫', roles: ['admin'] },
  { to: '/barcode', label: 'Cetak Barcode', icon: '▥', roles: ['admin'] },
  { to: '/master-gudang', label: 'Master Gudang', icon: '⌂', roles: ['admin'] },
  { to: '/pengguna', label: 'Pengguna', icon: '◎', roles: ['admin'] },
]

export default function Layout({ children }) {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  async function handleLogout() {
    setConfirmLogout(false)
    await signOut()
    navigate('/login')
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(profile?.role))

  const sidebarContent = (
    <>
      <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-lg tracking-tight">POSM Inventory</p>
          <p className="text-white/40 text-xs mt-0.5">Manajemen stok materi promosi</p>
        </div>
        <button
          className="md:hidden text-white/60 hover:text-white text-2xl leading-none px-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
        >
          ×
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="font-mono text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 shrink-0 rounded-full bg-brand-500 flex items-center justify-center font-display font-semibold text-sm">
            {profile?.nama?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile?.nama}</p>
            <p className="text-white/40 text-xs truncate">
              {isAdmin ? 'Admin' : profile?.warehouses?.nama_gudang ?? 'Staff Gudang'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full text-left text-sm text-white/60 hover:text-white transition-colors px-1"
        >
          Keluar
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-[#F4F6F5]">
      {/* Sidebar - desktop (selalu tampil) */}
      <aside className="no-print hidden md:flex w-64 shrink-0 bg-[#12312D] text-white flex-col">
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile/tablet (off-canvas) */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#12312D] text-white flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar - hanya tampil di mobile/tablet */}
        <div className="no-print md:hidden sticky top-0 z-30 bg-[#12312D] text-white px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-white/80 hover:text-white text-2xl leading-none px-1"
            aria-label="Buka menu"
          >
            ☰
          </button>
          <p className="font-display font-semibold text-sm">POSM Inventory</p>
          <div className="h-7 w-7 rounded-full bg-brand-500 flex items-center justify-center font-display font-semibold text-xs">
            {profile?.nama?.[0]?.toUpperCase() ?? '?'}
          </div>
        </div>

        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar dari aplikasi?"
        description="Kamu perlu login lagi untuk mengakses aplikasi ini."
        confirmLabel="Ya, Keluar"
        danger
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}
