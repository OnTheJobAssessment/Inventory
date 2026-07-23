import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabaseClient'

function BarcodePreview({ item }) {
  const qrCanvasRef = useRef(null)
  const barcodeCanvasRef = useRef(null)

  useEffect(() => {
    if (!item?.kode_posm) return
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, item.kode_posm, { width: 110, margin: 1 }, (err) => {
        if (err) console.error('Gagal membuat QR code untuk', item.kode_posm, err)
      })
    }
    if (barcodeCanvasRef.current) {
      try {
        JsBarcode(barcodeCanvasRef.current, item.kode_posm, {
          format: 'CODE128',
          width: 1.4,
          height: 28,
          displayValue: true,
          fontSize: 10,
          margin: 4,
        })
      } catch (e) {
        console.error('Gagal membuat barcode untuk', item.kode_posm, e)
      }
    }
  }, [item])

  return (
    <div className="border border-black/15 rounded-lg p-3 flex flex-col items-center gap-2">
      <canvas ref={qrCanvasRef} />
      <canvas ref={barcodeCanvasRef} />
      <p className="text-xs font-semibold text-center">{item.nama}</p>
    </div>
  )
}

// ---- Layout label PDF: 2 kolom x beberapa baris, mengikuti ukuran kertas A4 ----
const PAGE = { width: 210, height: 297 } // mm, A4 potrait
const MARGIN = 12
const COLS = 2
const COL_GAP = 8
const ROW_GAP = 8
const BOX_HEIGHT = 85
const COL_WIDTH = (PAGE.width - 2 * MARGIN - (COLS - 1) * COL_GAP) / COLS
const ROWS_PER_PAGE = Math.floor((PAGE.height - 2 * MARGIN + ROW_GAP) / (BOX_HEIGHT + ROW_GAP))
const PER_PAGE = COLS * ROWS_PER_PAGE

async function generateBarcodeSheetPdf(items) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const posInPage = i % PER_PAGE
    if (i > 0 && posInPage === 0) doc.addPage()

    const col = posInPage % COLS
    const row = Math.floor(posInPage / COLS)
    const x = MARGIN + col * (COL_WIDTH + COL_GAP)
    const y = MARGIN + row * (BOX_HEIGHT + ROW_GAP)

    // Kotak pembatas - satu kotak per item
    doc.setDrawColor(190)
    doc.roundedRect(x, y, COL_WIDTH, BOX_HEIGHT, 2, 2)

    // QR code (utama, dibaca kamera HP)
    const qrDataUrl = await QRCode.toDataURL(item.kode_posm, { width: 300, margin: 1 })
    const qrSize = 46
    doc.addImage(qrDataUrl, 'PNG', x + (COL_WIDTH - qrSize) / 2, y + 5, qrSize, qrSize)

    // Barcode CODE128 (cadangan, untuk scanner laser/genggam)
    const barcodeCanvas = document.createElement('canvas')
    JsBarcode(barcodeCanvas, item.kode_posm, {
      format: 'CODE128',
      width: 1.4,
      height: 28,
      displayValue: true,
      fontSize: 10,
      margin: 4,
    })
    const barcodeDataUrl = barcodeCanvas.toDataURL('image/png')
    const barcodeWidth = COL_WIDTH - 14
    const barcodeHeight = Math.min(18, barcodeWidth * (barcodeCanvas.height / barcodeCanvas.width))
    doc.addImage(barcodeDataUrl, 'PNG', x + 7, y + 5 + qrSize + 3, barcodeWidth, barcodeHeight)

    // Nama item (maksimal 2 baris, dipotong kalau kepanjangan)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(20)
    const nameLines = doc.splitTextToSize(item.nama, COL_WIDTH - 6).slice(0, 2)
    const textStartY = y + BOX_HEIGHT - (nameLines.length === 2 ? 10 : 7)
    nameLines.forEach((line, idx) => {
      doc.text(line, x + COL_WIDTH / 2, textStartY + idx * 4.2, { align: 'center' })
    })
  }

  doc.save('Label-Barcode-POSM.pdf')
}

export default function BarcodePrint() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

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

  async function handleGeneratePdf() {
    if (selectedItems.length === 0) return
    setGenerating(true)
    try {
      await generateBarcodeSheetPdf(selectedItems)
    } catch (e) {
      alert('Gagal membuat PDF: ' + e.message)
    }
    setGenerating(false)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl">Cetak Barcode</h1>
          <p className="text-black/45 text-sm mt-1">
            Setiap label berisi QR code (utama, dibaca kamera HP) dan barcode CODE128 (cadangan,
            untuk scanner genggam). Pilih item, lalu unduh sebagai satu file PDF siap cetak
            (2 label berdampingan, mengikuti ukuran kertas A4).
          </p>
        </div>
        <button
          className="btn-primary shrink-0"
          onClick={handleGeneratePdf}
          disabled={selectedItems.length === 0 || generating}
        >
          {generating ? 'Menyiapkan PDF...' : `⬇ Download PDF (${selectedItems.length})`}
        </button>
      </div>

      <div className="card p-4 mb-6">
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

      <p className="text-sm font-semibold text-black/60 mb-3">Pratinjau ({selectedItems.length} item dipilih)</p>

      {/* Pratinjau di layar - susunan aslinya di PDF tetap 2 kolom per halaman A4 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {selectedItems.map((it) => (
          <BarcodePreview key={it.id} item={it} />
        ))}
      </div>

      {!loading && selectedItems.length === 0 && (
        <p className="text-sm text-black/40 mt-4">Belum ada item dipilih.</p>
      )}
    </div>
  )
}
