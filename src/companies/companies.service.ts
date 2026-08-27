import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companyRepository.findOne({
      where: { name: createCompanyDto.name },
    });
    if (existing) {
      throw new ConflictException(`Company with name "${createCompanyDto.name}" already exists`);
    }

    const company = this.companyRepository.create(createCompanyDto);
    return await this.companyRepository.save(company);
  }

  async findAll(): Promise<Company[]> {
    return await this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.products', 'products')
      .where("company.status = 'OPEN' OR (company.status IS NULL AND company.isActive = true)")
      .orderBy('company.id', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['products', 'orders'],
    });
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }
    return company;
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);
    Object.assign(company, updateCompanyDto);
    return await this.companyRepository.save(company);
  }

  async remove(id: number): Promise<{ message: string }> {
    const company = await this.findOne(id);
    company.status = 'CLOSE';
    company.isActive = false;
    await this.companyRepository.save(company);
    return { message: `Company ID ${id} deleted successfully` };
  }
}
