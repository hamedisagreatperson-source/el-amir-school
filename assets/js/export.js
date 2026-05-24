const Export = (() => {
  async function toExcel(data, filename) {
    if (!window.XLSX) {
      await loadScript('https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js');
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات');

    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `${filename}.xlsx`, { bookType: 'xlsx', type: 'binary' });
    Toast.success('تم تصدير الملف بنجاح');
  }

  async function toPDF(data, columns, title, filename) {
    if (!window.jspdf) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, doc.internal.pageSize.width / 2, 15, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(128);
    doc.text(new Date().toLocaleString('ar-DZ'), doc.internal.pageSize.width / 2, 22, { align: 'center' });

    const head = [columns.map(c => c.header)];
    const body = data.map(row => columns.map(c => String(row[c.key] || '')));

    doc.autoTable({
      head,
      body,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3, halign: 'right' },
      headStyles: { fillColor: [74, 29, 107], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 245, 250] },
      margin: { top: 28 }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`${i} / ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
    }

    doc.save(`${filename}.pdf`);
    Toast.success('تم تصدير PDF بنجاح');
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return { toExcel, toPDF };
})();
