import {
  Controller, Get, Post, Body, Param, UseGuards, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CashService } from './cash.service';
import { OpenCashSessionDto, CloseCashSessionDto, CashMovementDto } from './dto/cash-session.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Cash')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  private businessId(h: Record<string, string>) {
    return h['x-business-id'];
  }

  @Post('sessions/open')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.view')
  @ApiOperation({ summary: 'Open cash session' })
  open(@Req() req: any, @Headers() h: Record<string, string>, @Body() dto: OpenCashSessionDto) {
    return this.cashService.open(this.businessId(h), req.user.sub, dto);
  }

  @Post('sessions/:id/close')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.view')
  @ApiOperation({ summary: 'Close cash session with actual count' })
  close(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashService.close(this.businessId(h), req.user.sub, id, dto);
  }

  @Post('movements')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.view')
  @ApiOperation({ summary: 'Cash in / cash out / owner withdrawal on the open session' })
  movement(@Req() req: any, @Headers() h: Record<string, string>, @Body() dto: CashMovementDto) {
    return this.cashService.addMovement(this.businessId(h), req.user.sub, dto);
  }

  @Get('sessions/current')
  @ApiOperation({ summary: 'Get current open cash session' })
  current(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.cashService.current(this.businessId(h), req.user.sub);
  }
}
