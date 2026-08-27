import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    return await this.productRepository.save(product);
  }

  async findAll(companyId?: number): Promise<Product[]> {
    const query = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.company', 'company')
      .where("product.status = 'OPEN' OR (product.status IS NULL AND product.isActive = true)");

    if (companyId) {
      query.where('product.companyId = :companyId', { companyId });
    }

    return await query
      .orderBy('product.id', 'ASC') // 1, 2, 3...
      .getMany();
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return await this.productRepository.save(product);
  }

  async remove(id: number): Promise<{ message: string }> {
    const product = await this.findOne(id);
    product.status = 'CLOSE';
    product.isActive = false;
    await this.productRepository.save(product);
    return { message: `Product ID ${id} deleted successfully` };
  }
}
