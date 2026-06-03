import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

class FieldSpecDto {
  @IsString() @IsOptional() source?: string;
  @IsString() @IsOptional() target?: string;
  @IsString() @IsOptional() type?: string;
}

class SpecDto {
  @IsObject({ each: true }) @IsOptional() fields?: FieldSpecDto[];
}

export class UpdateServiceDto {
  @IsString() @IsOptional() baseUrl?: string;
  @IsIn(['json', 'xml']) @IsOptional() responseFormat?: string;
  @IsString() @IsOptional() routePattern?: string;
  @IsBoolean() @IsOptional() authRequired?: boolean;
  @IsObject() @IsOptional() spec?: SpecDto;
}
