import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsObject,
  Allow,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsInt()
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = obj.companyId ?? obj.company_id;
    return Number(raw);
  })
  companyId?: number;

  /** Alias so snake_case payloads are not rejected by ValidationPipe. */
  @Allow()
  company_id?: number;

  @IsInt()
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = obj.productId ?? obj.product_id;
    return Number(raw);
  })
  productId?: number;

  /** Alias so snake_case payloads are not rejected by ValidationPipe. */
  @Allow()
  product_id?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
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

}
