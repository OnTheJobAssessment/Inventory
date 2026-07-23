import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Kalau user diarahkan ke sini oleh ProtectedRoute (mis. habis scan QR
  // barcode yang link-nya ke /scan?kode=...), balikin ke sana setelah login.
  const from = location.state?.from
  const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : '/'

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError('Email atau password salah.')
      return
    }
    navigate(redirectTo)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#12312D] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display font-bold text-2xl text-white tracking-tight">POSM Inventory</p>
          <p className="text-white/40 text-sm mt-1">Manajemen stok materi promosi</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {location.state?.reason === 'idle' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Kamu keluar otomatis karena tidak ada aktivitas selama 30 menit. Silakan login kembali.
            </p>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoFocus
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          Belum punya akun? Hubungi admin untuk dibuatkan akun.
        </p>
      </div>
    </div>
  )
}
