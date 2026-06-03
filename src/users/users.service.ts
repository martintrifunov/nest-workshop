import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
    constructor(
        @InjectRepository(UserEntity)
        private readonly usersRepository: Repository<UserEntity>,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.seedDefaults();
    }

    async create(createUserDto: CreateUserDto): Promise<Omit<UserEntity, 'password'>> {
        const existingUser = await this.findOne(createUserDto.username);
        if (existingUser) {
            throw new ConflictException('Username already exists');
        }

        const user = this.usersRepository.create({
            username: createUserDto.username,
            password: await hash(createUserDto.password, 10),
        });

        const savedUser = await this.usersRepository.save(user);
        return {
            id: savedUser.id,
            username: savedUser.username,
        };
    }

    async findOne(username: string): Promise<UserEntity | null> {
        return this.usersRepository.findOne({ where: { username } });
    }

    private async seedDefaults(): Promise<void> {
        const usersCount = await this.usersRepository.count();
        if (usersCount > 0) {
            return;
    }

        const seededUsers = await Promise.all([
            this.usersRepository.create({
                username: 'john',
                password: await hash('changeme', 10),
            }),
            this.usersRepository.create({
                username: 'maria',
                password: await hash('guess', 10),
            }),
        ]);

        await this.usersRepository.save(seededUsers);
    }
}
