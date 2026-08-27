import { IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderOrderItemDto {
  @IsInt()
  id: number;

  @IsInt()
  @Min(1)
  rank: number;
}

export class ReorderOrdersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderOrderItemDto)
  items: ReorderOrderItemDto[];
}
