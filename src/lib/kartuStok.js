import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Ganti sesuai nama perusahaan kamu kalau berbeda.
const COMPANY_NAME = 'PT. FASTRATA BUANA'

/**
 * Cetak Kartu Stok dalam bentuk PDF, mengikuti format kartu stok fisik:
 * TGL | NOMOR BUKTI | DARI/KEPADA | MUTASI (MASUK/KELUAR) | SALDO
 *
 * @param {object} params
 * @param {{kode_posm:string, nama:string, satuan:string}} params.item
 * @param {{nama_gudang:string}} params.warehouse
 * @param {Array<{tanggal:string, nomor_bukti:string|null, dariKepada:string, tipe:string, jumlah:number}>} params.rows
 *   tipe salah satu dari: 'masuk' | 'keluar' | 'transfer_masuk' | 'transfer_keluar' | 'adjustment'
 *   rows harus sudah terurut dari transaksi paling lama ke paling baru.
 * @param {'download'|'view'} [params.mode] - 'download' (default) langsung
 *   unduh file; 'view' buka PDF di tab baru untuk dilihat saja.
 * @param {Window|null} [params.targetWindow] - untuk mode 'view': tab yang
 *   SUDAH dibuka lebih dulu (window.open('', '_blank')) sebelum proses async
 *   dimulai, supaya browser tidak menganggapnya pop-up dan memblokirnya.
 */
export function generateKartuStokPdf({ item, warehouse, rows, mode = 'download', targetWindow = null }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ---- Header ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(COMPANY_NAME, 14, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Gudang : ${warehouse?.nama_gudang ?? '-'}`, 14, 21)

  doc.setFontSize(10)
  doc.text('Kode Barang', 128, 15)
  doc.text(`: ${item?.kode_posm ?? '-'}`, 158, 15)
  doc.text('Nama Barang', 128, 21)
  doc.text(`: ${item?.nama ?? '-'}`, 158, 21)
  doc.text('Satuan', 128, 27)
  doc.text(`: ${item?.satuan ?? '-'}`, 158, 27)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('KARTU STOCK', 105, 37, { align: 'center' })

  // ---- Hitung saldo berjalan ----
  let saldo = 0
  const body = rows.map((r) => {
    let masuk = 0
    let keluar = 0

    if (r.tipe === 'masuk' || r.tipe === 'transfer_masuk') {
      masuk = r.jumlah
    } else if (r.tipe === 'keluar' || r.tipe === 'transfer_keluar') {
      keluar = r.jumlah
    } else if (r.tipe === 'adjustment') {
      // adjustment = menetapkan saldo baru secara langsung (hasil stock opname)
      const delta = r.jumlah - saldo
      if (delta >= 0) masuk = delta
      else keluar = -delta
    }

    saldo += masuk - keluar

    return [
      r.tanggal,
      r.nomor_bukti || '-',
      r.dariKepada || '-',
      masuk ? String(masuk) : '',
      keluar ? String(keluar) : '',
      String(saldo),
    ]
  })

  autoTable(doc, {
    startY: 42,
    head: [
      [
        { content: 'TGL.', rowSpan: 2 },
        { content: 'NOMOR BUKTI', rowSpan: 2 },
        { content: 'DARI / KEPADA', rowSpan: 2 },
        { content: 'MUTASI', colSpan: 2 },
        { content: 'SALDO', rowSpan: 2 },
      ],
      ['MASUK', 'KELUAR'],
    ],
    body: body.length ? body : [['-', '-', 'Belum ada transaksi', '', '', '0']],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      halign: 'center',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 48, halign: 'left' },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  })

  if (mode === 'view') {
    // Buka di tab baru untuk dilihat saja, tidak otomatis ke-download.
    const blobUrl = doc.output('bloburl')
    if (targetWindow) {
      targetWindow.location.href = blobUrl
    } else {
      window.open(blobUrl, '_blank')
    }
  } else {
    const safeName = (item?.nama ?? 'item').replace(/[^a-z0-9]+/gi, '-')
    doc.save(`Kartu-Stok_${item?.kode_posm ?? ''}_${safeName}.pdf`)
  }
}

/**
 * Ambil seluruh riwayat mutasi 1 item di 1 gudang (termasuk transfer masuk
 * dari gudang lain), lalu langsung cetak jadi PDF Kartu Stok.
 * Dipakai bareng di halaman Stok Gudang dan halaman Scan Stok Keluar supaya
 * tidak duplikat logika.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{item: {id:number, kode_posm:string, nama:string, satuan:string}, warehouse: {id:number, nama_gudang:string}, mode?: 'download'|'view', targetWindow?: Window|null}} params
 */
export async function fetchAndPrintKartuStok(supabase, { item, warehouse, mode = 'download', targetWindow = null }) {
  if (!item?.id || !warehouse?.id) {
    throw new Error('Data item atau gudang belum lengkap.')
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      id, tipe, jumlah, nomor_bukti, keterangan, created_at, warehouse_id, warehouse_tujuan_id,
      asal:warehouse_id(nama_gudang),
      tujuan:warehouse_tujuan_id(nama_gudang)
    `)
    .eq('posm_item_id', item.id)
    .or(`warehouse_id.eq.${warehouse.id},warehouse_tujuan_id.eq.${warehouse.id}`)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []).map((m) => {
    const tanggal = new Date(m.created_at).toLocaleDateString('id-ID')
    let tipe = m.tipe
    let dariKepada = m.keterangan || ''

    if (m.tipe === 'transfer') {
      if (m.warehouse_id === warehouse.id) {
        tipe = 'transfer_keluar'
        dariKepada = `Kepada: ${m.tujuan?.nama_gudang ?? '-'}`
      } else {
        tipe = 'transfer_masuk'
        dariKepada = `Dari: ${m.asal?.nama_gudang ?? '-'}`
      }
    } else if (!dariKepada) {
      dariKepada = m.tipe === 'masuk' ? 'Stok Masuk' : m.tipe === 'keluar' ? 'Stok Keluar' : 'Stock Opname'
    }

    return { tanggal, nomor_bukti: m.nomor_bukti, dariKepada, tipe, jumlah: m.jumlah }
  })

  generateKartuStokPdf({ item, warehouse, rows, mode, targetWindow })
}
