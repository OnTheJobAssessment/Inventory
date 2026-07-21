import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { generateKartuStokPdf } from '../lib/kartuStok'

export default function Stock() {
  const { profile, isAdmin } = useAuth()
  const [stock, setStock] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState('semua')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [printingId, setPrintingId] = useState(null)

  useEffect(() => {
    loadWarehouses()
  }, [])

  useEffect(() => {
    loadStock()
  }, [profile, selectedWarehouse])

  async function loadWarehouses() {
    const { data } = await supabase.from('warehouses').select('id, nama_gudang').order('nama_gudang')
    setWarehouses(data ?? [])
  }

  async function loadStock() {
    if (!profile) return
    setLoading(true)

    let query = supabase
      .from('stock')
      .select('id, jumlah, posm_items(id, nama, kode_posm, satuan, stok_minimum, categories(nama)), warehouses(id, nama_gudang)')
      .order('id')

    if (!isAdmin) {
      query = query.eq('warehouse_id', profile.warehouse_id)
    } else if (selectedWarehouse !== 'semua') {
      query = query.eq('warehouse_id', selectedWarehouse)
    }

    const { data, error } = await query
    if (error) console.error(error)
    setStock(data ?? [])
    setLoading(false)
  }

  const filtered = stock.filter((s) =>
    s.posm_items?.nama?.toLowerCase().includes(search.toLowerCase()) ||
    s.posm_items?.kode_posm?.toLowerCase().includes(search.toLowerCase())
  )

  // Ambil seluruh riwayat mutasi item ini di gudang ini (termasuk transfer masuk
  // dari gudang lain), lalu susun jadi PDF Kartu Stok.
  async function handlePrintKartuStok(row) {
    const itemId = row.posm_items?.id
    const warehouseId = row.warehouses?.id
    if (!itemId || !warehouseId) return

    setPrintingId(row.id)

    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        id, tipe, jumlah, nomor_bukti, keterangan, created_at, warehouse_id, warehouse_tujuan_id,
        asal:warehouse_id(nama_gudang),
        tujuan:warehouse_tujuan_id(nama_gudang)
      `)
      .eq('posm_item_id', itemId)
      .or(`warehouse_id.eq.${warehouseId},warehouse_tujuan_id.eq.${warehouseId}`)
      .order('created_at', { ascending: true })

    if (error) {
      alert('Gagal mengambil riwayat transaksi: ' + error.message)
      setPrintingId(null)
      return
    }

    const rows = (data ?? []).map((m) => {
      const tanggal = new Date(m.created_at).toLocaleDateString('id-ID')
      let tipe = m.tipe
      let dariKepada = m.keterangan || ''

      if (m.tipe === 'transfer') {
        if (m.warehouse_id === warehouseId) {
          tipe = 'transfer_keluar'
          dariKepada = `Kepada: ${m.tujuan?.nama_gudang ?? '-'}`
        } else {
          tipe = 'transfer_masuk'
          dariKepada = `Dari: ${m.asal?.nama_gudang ?? '-'}`
        }
      } else if (!dariKepada) {
        dariKepada = m.tipe === 'masuk' ? 'Stok Masuk' : m.tipe === 'keluar' ? 'Stok Keluar' : 'Stock Opname'
      }

      return { tanggal, nomor_bukti: m.nomor_bukti, dariKepada, tipe, jumlah: m.jumlah }
    })

    generateKartuStokPdf({
      item: row.posm_items,
      warehouse: row.warehouses,
      rows,
    })

    setPrintingId(null)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Stok Gudang</h1>
        <p className="text-black/45 text-sm mt-1">Jumlah stok POSM saat ini per gudang.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Cari nama atau kode POSM..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAdmin && (
          <select
            className="input sm:max-w-xs"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="semua">Semua Gudang</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.nama_gudang}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-black/[0.02] text-left text-xs font-semibold uppercase tracking-wide text-black/40">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Nama Item</th>
              <th className="px-4 py-3">Kategori</th>
              {isAdmin && <th className="px-4 py-3">Gudang</th>}
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Satuan</th>
              <th className="px-4 py-3 text-right">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-black/40">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-black/40">Tidak ada data.</td></tr>
            ) : (
              filtered.map((s) => {
                const isLow = s.jumlah <= (s.posm_items?.stok_minimum ?? 0)
                return (
                  <tr key={s.id} className="border-t border-black/5">
                    <td className="px-4 py-3 font-mono text-xs text-black/50">{s.posm_items?.kode_posm}</td>
                    <td className="px-4 py-3 font-medium">{s.posm_items?.nama}</td>
                    <td className="px-4 py-3 text-black/50">{s.posm_items?.categories?.nama ?? '-'}</td>
                    {isAdmin && <td className="px-4 py-3 text-black/50">{s.warehouses?.nama_gudang}</td>}
                    <td className="px-4 py-3 text-right font-semibold">{s.jumlah}</td>
                    <td className="px-4 py-3 text-right text-black/50">{s.posm_items?.satuan}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`badge ${isLow ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}>
                        {isLow ? 'Rendah' : 'Aman'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        className="text-brand-600 hover:underline text-xs font-semibold disabled:opacity-40"
                        disabled={printingId === s.id}
                        onClick={() => handlePrintKartuStok(s)}
                      >
                        {printingId === s.id ? 'Menyiapkan...' : 'Cetak Kartu Stok'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
