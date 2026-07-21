import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const READER_ELEMENT_ID = 'scan-reader'

export default function ScanKeluar() {
  const { profile, isAdmin, user } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scannedItem, setScannedItem] = useState(null) // { item, stockRow, currentStock }
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const scannerRef = useRef(null)

  const warehouseId = isAdmin ? selectedWarehouse : profile?.warehouse_id

  useEffect(() => {
    if (isAdmin) loadWarehouses()
    return () => {
      stopScan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadWarehouses() {
    const { data } = await supabase.from('warehouses').select('id, nama_gudang').order('nama_gudang')
    setWarehouses(data ?? [])
  }

  async function startScan() {
    if (!warehouseId) {
      setMessage({ type: 'error', text: 'Pilih gudang terlebih dahulu.' })
      return
    }
    setMessage(null)
    setScannedItem(null)

    const html5Qr = new Html5Qrcode(READER_ELEMENT_ID)
    scannerRef.current = html5Qr
    setScanning(true)

    try {
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        handleScanSuccess,
        () => {} // diabaikan: dipanggil tiap frame yang belum berhasil decode
      )
    } catch (e) {
      setMessage({ type: 'error', text: 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan di browser.' })
      setScanning(false)
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
    setScanning(false)
  }

  async function handleScanSuccess(decodedText) {
    await stopScan()

    const { data: item } = await supabase
      .from('posm_items')
      .select('id, nama, kode_posm, satuan')
      .eq('kode_posm', decodedText.trim())
      .maybeSingle()

    if (!item) {
      setMessage({ type: 'error', text: `Kode "${decodedText}" tidak ditemukan di Master POSM.` })
      return
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
      keterangan: `Scan barcode oleh ${profile?.nama ?? 'user'}`,
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
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Scan Stok Keluar</h1>
        <p className="text-black/45 text-sm mt-1">
          Scan barcode item POSM untuk langsung mengurangi stok.
        </p>
      </div>

      {isAdmin && (
        <div className="card p-4 mb-4 max-w-md">
          <label className="label">Gudang</label>
          <select
            className="input"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            disabled={scanning}
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
        <div id={READER_ELEMENT_ID} className={scanning ? 'rounded-lg overflow-hidden mb-4' : 'hidden'} />

        {!scanning && !scannedItem && (
          <button onClick={startScan} className="btn-primary w-full">
            📷 Mulai Scan
          </button>
        )}

        {scanning && (
          <button onClick={stopScan} className="btn-secondary w-full">
            Batalkan Scan
          </button>
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
              <button
                className="btn-secondary flex-1"
                onClick={() => { setScannedItem(null); setMessage(null) }}
              >
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
