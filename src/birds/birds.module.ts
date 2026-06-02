import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BirdsController } from './birds.controller';
import { BirdsService } from './birds.service';
import { BirdEntity } from './entities/bird.entity';

@Module({
    imports: [TypeOrmModule.forFeature([BirdEntity])],
    controllers: [BirdsController],
    providers: [BirdsService],
})
export class BirdsModule {}