import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsObject,
  Allow,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @IsInt()
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = obj.companyId ?? obj.company_id;
    if (raw === undefined || raw === null || raw === '') return undefined;
    return Number(raw);
  })
  companyId?: number;

  @Allow()
  company_id?: number;

  @IsInt()
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = obj.productId ?? obj.product_id;
    if (raw === undefined || raw === null || raw === '') return undefined;
    return Number(raw);
  })
  productId?: number;

  @Allow()
  product_id?: number;

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
