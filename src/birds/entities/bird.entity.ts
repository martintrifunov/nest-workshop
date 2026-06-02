import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('birds')
export class BirdEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  species!: string;

  @Column('int')
  age!: number;
}