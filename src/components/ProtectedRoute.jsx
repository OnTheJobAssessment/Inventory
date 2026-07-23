import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-black/40 text-sm">
        Memuat...
      </div>
    )
  }

  if (!user) {
    // Simpan URL tujuan (contoh: /scan?kode=POSM-001) supaya setelah login
    // berhasil, user langsung diarahkan ke sana lagi - bukan ke Dashboard.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="font-display font-semibold text-lg mb-1">Akses ditolak</p>
          <p className="text-black/50 text-sm">Halaman ini khusus untuk admin.</p>
        </div>
      </div>
    )
  }

  // Kalau profile belum ke-load (mis. user baru dibuat tapi belum ada row di `profiles`)
  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="font-display font-semibold text-lg mb-1">Profile belum diset</p>
          <p className="text-black/50 text-sm">
            Akun ini belum punya data role/gudang. Hubungi admin untuk melengkapi data di tabel <code className="font-mono">profiles</code>.
          </p>
        </div>
      </div>
    )
  }

  return children
}
