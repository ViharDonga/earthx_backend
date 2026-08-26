import { IsInt, Min } from 'class-validator';

export class UpdateRankDto {
  @IsInt()
  @Min(1)
  newRank: number;
}
