import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsObject,
} from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  orderNumber?: string;

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

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

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
