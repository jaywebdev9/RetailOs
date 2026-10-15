import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductPackDto } from './dto/product-pack.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private businessId(headers: Record<string, string>) {
    return headers['x-business-id'];
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Create a product' })
  create(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(this.businessId(headers), req.user.sub, dto);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Import products from CSV text' })
  importCsv(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() body: { csv: string },
  ) {
    return this.productsService.importCsv(
      this.businessId(headers),
      req.user.sub,
      body.csv,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List products with current stock' })
  findAll(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findAll(this.businessId(headers), req.user.sub, {
      search,
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product with current stock' })
  findOne(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    return this.productsService.findOne(this.businessId(headers), req.user.sub, id);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Stock movement history for a product' })
  movements(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.getStockMovements(
      this.businessId(headers),
      req.user.sub,
      id,
      { page, limit },
    );
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.update')
  @ApiOperation({ summary: 'Update product' })
  update(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(this.businessId(headers), req.user.sub, id, dto);
  }

  @Post(':id/archive')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.update')
  @ApiOperation({ summary: 'Archive product' })
  archive(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    return this.productsService.archive(this.businessId(headers), req.user.sub, id);
  }

  @Post(':id/restore')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.update')
  @ApiOperation({ summary: 'Restore archived product' })
  restore(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    return this.productsService.restore(this.businessId(headers), req.user.sub, id);
  }

  @Post(':id/packs')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.update')
  @ApiOperation({ summary: 'Add a selling/buying pack (carton, sack...) to a product' })
  addPack(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: CreateProductPackDto,
  ) {
    return this.productsService.addPack(this.businessId(headers), req.user.sub, id, dto);
  }

  @Delete(':id/packs/:packId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('products.update')
  @ApiOperation({ summary: 'Remove a pack (history is kept)' })
  removePack(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Param('packId') packId: string,
  ) {
    return this.productsService.removePack(this.businessId(headers), req.user.sub, id, packId);
  }
}
