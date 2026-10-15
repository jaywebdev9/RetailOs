import {
  Controller, Get, Post, Body, Query, UseGuards, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  private businessId(h: Record<string, string>) {
    return h['x-business-id'];
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('expenses.create')
  @ApiOperation({ summary: 'Record expense' })
  create(@Req() req: any, @Headers() h: Record<string, string>, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(this.businessId(h), req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List expenses' })
  findAll(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expensesService.findAll(this.businessId(h), req.user.sub, { from, to });
  }

  @Get('categories')
  @ApiOperation({ summary: 'List expense categories' })
  categories(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.expensesService.categories(this.businessId(h), req.user.sub);
  }
}
