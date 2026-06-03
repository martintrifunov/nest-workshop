import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

class FieldSpecDto {
  @IsString() @IsNotEmpty() source!: string;
  @IsString() @IsNotEmpty() target!: string;
  @IsString() @IsNotEmpty() type!: string;
}

class SpecDto {
  @IsObject({ each: true }) fields!: FieldSpecDto[];
}

export class CreateServiceDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() baseUrl!: string;
  @IsIn(['json', 'xml']) responseFormat!: string;
  @IsString() @IsNotEmpty() routePattern!: string;
  @IsBoolean() @IsOptional() authRequired?: boolean;
  @IsObject() spec!: SpecDto;
}
