import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const READER_ELEMENT_ID = 'scan-reader'

export default function ScanKeluar() {
  const { profile, isAdmin, user } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState('')

  const [mode, setMode] = useState('idle') // 'idle' | 'scanning' | 'manual'
  const [scannedItem, setScannedItem] = useState(null) // { item, stockRow, currentStock }
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [items, setItems] = useState([])
  const [manualItemId, setManualItemId] = useState('')
  const [manualSearch, setManualSearch] = useState('')

  const scannerRef = useRef(null)
  const warehouseId = isAdmin ? selectedWarehouse : profile?.warehouse_id

  useEffect(() => {
    if (isAdmin) loadWarehouses()
    loadItems()
    return () => {
      stopScan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Baru mulai kamera SETELAH elemen #scan-reader benar-benar ter-render
  // (kalau dipanggil di tick yang sama dengan setMode('scanning'), div-nya
  // masih dalam kondisi tersembunyi di banyak browser HP -> kamera gagal muncul).
  useEffect(() => {
    if (mode === 'scanning') {
      startCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function loadWarehouses() {
    const { data } = await supabase.from('warehouses').select('id, nama_gudang').order('nama_gudang')
    setWarehouses(data ?? [])
  }

  async function loadItems() {
    const { data } = await supabase.from('posm_items').select('id, nama, kode_posm, satuan').order('nama')
    setItems(data ?? [])
  }

  function handleStartScanClick() {
    if (!warehouseId) {
      setMessage({ type: 'error', text: 'Pilih gudang terlebih dahulu.' })
      return
    }
    setMessage(null)
    setScannedItem(null)
    setMode('scanning')
  }

  async function startCamera() {
    const html5Qr = new Html5Qrcode(READER_ELEMENT_ID)
    scannerRef.current = html5Qr

    const config = { fps: 10, qrbox: { width: 260, height: 160 } }

    try {
      // Coba kamera belakang dulu (umum untuk HP)
      await html5Qr.start({ facingMode: 'environment' }, config, handleScanSuccess, () => {})
    } catch (e1) {
      try {
        // Fallback: beberapa HP/laptop tidak punya kamera yang cocok
        // dengan facingMode "environment" (mis. laptop, atau HP tertentu).
        // Coba pakai daftar kamera yang tersedia.
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras || cameras.length === 0) {
          throw new Error('Tidak ada kamera terdeteksi di perangkat ini.')
        }
        await html5Qr.start(cameras[0].id, config, handleScanSuccess, () => {})
      } catch (e2) {
        setMessage({
          type: 'error',
          text:
            'Gagal mengakses kamera. Pastikan: (1) izin kamera diaktifkan untuk browser ini, ' +
            '(2) halaman diakses lewat HTTPS atau localhost, (3) kamera tidak sedang dipakai aplikasi lain.',
        })
        setMode('idle')
      }
    }
  }

  async function stopScan() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (e) {
        // kamera mungkin sudah berhenti, aman diabaikan
      }
      scannerRef.current = null
    }
    setMode((m) => (m === 'scanning' ? 'idle' : m))
  }

  async function handleScanSuccess(decodedText) {
    await stopScan()
    await lookupAndShowItem({ kode_posm: decodedText.trim() })
  }

  async function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualItemId) {
      setMessage({ type: 'error', text: 'Pilih item terlebih dahulu.' })
      return
    }
    if (!warehouseId) {
      setMessage({ type: 'error', text: 'Pilih gudang terlebih dahulu.' })
      return
    }
    const item = items.find((it) => String(it.id) === String(manualItemId))
    if (!item) return
    await lookupAndShowItem(item)
  }

  async function lookupAndShowItem(itemHint) {
    setMessage(null)

    let item = itemHint
    // Kalau dari hasil scan, kita cuma punya kode_posm — ambil detail lengkapnya.
    if (!item.id) {
      const { data } = await supabase
        .from('posm_items')
        .select('id, nama, kode_posm, satuan')
        .eq('kode_posm', item.kode_posm)
        .maybeSingle()
      if (!data) {
        setMessage({ type: 'error', text: `Kode "${item.kode_posm}" tidak ditemukan di Master POSM.` })
        return
      }
      item = data
    }

    const { data: stockRow } = await supabase
      .from('stock')
      .select('id, jumlah')
      .eq('posm_item_id', item.id)
      .eq('warehouse_id', warehouseId)
      .maybeSingle()

    setScannedItem({ item, stockRow, currentStock: stockRow?.jumlah ?? 0 })
    setQty(1)
    setMessage(null)
  }

  async function handleConfirmKeluar() {
    setMessage(null)
    const jumlahInput = parseInt(qty, 10)

    if (!jumlahInput || jumlahInput <= 0) {
      setMessage({ type: 'error', text: 'Jumlah harus lebih dari 0.' })
      return
    }
    const stokBaru = scannedItem.currentStock - jumlahInput
    if (stokBaru < 0) {
      setMessage({ type: 'error', text: `Stok tidak cukup. Stok saat ini: ${scannedItem.currentStock}.` })
      return
    }

    setSubmitting(true)

    const { error: movError } = await supabase.from('stock_movements').insert({
      posm_item_id: scannedItem.item.id,
      warehouse_id: warehouseId,
      tipe: 'keluar',
      jumlah: jumlahInput,
      keterangan: `${mode === 'manual' ? 'Input manual' : 'Scan barcode'} oleh ${profile?.nama ?? 'user'}`,
      created_by: user.id,
    })

    if (movError) {
      setMessage({ type: 'error', text: 'Gagal menyimpan transaksi: ' + movError.message })
      setSubmitting(false)
      return
    }

    const { error: stockError } = scannedItem.stockRow
      ? await supabase.from('stock').update({ jumlah: stokBaru }).eq('id', scannedItem.stockRow.id)
      : await supabase.from('stock').insert({ posm_item_id: scannedItem.item.id, warehouse_id: warehouseId, jumlah: stokBaru })

    setSubmitting(false)

    if (stockError) {
      setMessage({ type: 'error', text: 'Transaksi tercatat, tapi gagal update stok: ' + stockError.message })
      return
    }

    setMessage({ type: 'success', text: `Berhasil. Stok "${scannedItem.item.nama}" sekarang: ${stokBaru}.` })
    setScannedItem(null)
    setManualItemId('')
    setManualSearch('')
    setMode('idle')
  }

  function handleCancel() {
    setScannedItem(null)
    setMessage(null)
  }

  const filteredManualItems = items.filter(
    (it) =>
      it.nama.toLowerCase().includes(manualSearch.toLowerCase()) ||
      it.kode_posm.toLowerCase().includes(manualSearch.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Scan Stok Keluar</h1>
        <p className="text-black/45 text-sm mt-1">
          Scan barcode, atau pilih item secara manual, untuk langsung mengurangi stok.
        </p>
      </div>

      {isAdmin && (
        <div className="card p-4 mb-4 max-w-md">
          <label className="label">Gudang</label>
          <select
            className="input"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            disabled={mode === 'scanning'}
          >
            <option value="">Pilih gudang...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.nama_gudang}</option>
            ))}
          </select>
        </div>
      )}

      {!isAdmin && (
        <p className="text-sm text-black/45 mb-4">
          Gudang: <span className="font-semibold text-ink">{profile?.warehouses?.nama_gudang ?? '-'}</span>
        </p>
      )}

      <div className="card p-6 max-w-md">
        {/* Pilihan mode: hanya tampil kalau belum ada item terpilih & tidak sedang scanning */}
        {mode === 'idle' && !scannedItem && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={handleStartScanClick} className="btn-primary">
              📷 Scan Barcode
            </button>
            <button onClick={() => { setMode('manual'); setMessage(null) }} className="btn-secondary">
              ✍️ Input Manual
            </button>
          </div>
        )}

        {/* Area kamera - selalu di-render (supaya elemen #scan-reader ada di DOM
            sebelum kamera dinyalakan), tapi disembunyikan kalau tidak dipakai. */}
        <div
          id={READER_ELEMENT_ID}
          className={mode === 'scanning' ? 'rounded-lg overflow-hidden mb-4' : 'hidden'}
        />

        {mode === 'scanning' && (
          <button onClick={stopScan} className="btn-secondary w-full">
            Batalkan Scan
          </button>
        )}

        {mode === 'manual' && !scannedItem && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="label">Cari Item</label>
              <input
                className="input"
                placeholder="Ketik nama atau kode POSM..."
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Pilih Item</label>
              <select
                className="input"
                value={manualItemId}
                onChange={(e) => setManualItemId(e.target.value)}
                size={Math.min(6, Math.max(3, filteredManualItems.length))}
              >
                {filteredManualItems.map((it) => (
                  <option key={it.id} value={it.id}>{it.kode_posm} — {it.nama}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => { setMode('idle'); setManualItemId(''); setManualSearch('') }}
              >
                Batal
              </button>
              <button type="submit" className="btn-primary flex-1">Lanjut</button>
            </div>
          </form>
        )}

        {scannedItem && (
          <div className="space-y-4">
            <div className="rounded-lg bg-black/[0.03] p-4">
              <p className="text-xs text-black/40 font-mono">{scannedItem.item.kode_posm}</p>
              <p className="font-display font-semibold text-lg">{scannedItem.item.nama}</p>
              <p className="text-sm text-black/50 mt-1">
                Stok saat ini: <span className="font-semibold text-ink">{scannedItem.currentStock} {scannedItem.item.satuan}</span>
              </p>
            </div>

            <div>
              <label className="label">Jumlah Keluar</label>
              <input
                type="number"
                min="1"
                className="input"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={handleCancel}>
                Batal
              </button>
              <button
                className="btn-primary flex-1"
                disabled={submitting}
                onClick={handleConfirmKeluar}
              >
                {submitting ? 'Menyimpan...' : 'Konfirmasi Keluar'}
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className={`text-sm rounded-lg px-3 py-2 border mt-4 ${
            message.type === 'success'
              ? 'bg-brand-50 text-brand-700 border-brand-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
