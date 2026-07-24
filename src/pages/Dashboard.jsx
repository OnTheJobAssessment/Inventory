import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState({ totalItem: 0, totalGudang: 0, totalStok: 0 })
  const [lowStock, setLowStock] = useState([])
  const [recentMovements, setRecentMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [profile])

  async function loadDashboard() {
    if (!profile) return
    setLoading(true)

    // Query stok, dibatasi ke gudang staff kalau bukan admin
    let stockQuery = supabase
      .from('stock')
      .select('jumlah, posm_items(id, nama, kode_posm, stok_minimum), warehouses(id, nama_gudang)')

    if (!isAdmin) {
      stockQuery = stockQuery.eq('warehouse_id', profile.warehouse_id)
    }

    const { data: stockData } = await stockQuery

    const totalStok = (stockData ?? []).reduce((sum, s) => sum + (s.jumlah || 0), 0)
    const itemSet = new Set((stockData ?? []).map((s) => s.posm_items?.id))
    const gudangSet = new Set((stockData ?? []).map((s) => s.warehouses?.id))

    setSummary({
      totalItem: itemSet.size,
      totalGudang: gudangSet.size,
      totalStok,
    })

    const low = (stockData ?? []).filter(
      (s) => s.posm_items && s.jumlah <= (s.posm_items.stok_minimum ?? 0)
    )
    setLowStock(low)

    // Riwayat transaksi terbaru
    let movQuery = supabase
      .from('stock_movements')
      .select('id, tipe, jumlah, created_at, posm_items(nama), warehouses(nama_gudang)')
      .order('created_at', { ascending: false })
      .limit(8)

    if (!isAdmin) {
      movQuery = movQuery.or(`warehouse_id.eq.${profile.warehouse_id},warehouse_tujuan_id.eq.${profile.warehouse_id}`)
    }

    const { data: movData } = await movQuery
    setRecentMovements(movData ?? [])

    setLoading(false)
  }

  const tipeLabel = {
    masuk: { text: 'Masuk', className: 'bg-brand-50 text-brand-700' },
    keluar: { text: 'Keluar', className: 'bg-amber-50 text-amber-700' },
    transfer: { text: 'Transfer', className: 'bg-blue-50 text-blue-700' },
    adjustment: { text: 'Adjustment', className: 'bg-black/5 text-black/60' },
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl">
          Halo, {profile?.nama?.split(' ')[0] ?? ''}
        </h1>
        <p className="text-black/45 text-sm mt-1">
          {isAdmin ? 'Ringkasan seluruh gudang' : `Ringkasan gudang: ${profile?.warehouses?.nama_gudang ?? '-'}`}
        </p>
      </div>

      {/* Ringkasan angka */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div
          className={`card p-5 ${
            profile?.role === 'admin' || profile?.role === 'staff_gudang'
              ? 'cursor-pointer hover:border-brand-300 hover:shadow-md transition'
              : ''
          }`}
          onClick={() => {
            if (profile?.role === 'admin' || profile?.role === 'staff_gudang') navigate('/stok')
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40 mb-1">
            Total Stok
          </p>
          <p className="font-display font-bold text-3xl">{loading ? '–' : summary.totalStok}</p>
        </div>
        <div
          className={`card p-5 ${isAdmin ? 'cursor-pointer hover:border-brand-300 hover:shadow-md transition' : ''}`}
          onClick={() => { if (isAdmin) navigate('/master-posm') }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40 mb-1">
            Jenis Item
          </p>
          <p className="font-display font-bold text-3xl">{loading ? '–' : summary.totalItem}</p>
        </div>
        <div
          className={`card p-5 ${isAdmin ? 'cursor-pointer hover:border-brand-300 hover:shadow-md transition' : ''}`}
          onClick={() => { if (isAdmin) navigate('/master-gudang') }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40 mb-1">
            {isAdmin ? 'Jumlah Gudang' : 'Item Stok Rendah'}
          </p>
          <p className="font-display font-bold text-3xl">
            {loading ? '–' : isAdmin ? summary.totalGudang : lowStock.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert stok minimum */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-sm mb-4">⚠ Stok di bawah minimum</h2>
          {loading ? (
            <p className="text-sm text-black/40">Memuat...</p>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-black/40">Semua stok aman.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-black/5 last:border-0">
                  <div>
                    <p className="font-medium">{s.posm_items?.nama}</p>
                    {isAdmin && <p className="text-black/40 text-xs">{s.warehouses?.nama_gudang}</p>}
                  </div>
                  <span className="badge bg-red-50 text-red-700">
                    {s.jumlah} / min {s.posm_items?.stok_minimum}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Riwayat terbaru */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-sm mb-4">Transaksi terbaru</h2>
          {loading ? (
            <p className="text-sm text-black/40">Memuat...</p>
          ) : recentMovements.length === 0 ? (
            <p className="text-sm text-black/40">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-2">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b border-black/5 last:border-0">
                  <div>
                    <p className="font-medium">{m.posm_items?.nama}</p>
                    <p className="text-black/40 text-xs">{m.warehouses?.nama_gudang}</p>
                  </div>
                  <span className={`badge ${tipeLabel[m.tipe]?.className ?? 'bg-black/5'}`}>
                    {tipeLabel[m.tipe]?.text ?? m.tipe} {m.jumlah}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
