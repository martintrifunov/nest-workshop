import { Body, Controller, Get, Post } from '@nestjs/common';
import { BirdsService } from './birds.service';
import { CreateBirdDto } from './dto/create-bird.dto';
import { BirdEntity } from './entities/bird.entity';

@Controller('birds')
export class BirdsController {
  constructor(private birdsService: BirdsService) {}

  @Post()
  async create(@Body() createBirdDto: CreateBirdDto): Promise<BirdEntity> {
    return this.birdsService.create(createBirdDto);
  }

  @Get()
  async findAll(): Promise<BirdEntity[]> {
    return this.birdsService.findAll();
  }
}
