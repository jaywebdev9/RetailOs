import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Req() req: any) {
    return this.usersService.findById(req.user.sub);
  }

  @Get('me/businesses')
  @ApiOperation({ summary: 'List businesses the current user belongs to' })
  async myBusinesses(@Req() req: any) {
    return this.usersService.getMemberships(req.user.sub);
  }
}
