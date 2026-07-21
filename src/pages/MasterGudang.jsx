import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const emptyForm = { id: null, nama_gudang: '', alamat: '' }

export default function MasterGudang() {
  const [warehouses, setWarehouses] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWarehouses()
  }, [])

  async function loadWarehouses() {
    setLoading(true)
    const { data } = await supabase.from('warehouses').select('id, nama_gudang, alamat').order('nama_gudang')
    setWarehouses(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)
    if (!form.nama_gudang) {
      setMessage({ type: 'error', text: 'Nama gudang wajib diisi.' })
      return
    }

    const payload = { nama_gudang: form.nama_gudang, alamat: form.alamat || null }
    const { error } = form.id
      ? await supabase.from('warehouses').update(payload).eq('id', form.id)
      : await supabase.from('warehouses').insert(payload)

    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message })
      return
    }

    setMessage({ type: 'success', text: form.id ? 'Gudang diperbarui.' : 'Gudang ditambahkan.' })
    setForm(emptyForm)
    loadWarehouses()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus gudang ini? Pastikan tidak ada stok atau user yang masih terhubung ke gudang ini.')) return
    const { error } = await supabase.from('warehouses').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    loadWarehouses()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Master Gudang</h1>
        <p className="text-black/45 text-sm mt-1">Kelola daftar lokasi gudang.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 mb-6 max-w-xl space-y-4">
        <p className="font-display font-semibold text-sm">{form.id ? 'Edit Gudang' : 'Tambah Gudang Baru'}</p>
        <div>
          <label className="label">Nama Gudang</label>
          <input
            className="input"
            value={form.nama_gudang}
            onChange={(e) => setForm((f) => ({ ...f, nama_gudang: e.target.value }))}
            placeholder="Gudang Jakarta Pusat"
          />
        </div>
        <div>
          <label className="label">Alamat (opsional)</label>
          <textarea
            className="input"
            rows={2}
            value={form.alamat}
            onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
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

        <div className="flex gap-2">
          <button type="submit" className="btn-primary">{form.id ? 'Simpan Perubahan' : 'Tambah Gudang'}</button>
          {form.id && <button type="button" onClick={() => setForm(emptyForm)} className="btn-secondary">Batal</button>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-black/[0.02] text-left text-xs font-semibold uppercase tracking-wide text-black/40">
              <th className="px-4 py-3">Nama Gudang</th>
              <th className="px-4 py-3">Alamat</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-black/40">Memuat...</td></tr>
            ) : warehouses.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-black/40">Belum ada gudang.</td></tr>
            ) : (
              warehouses.map((w) => (
                <tr key={w.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{w.nama_gudang}</td>
                  <td className="px-4 py-3 text-black/50">{w.alamat || '-'}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      className="text-brand-600 hover:underline text-xs font-semibold"
                      onClick={() => setForm({ id: w.id, nama_gudang: w.nama_gudang, alamat: w.alamat ?? '' })}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-600 hover:underline text-xs font-semibold"
                      onClick={() => handleDelete(w.id)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
