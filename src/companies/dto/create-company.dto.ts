import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsObject } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => !value || value?.trim() == '-' || value?.trim() == '' ? null : value?.trim())
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
