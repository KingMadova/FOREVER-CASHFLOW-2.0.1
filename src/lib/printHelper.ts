// Fonction utilitaire partagée pour l'impression via iframe
// Récupère le vrai CSS compilé de l'app et l'injecte dans l'iframe

const CANVAS_TITLES: Record<string, string> = {
  'invoice_printable_canvas':         'Facture',
  'orders_registry_printable_canvas': 'Registre_Commandes',
  'report_printable_canvas':          'Rapport_Activite',
};

export const printCanvas = async (canvasId: string, customTitle?: string): Promise<void> => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const clone = canvas.cloneNode(true) as HTMLElement;
  clone.style.cssText = 'display:block!important;visibility:visible!important;';

  // Récupérer le vrai CSS compilé (fichier assets/index-*.css sur Vercel)
  let compiledCSS = '';
  const styleSheets = Array.from(document.styleSheets);
  for (const sheet of styleSheets) {
    try {
      // Feuilles inline (style tags)
      if (!sheet.href) {
        const rules = Array.from(sheet.cssRules || []).map(r => r.cssText).join('\n');
        compiledCSS += rules + '\n';
      } else {
        // Feuilles externes : fetch le contenu réel
        try {
          const res = await fetch(sheet.href);
          if (res.ok) compiledCSS += await res.text() + '\n';
        } catch {
          // CORS ou autre : on ignore
        }
      }
    } catch {
      // SecurityError sur certaines feuilles cross-origin
    }
  }

    const pageTitle = customTitle || CANVAS_TITLES[canvasId] || 'Document';
  const dateStr = new Date().toISOString().split('T')[0];
  const docTitle = `FCF_${pageTitle}_${dateStr}`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) { document.body.removeChild(iframe); return; }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    ${compiledCSS}
    @page { margin: 12mm; size: A4 portrait; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: white; color: #0f172a; font-family: 'Inter', ui-sans-serif, sans-serif; }
    /* Forcer l'affichage du canvas (hidden par défaut dans l'app) */
    #${canvasId} { display: block !important; visibility: visible !important; }
    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    /* Grilles Tailwind */
    .grid { display: grid !important; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
    /* Couleurs critiques */
    .bg-amber-500, .bg-\\[\\#f59e0b\\] { background-color: #f59e0b !important; }
    .bg-emerald-500 { background-color: #10b981 !important; }
    .bg-red-500 { background-color: #ef4444 !important; }
    .bg-slate-900 { background-color: #0f172a !important; }
    .bg-slate-50 { background-color: #f8fafc !important; }
    .bg-slate-100 { background-color: #f1f5f9 !important; }
    .text-white { color: #ffffff !important; }
    .text-slate-900 { color: #0f172a !important; }
    .text-emerald-600 { color: #059669 !important; }
    .text-red-600 { color: #dc2626 !important; }
    .text-amber-500 { color: #f59e0b !important; }
    .text-blue-600 { color: #2563eb !important; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
  iframeDoc.close();

  await new Promise<void>(resolve => {
    // Attendre que les fonts soient chargées
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      const cleanup = () => {
        try { document.body.removeChild(iframe); } catch {}
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 4000);
      resolve();
    }, 800);
  });
};
