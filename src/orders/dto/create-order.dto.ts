import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsObject,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @IsInt()
  @IsOptional()
  companyId?: number;

  @IsInt()
  @IsOptional()
  productId?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  process?: string;

  @IsString()
  @IsOptional()
  order_status?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  rank?: number;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @IsObject()
  addl_attr?: object;

  @IsOptional()
  createdAt?: Date;
}
