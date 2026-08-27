import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ReorderOrdersDto } from './dto/reorder-orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const processName = createOrderDto.process || 'General';

    // Use transaction to adjust existing ranks or append to the end
    return await this.dataSource.transaction(async (manager) => {
      let targetRank = createOrderDto.rank;

      if (targetRank !== undefined && targetRank !== null && targetRank > 0) {
        // Shift existing orders in the same process with rank >= targetRank by +1
        await manager
          .createQueryBuilder()
          .update(Order)
          .set({ rank: () => '`rank` + 1' })
          .where(
            '(process = :process OR (:process = \'General\' AND (process IS NULL OR process = \'\'))) AND rank >= :targetRank',
            {
              process: processName,
              targetRank,
            },
          )
          .execute();
      } else {
        // Calculate max rank + 1 for auto-incrementing order
        const maxRankResult = await manager
          .createQueryBuilder(Order, 'order')
          .where(
            'order.process = :process OR (:process = \'General\' AND (order.process IS NULL OR order.process = \'\'))',
            { process: processName },
          )
          .select('MAX(order.rank)', 'max')
          .getRawOne();

        targetRank = (Number(maxRankResult?.max) || 0) + 1;
      }

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
    order_status?: string,
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

    

    if (order_status) {
      query.andWhere('order.order_status = :order_status', { order_status });
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
   * Move an order up by swapping rank with the immediately previous order in the same scope
   */
  async moveUp(id: number): Promise<Order[]> {
    const currentOrder = await this.findOne(id);
    const processName = currentOrder.process || 'General';

    // Find the immediately previous record in the same scope (rank < current.rank)
    const previousOrder = await this.ordersRepository
      .createQueryBuilder('order')
      .where(
        '(order.process = :process OR (:process = \'General\' AND (order.process IS NULL OR order.process = \'\')))',
        { process: processName },
      )
      .andWhere('order.rank < :currentRank', { currentRank: currentOrder.rank })
      .andWhere("(order.order_status = 'OPEN' OR order.order_status IS NULL)")
      .orderBy('order.rank', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .getOne();

    // If already first, return current ordered list without error
    if (!previousOrder) {
      return this.findAll(undefined, undefined, processName);
    }

    // Safe swap inside transaction using temporary rank (0) to avoid index collisions
    await this.dataSource.transaction(async (manager) => {
      const currentRank = currentOrder.rank;
      const prevRank = previousOrder.rank;

      await manager.update(Order, currentOrder.id, { rank: 0 });
      await manager.update(Order, previousOrder.id, { rank: currentRank });
      await manager.update(Order, currentOrder.id, { rank: prevRank });
    });

    return this.findAll(undefined, undefined, processName);
  }

  /**
   * Move an order down by swapping rank with the immediately next order in the same scope
   */
  async moveDown(id: number): Promise<Order[]> {
    const currentOrder = await this.findOne(id);
    const processName = currentOrder.process || 'General';

    // Find the immediately next record in the same scope (rank > current.rank)
    const nextOrder = await this.ordersRepository
      .createQueryBuilder('order')
      .where(
        '(order.process = :process OR (:process = \'General\' AND (order.process IS NULL OR order.process = \'\')))',
        { process: processName },
      )
      .andWhere('order.rank > :currentRank', { currentRank: currentOrder.rank })
      .andWhere("(order.order_status = 'OPEN' OR order.order_status IS NULL)")
      .orderBy('order.rank', 'ASC')
      .addOrderBy('order.id', 'ASC')
      .getOne();

    // If already last, return current ordered list without error
    if (!nextOrder) {
      return this.findAll(undefined, undefined, processName);
    }

    // Safe swap inside transaction using temporary rank (0)
    await this.dataSource.transaction(async (manager) => {
      const currentRank = currentOrder.rank;
      const nextRank = nextOrder.rank;

      await manager.update(Order, currentOrder.id, { rank: 0 });
      await manager.update(Order, nextOrder.id, { rank: currentRank });
      await manager.update(Order, currentOrder.id, { rank: nextRank });
    });

    return this.findAll(undefined, undefined, processName);
  }

  /**
   * Batch reorder multiple orders in one single transaction
   */
  async reorder(reorderOrdersDto: ReorderOrdersDto): Promise<Order[]> {
    const { items } = reorderOrdersDto;
    if (!items || items.length === 0) {
      throw new BadRequestException('Items array must not be empty');
    }

    const ids = items.map((item) => item.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException('Duplicate order IDs in reorder request');
    }

    await this.dataSource.transaction(async (manager) => {
      // Step 1: Use temporary negative ranks to avoid unique constraint collisions
      for (const item of items) {
        await manager.update(Order, item.id, { rank: -item.rank });
      }
      // Step 2: Assign target ranks
      for (const item of items) {
        await manager.update(Order, item.id, { rank: item.rank });
      }
    });

    return this.findAll();
  }

  /**
   * Update an order's rank and re-shift all affected orders cleanly in sequential order.
   * Example: Moving order 8 to rank 3 shifts rank 3..7 to 4..8 and assigns 3 to target order.
   */
  async updateRank(id: number, newRank: number): Promise<Order[]> {
    if (newRank < 1) {
      throw new BadRequestException('Rank must be at least 1');
    }

    const targetOrder = await this.findOne(id);
    const processName = targetOrder.process || 'General';

    // Fetch all orders for this process sorted by current rank
    const orders = await this.ordersRepository
      .createQueryBuilder('order')
      .where(
        'order.process = :process OR (:process = \'General\' AND (order.process IS NULL OR order.process = \'\'))',
        { process: processName },
      )
      .orderBy('order.rank', 'ASC')
      .addOrderBy('order.updatedAt', 'DESC')
      .addOrderBy('order.id', 'ASC')
      .getMany();

    const targetIndex = orders.findIndex((o) => o.id === id);
    if (targetIndex === -1) {
      throw new NotFoundException(`Order with ID "${id}" not found in process list`);
    }

    // Remove target from current position
    const [movedOrder] = orders.splice(targetIndex, 1);

    // Calculate insert position (clamped between 0 and orders.length)
    const insertIndex = Math.max(0, Math.min(newRank - 1, orders.length));

    // Insert at new position
    orders.splice(insertIndex, 0, movedOrder);

    // Save sequential ranks (1, 2, 3...) in a transaction
    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orders.length; i++) {
        const expectedRank = i + 1;
        if (orders[i].rank !== expectedRank) {
          orders[i].rank = expectedRank;
          await manager.update(Order, orders[i].id, { rank: expectedRank });
        }
      }
    });

    // Return the newly sorted order list for this process
    return this.findAll(undefined, undefined, processName);
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    const prevRank = order.rank;
    const prevStatus = order.order_status;
    const prevProcess = order.process;

    if (
      updateOrderDto.rank !== undefined &&
      updateOrderDto.rank !== null &&
      updateOrderDto.rank !== order.rank
    ) {
      await this.updateRank(id, updateOrderDto.rank);
      order.rank = updateOrderDto.rank;
      delete updateOrderDto.rank;
    }

    const isNowDispatched =
      (updateOrderDto.process === 'DISPATCHED' || updateOrderDto.order_status === 'CLOSE') &&
      prevStatus !== 'CLOSE' &&
      prevProcess !== 'DISPATCHED';

    if (isNowDispatched && prevRank > 0) {
      await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(Order)
          .set({ rank: () => '`rank` - 1' })
          .where(
            "(order_status = 'OPEN' OR order_status IS NULL) AND rank > :prevRank",
            { prevRank },
          )
          .execute();
      });
    }

    Object.assign(order, updateOrderDto);
    return await this.ordersRepository.save(order);
  }

  async remove(id: number): Promise<{ message: string }> {
    const order = await this.findOne(id);
    const { process, rank } = order;
    const processName = process || 'General';

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, id, { order_status: 'DELETED' });

      // Normalize ranks: decrement ranks greater than deleted order's rank
      await manager
        .createQueryBuilder()
        .update(Order)
        .set({ rank: () => '`rank` - 1' })
        .where(
          '(process = :process OR (:process = \'General\' AND (process IS NULL OR process = \'\'))) AND rank > :rank',
          { process: processName, rank },
        )
        .execute();
    });

    return { message: `Order with ID "${id}" removed successfully` };
  }
}
