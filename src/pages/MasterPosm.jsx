import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const emptyForm = { id: null, kode_posm: '', nama: '', kategori_id: '', satuan: 'pcs', stok_minimum: 0 }

export default function MasterPosm() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [newCategory, setNewCategory] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: itemData } = await supabase
      .from('posm_items')
      .select('id, kode_posm, nama, satuan, stok_minimum, kategori_id, categories(nama)')
      .order('nama')
    setItems(itemData ?? [])

    const { data: catData } = await supabase.from('categories').select('id, nama').order('nama')
    setCategories(catData ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.kode_posm || !form.nama || !form.satuan) {
      setMessage({ type: 'error', text: 'Kode, nama, dan satuan wajib diisi.' })
      return
    }

    const payload = {
      kode_posm: form.kode_posm,
      nama: form.nama,
      kategori_id: form.kategori_id || null,
      satuan: form.satuan,
      stok_minimum: parseInt(form.stok_minimum, 10) || 0,
    }

    const { error } = form.id
      ? await supabase.from('posm_items').update(payload).eq('id', form.id)
      : await supabase.from('posm_items').insert(payload)

    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message })
      return
    }

    setMessage({ type: 'success', text: form.id ? 'Item diperbarui.' : 'Item ditambahkan.' })
    resetForm()
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus item ini? Data stok dan riwayat terkait bisa ikut terpengaruh.')) return
    const { error } = await supabase.from('posm_items').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message + '\n\nKemungkinan item ini masih punya data stok/transaksi terkait.')
      return
    }
    loadAll()
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategory.trim()) return
    const { error } = await supabase.from('categories').insert({ nama: newCategory.trim() })
    if (!error) {
      setNewCategory('')
      loadAll()
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Master POSM</h1>
        <p className="text-black/45 text-sm mt-1">Kelola daftar item POSM dan kategori.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form tambah/edit item */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-4">
            <p className="font-display font-semibold text-sm">
              {form.id ? 'Edit Item' : 'Tambah Item Baru'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Kode POSM</label>
                <input
                  className="input"
                  value={form.kode_posm}
                  onChange={(e) => setForm((f) => ({ ...f, kode_posm: e.target.value }))}
                  placeholder="POSM-001"
                />
              </div>
              <div>
                <label className="label">Nama Item</label>
                <input
                  className="input"
                  value={form.nama}
                  onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                  placeholder="Banner Promo A3"
                />
              </div>
              <div>
                <label className="label">Kategori</label>
                <select
                  className="input"
                  value={form.kategori_id}
                  onChange={(e) => setForm((f) => ({ ...f, kategori_id: e.target.value }))}
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Satuan</label>
                <input
                  className="input"
                  value={form.satuan}
                  onChange={(e) => setForm((f) => ({ ...f, satuan: e.target.value }))}
                  placeholder="pcs / lembar / set"
                />
              </div>
              <div>
                <label className="label">Stok Minimum</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={form.stok_minimum}
                  onChange={(e) => setForm((f) => ({ ...f, stok_minimum: e.target.value }))}
                />
              </div>
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
              <button type="submit" className="btn-primary">
                {form.id ? 'Simpan Perubahan' : 'Tambah Item'}
              </button>
              {form.id && (
                <button type="button" onClick={resetForm} className="btn-secondary">Batal</button>
              )}
            </div>
          </form>

          {/* Tabel item */}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-black/[0.02] text-left text-xs font-semibold uppercase tracking-wide text-black/40">
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Satuan</th>
                  <th className="px-4 py-3 text-right">Min. Stok</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-black/40">Memuat...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-black/40">Belum ada item.</td></tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="border-t border-black/5">
                      <td className="px-4 py-3 font-mono text-xs text-black/50">{it.kode_posm}</td>
                      <td className="px-4 py-3 font-medium">{it.nama}</td>
                      <td className="px-4 py-3 text-black/50">{it.categories?.nama ?? '-'}</td>
                      <td className="px-4 py-3 text-black/50">{it.satuan}</td>
                      <td className="px-4 py-3 text-right">{it.stok_minimum}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          className="text-brand-600 hover:underline text-xs font-semibold"
                          onClick={() => setForm({
                            id: it.id,
                            kode_posm: it.kode_posm,
                            nama: it.nama,
                            kategori_id: it.kategori_id ?? '',
                            satuan: it.satuan,
                            stok_minimum: it.stok_minimum,
                          })}
                        >
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:underline text-xs font-semibold"
                          onClick={() => handleDelete(it.id)}
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

        {/* Panel kategori */}
        <div className="card p-5 h-fit">
          <p className="font-display font-semibold text-sm mb-3">Kategori</p>
          <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
            <input
              className="input"
              placeholder="Nama kategori baru"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button type="submit" className="btn-secondary shrink-0">Tambah</button>
          </form>
          <div className="space-y-1.5">
            {categories.map((c) => (
              <div key={c.id} className="text-sm px-2 py-1.5 rounded-lg bg-black/[0.02]">{c.nama}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
