import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Transfer() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [form, setForm] = useState({
    posm_item_id: '',
    warehouse_id: '',       // asal
    warehouse_tujuan_id: '', // tujuan
    jumlah: '',
    nomor_bukti: '',
    keterangan: '',
  })
  const [stokAsal, setStokAsal] = useState(null)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    if (form.posm_item_id && form.warehouse_id) checkStokAsal()
    else setStokAsal(null)
  }, [form.posm_item_id, form.warehouse_id])

  async function loadOptions() {
    const { data: itemData } = await supabase.from('posm_items').select('id, nama, kode_posm').order('nama')
    setItems(itemData ?? [])
    const { data: whData } = await supabase.from('warehouses').select('id, nama_gudang').order('nama_gudang')
    setWarehouses(whData ?? [])
  }

  async function checkStokAsal() {
    const { data } = await supabase
      .from('stock')
      .select('jumlah')
      .eq('posm_item_id', form.posm_item_id)
      .eq('warehouse_id', form.warehouse_id)
      .maybeSingle()
    setStokAsal(data?.jumlah ?? 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    const { posm_item_id, warehouse_id, warehouse_tujuan_id, jumlah } = form
    if (!posm_item_id || !warehouse_id || !warehouse_tujuan_id || !jumlah) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi.' })
      return
    }
    if (warehouse_id === warehouse_tujuan_id) {
      setMessage({ type: 'error', text: 'Gudang asal dan tujuan tidak boleh sama.' })
      return
    }

    const jumlahInput = parseInt(jumlah, 10)
    if ((stokAsal ?? 0) < jumlahInput) {
      setMessage({ type: 'error', text: `Stok di gudang asal tidak cukup (tersedia: ${stokAsal ?? 0}).` })
      return
    }

    setSubmitting(true)

    // 1. Catat 1 baris movement bertipe 'transfer'
    const { error: movError } = await supabase.from('stock_movements').insert({
      posm_item_id,
      warehouse_id,
      warehouse_tujuan_id,
      tipe: 'transfer',
      jumlah: jumlahInput,
      nomor_bukti: form.nomor_bukti || null,
      keterangan: form.keterangan || null,
      created_by: user.id,
    })

    if (movError) {
      setMessage({ type: 'error', text: 'Gagal mencatat transfer: ' + movError.message })
      setSubmitting(false)
      return
    }

    // 2. Kurangi stok gudang asal
    const { data: asalRow } = await supabase
      .from('stock')
      .select('id, jumlah')
      .eq('posm_item_id', posm_item_id)
      .eq('warehouse_id', warehouse_id)
      .single()

    await supabase.from('stock').update({ jumlah: asalRow.jumlah - jumlahInput }).eq('id', asalRow.id)

    // 3. Tambah stok gudang tujuan (buat baris baru kalau belum ada)
    const { data: tujuanRow } = await supabase
      .from('stock')
      .select('id, jumlah')
      .eq('posm_item_id', posm_item_id)
      .eq('warehouse_id', warehouse_tujuan_id)
      .maybeSingle()

    if (tujuanRow) {
      await supabase.from('stock').update({ jumlah: tujuanRow.jumlah + jumlahInput }).eq('id', tujuanRow.id)
    } else {
      await supabase.from('stock').insert({
        posm_item_id,
        warehouse_id: warehouse_tujuan_id,
        jumlah: jumlahInput,
      })
    }

    setSubmitting(false)
    setMessage({ type: 'success', text: 'Transfer berhasil dicatat.' })
    setForm((f) => ({ ...f, jumlah: '', nomor_bukti: '', keterangan: '' }))
    checkStokAsal()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Transfer Antar Gudang</h1>
        <p className="text-black/45 text-sm mt-1">Pindahkan stok POSM dari satu gudang ke gudang lain.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
        <div>
          <label className="label">Item POSM</label>
          <select
            className="input"
            value={form.posm_item_id}
            onChange={(e) => setForm((f) => ({ ...f, posm_item_id: e.target.value }))}
          >
            <option value="">Pilih item...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.kode_posm} — {it.nama}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dari Gudang</label>
            <select
              className="input"
              value={form.warehouse_id}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
            >
              <option value="">Pilih gudang asal...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.nama_gudang}</option>
              ))}
            </select>
            {stokAsal !== null && (
              <p className="text-xs text-black/40 mt-1.5">Stok tersedia: {stokAsal}</p>
            )}
          </div>
          <div>
            <label className="label">Ke Gudang</label>
            <select
              className="input"
              value={form.warehouse_tujuan_id}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_tujuan_id: e.target.value }))}
            >
              <option value="">Pilih gudang tujuan...</option>
              {warehouses
                .filter((w) => w.id !== Number(form.warehouse_id))
                .map((w) => (
                  <option key={w.id} value={w.id}>{w.nama_gudang}</option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Nomor Bukti (opsional)</label>
          <input
            className="input"
            value={form.nomor_bukti}
            onChange={(e) => setForm((f) => ({ ...f, nomor_bukti: e.target.value }))}
            placeholder="Contoh: BST-0007"
          />
        </div>

        <div>
          <label className="label">Jumlah</label>
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
          {submitting ? 'Memproses...' : 'Proses Transfer'}
        </button>
      </form>
    </div>
  )
}
