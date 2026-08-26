import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsInt()
  @IsOptional()
  companyId?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
