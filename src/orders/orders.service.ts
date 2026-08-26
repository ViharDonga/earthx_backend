import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const processName = createOrderDto.process || 'General';
    const targetRank = createOrderDto.rank || 1;

    // Use transaction to adjust existing ranks and insert new order
    return await this.dataSource.transaction(async (manager) => {
      // Shift existing orders in the same process with rank >= targetRank by +1
      await manager
        .createQueryBuilder()
        .update(Order)
        .set({ rank: () => '`rank` + 1' })
        .where('process = :process AND rank >= :targetRank', {
          process: processName,
          targetRank,
        })
        .execute();

      const order = manager.create(Order, {
        ...createOrderDto,
        process: processName,
        rank: targetRank,
      });

      return await manager.save(order);
    });
  }

  async findAll(
    companyId?: number,
    productId?: number,
    process?: string,
    status?: OrderStatus,
  ): Promise<Order[]> {
    const query = this.ordersRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.product', 'product');

    if (companyId) {
      query.andWhere('order.companyId = :companyId', { companyId });
    }

    if (productId) {
      query.andWhere('order.productId = :productId', { productId });
    }

    if (process) {
      query.andWhere('order.process = :process', { process });
    }

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    return await query
      .orderBy('order.process', 'ASC')
      .addOrderBy('order.rank', 'ASC') // Ranked 1, 2, 3...
      .addOrderBy('order.id', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['company', 'product'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    return order;
  }

  /**
   * Update an order's rank and re-shift all affected orders in the same process
   * Example: Changing order from rank 6 to rank 1 will shift ranks 1..5 to 2..6.
   */
  async updateRank(id: number, newRank: number): Promise<Order[]> {
    if (newRank < 1) {
      throw new BadRequestException('Rank must be at least 1');
    }

    const targetOrder = await this.findOne(id);
    const oldRank = targetOrder.rank;
    const processName = targetOrder.process;

    if (oldRank === newRank) {
      return this.findAll(undefined, undefined, processName);
    }

    await this.dataSource.transaction(async (manager) => {
      if (newRank < oldRank) {
        // Moving UP (e.g. from 6 to 1): Shift intermediate ranks DOWN by +1
        await manager
          .createQueryBuilder()
          .update(Order)
          .set({ rank: () => '`rank` + 1' })
          .where(
            'process = :process AND rank >= :newRank AND rank < :oldRank AND id != :id',
            {
              process: processName,
              newRank,
              oldRank,
              id,
            },
          )
          .execute();
      } else {
        // Moving DOWN (e.g. from 1 to 4): Shift intermediate ranks UP by -1
        await manager
          .createQueryBuilder()
          .update(Order)
          .set({ rank: () => '`rank` - 1' })
          .where(
            'process = :process AND rank > :oldRank AND rank <= :newRank AND id != :id',
            {
              process: processName,
              oldRank,
              newRank,
              id,
            },
          )
          .execute();
      }

      // Assign the new rank to the target order
      await manager.update(Order, id, { rank: newRank });
    });

    // Return the newly sorted order list for this process
    return this.findAll(undefined, undefined, processName);
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    if (updateOrderDto.rank && updateOrderDto.rank !== order.rank) {
      await this.updateRank(id, updateOrderDto.rank);
      delete updateOrderDto.rank;
    }

    Object.assign(order, updateOrderDto);
    return await this.ordersRepository.save(order);
  }

  async remove(id: number): Promise<{ message: string }> {
    const order = await this.findOne(id);
    const { process, rank } = order;

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(order);

      // Normalize ranks: decrement ranks greater than deleted order's rank
      await manager
        .createQueryBuilder()
        .update(Order)
        .set({ rank: () => '`rank` - 1' })
        .where('process = :process AND rank > :rank', { process, rank })
        .execute();
    });

    return { message: `Order with ID "${id}" removed successfully` };
  }
}
