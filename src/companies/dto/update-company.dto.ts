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

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsBoolean()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  addl_attr?: object;
}
