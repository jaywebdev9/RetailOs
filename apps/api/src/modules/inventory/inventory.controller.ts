import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CompleteStockCountDto } from './dto/stock-count.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private businessId(headers: Record<string, string>) {
    return headers['x-business-id'];
  }

  @Post('adjust')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Manual stock adjustment' })
  adjust(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(
      this.businessId(headers),
      req.user.sub,
      dto,
    );
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Products at or below reorder level' })
  lowStock(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.inventoryService.getLowStock(
      this.businessId(headers),
      req.user.sub,
    );
  }

  @Post('stock-counts')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.count')
  @ApiOperation({ summary: 'Start a new stock count' })
  startCount(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.inventoryService.startStockCount(
      this.businessId(headers),
      req.user.sub,
    );
  }

  @Get('stock-counts/active')
  @ApiOperation({ summary: 'Get active stock count' })
  activeCount(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.inventoryService.getActiveStockCount(
      this.businessId(headers),
      req.user.sub,
    );
  }

  @Post('stock-counts/:id/complete')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('inventory.count')
  @ApiOperation({ summary: 'Complete stock count and apply adjustments' })
  completeCount(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: CompleteStockCountDto,
  ) {
    return this.inventoryService.completeStockCount(
      this.businessId(headers),
      req.user.sub,
      id,
      dto,
    );
  }
}
