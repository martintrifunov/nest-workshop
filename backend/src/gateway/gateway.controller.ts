import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { GatewayService } from './gateway.service';

const vp = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });

@Controller('services')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get()
  findAll() {
    return this.gatewayService.findAll();
  }

  @Get(':name/logs')
  getLogs(@Param('name') name: string) {
    return this.gatewayService.getLogs(name);
  }

  @Get(':name')
  findOne(@Param('name') name: string) {
    return this.gatewayService.findOne(name);
  }

  @Post()
  @Roles('developer')
  create(@Body(vp) dto: CreateServiceDto) {
    return this.gatewayService.create(dto);
  }

  @Put(':name')
  update(@Param('name') name: string, @Body(vp) dto: UpdateServiceDto) {
    return this.gatewayService.update(name, dto);
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('developer')
  remove(@Param('name') name: string) {
    return this.gatewayService.remove(name);
  }
}
