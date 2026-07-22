import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'

function BarcodeLabel({ item }) {
  const qrCanvasRef = useRef(null)
  const barcodeCanvasRef = useRef(null)

  useEffect(() => {
    if (!item?.kode_posm) return

    // QR code = format utama untuk discan kamera HP (jauh lebih andal
    // dibaca kamera dibanding barcode garis-garis/1D).
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, item.kode_posm, { width: 130, margin: 1 }, (err) => {
        if (err) console.error('Gagal membuat QR code untuk', item.kode_posm, err)
      })
    }

    // Barcode CODE128 = tetap disertakan untuk kompatibilitas kalau nanti
    // pakai alat scanner genggam/laser (yang justru lebih andal baca 1D).
    if (barcodeCanvasRef.current) {
      try {
        JsBarcode(barcodeCanvasRef.current, item.kode_posm, {
          format: 'CODE128',
          width: 1.6,
          height: 32,
          displayValue: true,
          fontSize: 11,
          margin: 4,
        })
      } catch (e) {
        console.error('Gagal membuat barcode untuk', item.kode_posm, e)
      }
    }
  }, [item])

  return (
    <div className="border border-black/15 rounded-lg p-3 flex flex-col items-center gap-2 break-inside-avoid">
      <canvas ref={qrCanvasRef} />
      <canvas ref={barcodeCanvasRef} />
      <p className="text-xs font-semibold text-center">{item.nama}</p>
    </div>
  )
}

export default function BarcodePrint() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('posm_items')
      .select('id, kode_posm, nama')
      .order('nama')
    setItems(data ?? [])
    setSelected(new Set((data ?? []).map((it) => it.id)))
    setLoading(false)
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((it) => it.id))))
  }

  const selectedItems = items.filter((it) => selected.has(it.id))

  return (
    <div>
      <div className="mb-6 no-print flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Cetak Barcode</h1>
          <p className="text-black/45 text-sm mt-1">
            Setiap label berisi QR code (utama, dibaca kamera HP di halaman Scan) dan
            barcode CODE128 (cadangan, untuk alat scanner genggam kalau ada). Isinya sama:
            kode POSM item tersebut.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => window.print()} disabled={selectedItems.length === 0}>
          🖨 Cetak ({selectedItems.length})
        </button>
      </div>

      <div className="no-print card p-4 mb-6">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={items.length > 0 && selected.size === items.length}
            onChange={toggleAll}
          />
          Pilih semua ({items.length} item)
        </label>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-black/40">Memuat...</p>
          ) : (
            items.map((it) => (
              <label key={it.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-black/[0.02] cursor-pointer">
                <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                <span className="font-mono text-xs text-black/40">{it.kode_posm}</span>
                <span className="truncate">{it.nama}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Area cetak: grid label QR + barcode */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:gap-3">
        {selectedItems.map((it) => (
          <BarcodeLabel key={it.id} item={it} />
        ))}
      </div>

      {!loading && selectedItems.length === 0 && (
        <p className="no-print text-sm text-black/40 mt-4">Belum ada item dipilih untuk dicetak.</p>
      )}
    </div>
  )
}
