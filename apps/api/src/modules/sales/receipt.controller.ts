import { Controller, Get, Param, UseGuards, Req, Headers, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('sales')
export class ReceiptController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Get sale receipt (JSON)' })
  async getReceipt(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    const businessId = headers['x-business-id'];
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId: req.user.sub, isActive: true },
    });
    if (!membership) throw new ForbiddenException('No access');

    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        items: { include: { product: true } },
        payments: { include: { paymentMethod: true } },
        customer: true,
        cashier: { select: { firstName: true, lastName: true } },
        business: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');

    return {
      businessName: sale.business.name,
      businessPhone: sale.business.phone,
      receiptNumber: sale.receiptNumber,
      date: sale.createdAt,
      cashier: `${sale.cashier.firstName} ${sale.cashier.lastName || ''}`.trim(),
      customer: sale.customer?.name || null,
      items: sale.items.map((i) => ({
        name: i.product.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.sellingPrice),
        discount: Number(i.discount),
        total: Number(i.total),
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.total),
      payments: sale.payments.map((p) => ({
        method: p.paymentMethod.name,
        amount: Number(p.amount),
        reference: p.reference,
      })),
      paymentStatus: sale.paymentStatus,
    };
  }

  @Get(':id/receipt.html')
  @ApiOperation({ summary: 'Get printable HTML receipt (thermal-friendly)' })
  async getReceiptHtml(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const businessId = headers['x-business-id'];
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId: req.user.sub, isActive: true },
    });
    if (!membership) throw new ForbiddenException('No access');

    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        items: { include: { product: true } },
        payments: { include: { paymentMethod: true } },
        customer: true,
        cashier: { select: { firstName: true, lastName: true } },
        business: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const fmt = (n: number) => n.toLocaleString('en-TZ');
    const lines = sale.items
      .map(
        (i) =>
          `<tr><td>${i.product.name}</td><td style="text-align:right">${Number(i.quantity)}</td><td style="text-align:right">${fmt(Number(i.sellingPrice))}</td><td style="text-align:right">${fmt(Number(i.total))}</td></tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${sale.receiptNumber}</title>
<style>
  body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 8px; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .meta { text-align: center; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; }
  .total { font-weight: bold; border-top: 1px dashed #000; margin-top: 8px; padding-top: 4px; }
  .center { text-align: center; }
  @media print { body { margin: 0; } }
</style></head><body>
  <h1>${sale.business.name}</h1>
  <div class="meta">${sale.business.phone || ''}<br/>
  Receipt: ${sale.receiptNumber}<br/>
  ${new Date(sale.createdAt).toLocaleString()}<br/>
  Cashier: ${sale.cashier.firstName}</div>
  <table>
    <thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${lines}</tbody>
  </table>
  <div class="total">
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(Number(sale.subtotal))}</span></div>
    ${Number(sale.discount) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${fmt(Number(sale.discount))}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between"><span>TOTAL</span><span>${fmt(Number(sale.total))} ${sale.business.currency}</span></div>
  </div>
  <div style="margin-top:8px">
    ${sale.payments.map((p) => `${p.paymentMethod.name}: ${fmt(Number(p.amount))}`).join('<br/>')}
  </div>
  ${sale.customer ? `<div style="margin-top:8px">Customer: ${sale.customer.name}</div>` : ''}
  <p class="center" style="margin-top:16px">Asante / Thank you</p>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
