import { api } from './api';

/**
 * Fetch receipt HTML with JWT and open print dialog via blob URL.
 */
export async function printReceipt(saleId: string, businessId: string) {
  const { data } = await api.get(`/sales/${saleId}/receipt`, {
    headers: { 'x-business-id': businessId },
  });

  const fmt = (n: number) => n.toLocaleString('en-TZ');
  // product / business names are user text: never inject them as raw HTML
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const itemRows = (data.items || [])
    .map(
      (i: any) =>
        `<tr>
          <td>${esc(i.name)}</td>
          <td style="text-align:right">${i.quantity}</td>
          <td style="text-align:right">${fmt(i.unitPrice)}</td>
          <td style="text-align:right">${fmt(i.total)}</td>
        </tr>`,
    )
    .join('');

  const payments = (data.payments || [])
    .map((p: any) => `${esc(p.method)}: ${fmt(p.amount)}`)
    .join('<br/>');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${data.receiptNumber}</title>
<style>
  body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 12px; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .meta { text-align: center; margin-bottom: 10px; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; font-size: 11px; }
  .total { font-weight: bold; border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; }
  .center { text-align: center; }
</style></head><body>
  <h1>${esc(data.businessName)}</h1>
  <div class="meta">
    ${data.businessPhone || ''}<br/>
    Receipt: ${data.receiptNumber}<br/>
    ${new Date(data.date).toLocaleString()}<br/>
    Cashier: ${data.cashier || ''}
  </div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="total">
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(data.subtotal)}</span></div>
    ${data.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${fmt(data.discount)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between"><span>TOTAL</span><span>${fmt(data.total)}</span></div>
  </div>
  <div style="margin-top:10px">${payments}</div>
  ${data.customer ? `<div style="margin-top:8px">Customer: ${esc(data.customer)}</div>` : ''}
  <p class="center" style="margin-top:16px">Asante / Thank you</p>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=320,height=600');
  if (win) {
    win.onload = () => {
      win.focus();
      win.print();
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
