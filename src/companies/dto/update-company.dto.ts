import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEmail, IsBoolean, IsObject } from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;


  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim() || null)
  email?: string;


  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  gstNumber?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  addl_attr?: object;
}
