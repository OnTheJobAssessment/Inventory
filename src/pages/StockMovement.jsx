import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ItemPicker from '../components/ItemPicker'

const TIPE_OPTIONS = [
  { value: 'masuk', label: 'Stok Masuk', hint: 'Menambah stok (mis. dari kantor pusat / produksi)' },
  { value: 'keluar', label: 'Stok Keluar', hint: 'Mengurangi stok (mis. dipakai / rusak / hilang)' },
  { value: 'adjustment', label: 'Adjustment', hint: 'Menetapkan jumlah stok yang sebenarnya (stock opname)' },
]

export default function StockMovement() {
  const { profile, isAdmin, user } = useAuth()
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [form, setForm] = useState({
    posm_item_id: '',
    warehouse_id: '',
    tipe: 'masuk',
    jumlah: '',
    nomor_bukti: '',
    keterangan: '',
  })
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text }
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadOptions()
  }, [profile])

  async function loadOptions() {
    const { data: itemData } = await supabase.from('posm_items').select('id, nama, kode_posm').order('nama')
    setItems(itemData ?? [])

    if (isAdmin) {
      const { data: whData } = await supabase.from('warehouses').select('id, nama_gudang').order('nama_gudang')
      setWarehouses(whData ?? [])
    } else if (profile?.warehouse_id) {
      setForm((f) => ({ ...f, warehouse_id: profile.warehouse_id }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.posm_item_id || !form.warehouse_id || !form.jumlah) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi.' })
      return
    }

    setSubmitting(true)
    const jumlahInput = parseInt(form.jumlah, 10)

    // 1. Ambil baris stok yang ada saat ini (kalau ada)
    const { data: existingStock } = await supabase
      .from('stock')
      .select('id, jumlah')
      .eq('posm_item_id', form.posm_item_id)
      .eq('warehouse_id', form.warehouse_id)
      .maybeSingle()

    const stokSaatIni = existingStock?.jumlah ?? 0
    let stokBaru

    if (form.tipe === 'masuk') stokBaru = stokSaatIni + jumlahInput
    else if (form.tipe === 'keluar') stokBaru = stokSaatIni - jumlahInput
    else stokBaru = jumlahInput // adjustment: set langsung ke jumlah yang diinput

    if (stokBaru < 0) {
      setMessage({ type: 'error', text: `Stok tidak cukup. Stok saat ini: ${stokSaatIni}.` })
      setSubmitting(false)
      return
    }

    // 2. Catat riwayat transaksi
    const { error: movError } = await supabase.from('stock_movements').insert({
      posm_item_id: form.posm_item_id,
      warehouse_id: form.warehouse_id,
      tipe: form.tipe,
      jumlah: jumlahInput,
      nomor_bukti: form.nomor_bukti || null,
      keterangan: form.keterangan || null,
      created_by: user.id,
    })

    if (movError) {
      setMessage({ type: 'error', text: 'Gagal menyimpan transaksi: ' + movError.message })
      setSubmitting(false)
      return
    }

    // 3. Update / buat baris stok
    const { error: stockError } = existingStock
      ? await supabase.from('stock').update({ jumlah: stokBaru }).eq('id', existingStock.id)
      : await supabase.from('stock').insert({
          posm_item_id: form.posm_item_id,
          warehouse_id: form.warehouse_id,
          jumlah: stokBaru,
        })

    setSubmitting(false)

    if (stockError) {
      setMessage({ type: 'error', text: 'Transaksi tercatat, tapi gagal update stok: ' + stockError.message })
      return
    }

    setMessage({ type: 'success', text: `Berhasil. Stok baru: ${stokBaru}.` })
    setForm((f) => ({ ...f, posm_item_id: '', jumlah: '', nomor_bukti: '', keterangan: '' }))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Input Mutasi Stok</h1>
        <p className="text-black/45 text-sm mt-1">Catat stok masuk, keluar, atau adjustment (stock opname).</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
        <div>
          <label className="label">Jenis Transaksi</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TIPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipe: opt.value }))}
                className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  form.tipe === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-black/10 hover:bg-black/[0.02]'
                }`}
              >
                <span className="font-semibold block">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-black/40 mt-1.5">
            {TIPE_OPTIONS.find((o) => o.value === form.tipe)?.hint}
          </p>
        </div>

        <div>
          <label className="label">Item POSM</label>
          <ItemPicker
            items={items}
            value={form.posm_item_id}
            onChange={(val) => setForm((f) => ({ ...f, posm_item_id: val }))}
          />
        </div>

        {isAdmin ? (
          <div>
            <label className="label">Gudang</label>
            <select
              className="input"
              value={form.warehouse_id}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
            >
              <option value="">Pilih gudang...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.nama_gudang}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Gudang</label>
            <p className="input bg-black/[0.02] text-black/50">{profile?.warehouses?.nama_gudang}</p>
          </div>
        )}

        <div>
          <label className="label">Nomor Bukti (opsional)</label>
          <input
            className="input"
            value={form.nomor_bukti}
            onChange={(e) => setForm((f) => ({ ...f, nomor_bukti: e.target.value }))}
            placeholder="Contoh: SJ-0012, BA-0034"
          />
        </div>

        <div>
          <label className="label">{form.tipe === 'adjustment' ? 'Jumlah Stok Sebenarnya' : 'Jumlah'}</label>
          <input
            type="number"
            min="0"
            className="input"
            value={form.jumlah}
            onChange={(e) => setForm((f) => ({ ...f, jumlah: e.target.value }))}
            placeholder="0"
          />
        </div>

        <div>
          <label className="label">Keterangan (opsional)</label>
          <textarea
            className="input"
            rows={2}
            value={form.keterangan}
            onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
            placeholder="Contoh: kiriman dari kantor pusat, rusak saat pemasangan, dll."
          />
        </div>

        {message && (
          <p className={`text-sm rounded-lg px-3 py-2 border ${
            message.type === 'success'
              ? 'bg-brand-50 text-brand-700 border-brand-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message.text}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>
    </div>
  )
}
