import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBirdDto } from './dto/create-bird.dto';
import { BirdEntity } from './entities/bird.entity';

@Injectable()
export class BirdsService {
  constructor(
    @InjectRepository(BirdEntity)
    private readonly birdsRepository: Repository<BirdEntity>,
  ) {}

  async create(createBirdDto: CreateBirdDto): Promise<BirdEntity> {
    const bird = this.birdsRepository.create({
      name: createBirdDto.name,
      species: createBirdDto.species,
      age: createBirdDto.age,
    });

    return this.birdsRepository.save(bird);
  }

  async findAll(): Promise<BirdEntity[]> {
    return this.birdsRepository.find();
  }
}
