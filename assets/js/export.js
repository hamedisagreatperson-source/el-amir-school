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
      headStyles: { fillColor: [107, 70, 193], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 240, 255] },
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

  function toCSV(data, filename) {
    if (!data || data.length === 0) { Toast.warning('لا توجد بيانات للتصدير'); return; }
    const headers = Object.keys(data[0]);
    const csvContent = '\uFEFF' + headers.join(',') + '\n' +
      data.map(row => headers.map(h => {
        const val = String(row[h] || '').replace(/"/g, '""');
        return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
      }).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    Toast.success('تم تصدير CSV بنجاح');
  }

  function toWord(data, columns, title, filename) {
    if (!data || data.length === 0) { Toast.warning('لا توجد بيانات للتصدير'); return; }
    const tableRows = data.map(row =>
      '<tr>' + columns.map(c => `<td style="border:1px solid #ccc;padding:6px;text-align:right">${row[c.key] || ''}</td>`).join('') + '</tr>'
    ).join('');
    const headerRow = '<tr>' + columns.map(c => `<th style="border:1px solid #ccc;padding:8px;background:#6B46C1;color:#fff;text-align:right">${c.header}</th>`).join('') + '</tr>';
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>body{direction:rtl;font-family:Arial,sans-serif}</style></head>
      <body><h2 style="text-align:center;color:#6B46C1">${title}</h2>
      <p style="text-align:center;color:#888">${new Date().toLocaleString('ar-DZ')}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">${headerRow}${tableRows}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.doc`;
    link.click();
    URL.revokeObjectURL(link.href);
    Toast.success('تم تصدير Word بنجاح');
  }

  return { toExcel, toPDF, toCSV, toWord };
})();
