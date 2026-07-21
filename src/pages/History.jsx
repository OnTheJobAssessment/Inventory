import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const tipeLabel = {
  masuk: { text: 'Masuk', className: 'bg-brand-50 text-brand-700' },
  keluar: { text: 'Keluar', className: 'bg-amber-50 text-amber-700' },
  transfer: { text: 'Transfer', className: 'bg-blue-50 text-blue-700' },
  adjustment: { text: 'Adjustment', className: 'bg-black/5 text-black/60' },
}

export default function History() {
  const { profile, isAdmin } = useAuth()
  const [movements, setMovements] = useState([])
  const [filterTipe, setFilterTipe] = useState('semua')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [profile, filterTipe])

  async function loadHistory() {
    if (!profile) return
    setLoading(true)

    let query = supabase
      .from('stock_movements')
      .select(`
        id, tipe, jumlah, keterangan, created_at,
        posm_items(nama, kode_posm),
        warehouses:warehouse_id(nama_gudang),
        tujuan:warehouse_tujuan_id(nama_gudang)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!isAdmin) query = query.or(`warehouse_id.eq.${profile.warehouse_id},warehouse_tujuan_id.eq.${profile.warehouse_id}`)
    if (filterTipe !== 'semua') query = query.eq('tipe', filterTipe)

    const { data, error } = await query
    if (error) console.error(error)
    setMovements(data ?? [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Riwayat Transaksi</h1>
        <p className="text-black/45 text-sm mt-1">100 transaksi terbaru.</p>
      </div>

      <div className="mb-4">
        <select className="input max-w-xs" value={filterTipe} onChange={(e) => setFilterTipe(e.target.value)}>
          <option value="semua">Semua Jenis</option>
          <option value="masuk">Stok Masuk</option>
          <option value="keluar">Stok Keluar</option>
          <option value="transfer">Transfer</option>
          <option value="adjustment">Adjustment</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-black/[0.02] text-left text-xs font-semibold uppercase tracking-wide text-black/40">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Gudang</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
              <th className="px-4 py-3">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-black/40">Memuat...</td></tr>
            ) : movements.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-black/40">Belum ada transaksi.</td></tr>
            ) : (
              movements.map((m) => (
                <tr key={m.id} className="border-t border-black/5">
                  <td className="px-4 py-3 text-black/50 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 font-medium">{m.posm_items?.nama}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${tipeLabel[m.tipe]?.className}`}>{tipeLabel[m.tipe]?.text}</span>
                  </td>
                  <td className="px-4 py-3 text-black/50">
                    {m.warehouses?.nama_gudang}
                    {m.tipe === 'transfer' && m.tujuan && (
                      <span className="text-black/30"> → {m.tujuan.nama_gudang}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{m.jumlah}</td>
                  <td className="px-4 py-3 text-black/40">{m.keterangan || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
