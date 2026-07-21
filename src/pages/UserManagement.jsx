import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ROLE_LABELS = {
  admin: 'Admin',
  staff_gudang: 'Staff Gudang',
  frontliner: 'Frontliner',
}

const emptyNewUser = { email: '', password: '', nama: '', role: 'staff_gudang', warehouse_id: '' }

export default function UserManagement() {
  const [profiles, setProfiles] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState(emptyNewUser)
  const [addMessage, setAddMessage] = useState(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, nama, role, warehouse_id')
      .order('email')
    setProfiles(profileData ?? [])

    const { data: whData } = await supabase.from('warehouses').select('id, nama_gudang').order('nama_gudang')
    setWarehouses(whData ?? [])
    setLoading(false)
  }

  function updateLocal(id, field, value) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  async function saveRow(p) {
    setSavingId(p.id)
    const { error } = await supabase
      .from('profiles')
      .update({
        nama: p.nama,
        role: p.role,
        warehouse_id: p.role === 'admin' ? null : p.warehouse_id || null,
      })
      .eq('id', p.id)
    setSavingId(null)
    if (error) alert('Gagal menyimpan: ' + error.message)
  }

  async function handleAddUser(e) {
    e.preventDefault()
    setAddMessage(null)

    if (!newUser.email || !newUser.password || !newUser.nama) {
      setAddMessage({ type: 'error', text: 'Email, password, dan nama wajib diisi.' })
      return
    }
    if (newUser.role !== 'admin' && !newUser.warehouse_id) {
      setAddMessage({ type: 'error', text: 'Pilih gudang untuk role ini.' })
      return
    }

    setAddSubmitting(true)
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: newUser.email,
        password: newUser.password,
        nama: newUser.nama,
        role: newUser.role,
        warehouse_id: newUser.warehouse_id || null,
      },
    })
    setAddSubmitting(false)

    // supabase-js melempar error di `error` untuk status non-2xx, tapi function
    // kita juga mengembalikan { error: '...' } di body pada beberapa kasus.
    if (error || data?.error) {
      setAddMessage({ type: 'error', text: data?.error || error.message })
      return
    }

    setAddMessage({ type: 'success', text: 'User baru berhasil dibuat.' })
    setNewUser(emptyNewUser)
    loadAll()
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Manajemen Pengguna</h1>
          <p className="text-black/45 text-sm mt-1">
            Atur nama, role, dan gudang untuk tiap akun.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Tutup' : '+ Tambah User'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddUser} className="card p-6 mb-6 max-w-xl space-y-4">
          <p className="font-display font-semibold text-sm">Tambah User Baru</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={newUser.email}
                onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))}
                placeholder="nama@perusahaan.com"
              />
            </div>
            <div>
              <label className="label">Password Awal</label>
              <input
                type="text"
                className="input"
                value={newUser.password}
                onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))}
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div>
              <label className="label">Nama</label>
              <input
                className="input"
                value={newUser.nama}
                onChange={(e) => setNewUser((f) => ({ ...f, nama: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={newUser.role}
                onChange={(e) => setNewUser((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="staff_gudang">Staff Gudang</option>
                <option value="frontliner">Frontliner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {newUser.role !== 'admin' && (
              <div className="sm:col-span-2">
                <label className="label">Gudang</label>
                <select
                  className="input"
                  value={newUser.warehouse_id}
                  onChange={(e) => setNewUser((f) => ({ ...f, warehouse_id: e.target.value }))}
                >
                  <option value="">Pilih gudang...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.nama_gudang}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {addMessage && (
            <p className={`text-sm rounded-lg px-3 py-2 border ${
              addMessage.type === 'success'
                ? 'bg-brand-50 text-brand-700 border-brand-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {addMessage.text}
            </p>
          )}

          <button type="submit" disabled={addSubmitting} className="btn-primary w-full">
            {addSubmitting ? 'Membuat user...' : 'Buat User'}
          </button>
          <p className="text-xs text-black/40">
            Butuh Edge Function <code className="font-mono">create-user</code> sudah ter-deploy di Supabase.
            Lihat bagian deploy di tutorial kalau tombol ini gagal.
          </p>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-black/[0.02] text-left text-xs font-semibold uppercase tracking-wide text-black/40">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Gudang</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-black/40">Memuat...</td></tr>
            ) : profiles.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-black/40">Belum ada pengguna.</td></tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="px-4 py-3 text-black/60">{p.email}</td>
                  <td className="px-4 py-3">
                    <input
                      className="input py-1.5"
                      value={p.nama ?? ''}
                      onChange={(e) => updateLocal(p.id, 'nama', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input py-1.5"
                      value={p.role}
                      onChange={(e) => updateLocal(p.id, 'role', e.target.value)}
                    >
                      <option value="staff_gudang">Staff Gudang</option>
                      <option value="frontliner">Frontliner</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input py-1.5"
                      value={p.warehouse_id ?? ''}
                      disabled={p.role === 'admin'}
                      onChange={(e) => updateLocal(p.id, 'warehouse_id', e.target.value)}
                    >
                      <option value="">
                        {p.role === 'admin' ? 'Akses semua gudang' : 'Pilih gudang...'}
                      </option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.nama_gudang}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-secondary py-1.5"
                      disabled={savingId === p.id}
                      onClick={() => saveRow(p)}
                    >
                      {savingId === p.id ? 'Menyimpan...' : 'Simpan'}
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
