import { useState } from 'react'

/**
 * Pengganti <select> biasa untuk memilih item POSM, dengan kolom pencarian
 * di atasnya supaya gampang ditemukan kalau daftar itemnya panjang.
 */
export default function ItemPicker({ items, value, onChange, placeholder = 'Cari nama atau kode POSM...' }) {
  const [search, setSearch] = useState('')

  const filtered = items.filter(
    (it) =>
      it.nama.toLowerCase().includes(search.toLowerCase()) ||
      it.kode_posm.toLowerCase().includes(search.toLowerCase())
  )

  const selectedItem = items.find((it) => String(it.id) === String(value))

  return (
    <div>
      <input
        className="input mb-2"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        size={Math.min(6, Math.max(3, filtered.length || 1))}
      >
        {filtered.length === 0 ? (
          <option disabled>Tidak ada item cocok</option>
        ) : (
          filtered.map((it) => (
            <option key={it.id} value={it.id}>{it.kode_posm} — {it.nama}</option>
          ))
        )}
      </select>
      {selectedItem && (
        <p className="text-xs text-black/40 mt-1.5">
          Dipilih: <span className="font-medium text-black/60">{selectedItem.kode_posm} — {selectedItem.nama}</span>
        </p>
      )}
    </div>
  )
}
