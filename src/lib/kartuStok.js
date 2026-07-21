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
 */
export function generateKartuStokPdf({ item, warehouse, rows }) {
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

  const safeName = (item?.nama ?? 'item').replace(/[^a-z0-9]+/gi, '-')
  doc.save(`Kartu-Stok_${item?.kode_posm ?? ''}_${safeName}.pdf`)
}
