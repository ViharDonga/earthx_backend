import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
    const processName = createOrderDto.process || 'IN_PROCESS';
    const status = createOrderDto.order_status || 'OPEN';
    const onBoard = !this.isOffBoard(processName, status);

    return await this.dataSource.transaction(async (manager) => {
      let targetRank = 0;

      if (onBoard) {
        // Close any leftover gaps (dispatched/deleted ranks) then append as last.
        await this.assignSequentialBoardRanks(manager);
        const boardOrders = await this.listBoardOrders(manager);
        const nextRank = boardOrders.length + 1;
        const requestedRank = createOrderDto.rank;

        if (
          requestedRank !== undefined &&
          requestedRank !== null &&
          requestedRank > 0 &&
          requestedRank < nextRank
        ) {
          await this.writeRanks(
            manager,
            boardOrders.slice(requestedRank - 1),
            requestedRank + 1,
          );
          targetRank = requestedRank;
        } else {
          targetRank = nextRank;
        }
      }

      const { company_id, product_id, rank: _ignoredRank, ...orderFields } =
        createOrderDto;
      const order = manager.create(Order, {
        ...orderFields,
        companyId: createOrderDto.companyId ?? company_id,
        productId: createOrderDto.productId ?? product_id,
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
      .orderBy('order.rank', 'ASC')
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
    const previousOrder = await this.ordersRepository
      .createQueryBuilder('order')
      .where(this.boardWhere('order'))
      .andWhere('order.rank < :currentRank', { currentRank: currentOrder.rank })
      .orderBy('order.rank', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .getOne();

    if (!previousOrder) {
      return this.findAll();
    }

    // Safe swap inside transaction using temporary rank (0) to avoid index collisions
    await this.dataSource.transaction(async (manager) => {
      const currentRank = currentOrder.rank;
      const prevRank = previousOrder.rank;

      await manager.update(Order, currentOrder.id, { rank: 0 });
      await manager.update(Order, previousOrder.id, { rank: currentRank });
      await manager.update(Order, currentOrder.id, { rank: prevRank });
    });

    return this.findAll();
  }

  /**
   * Move an order down by swapping rank with the immediately next order in the same scope
   */
  async moveDown(id: number): Promise<Order[]> {
    const currentOrder = await this.findOne(id);

    const nextOrder = await this.ordersRepository
      .createQueryBuilder('order')
      .where(this.boardWhere('order'))
      .andWhere('order.rank > :currentRank', { currentRank: currentOrder.rank })
      .orderBy('order.rank', 'ASC')
      .addOrderBy('order.id', 'ASC')
      .getOne();

    if (!nextOrder) {
      return this.findAll();
    }

    // Safe swap inside transaction using temporary rank (0)
    await this.dataSource.transaction(async (manager) => {
      const currentRank = currentOrder.rank;
      const nextRank = nextOrder.rank;

      await manager.update(Order, currentOrder.id, { rank: 0 });
      await manager.update(Order, nextOrder.id, { rank: currentRank });
      await manager.update(Order, currentOrder.id, { rank: nextRank });
    });

    return this.findAll();
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

    const orders = await this.ordersRepository
      .createQueryBuilder('order')
      .where(this.boardWhere('order'))
      .orderBy('order.rank', 'ASC')
      .addOrderBy('order.updatedAt', 'DESC')
      .addOrderBy('order.id', 'ASC')
      .getMany();

    const targetIndex = orders.findIndex((o) => o.id === id);
    if (targetIndex === -1) {
      throw new NotFoundException(`Order with ID "${id}" not found in open list`);
    }

    const [movedOrder] = orders.splice(targetIndex, 1);
    const insertIndex = Math.max(0, Math.min(newRank - 1, orders.length));
    orders.splice(insertIndex, 0, movedOrder);

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orders.length; i++) {
        await manager.update(Order, orders[i].id, { rank: -(i + 1) });
      }
      for (let i = 0; i < orders.length; i++) {
        await manager.update(Order, orders[i].id, { rank: i + 1 });
      }
    });

    return this.findAll();
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    const prevStatus = order.order_status;
    const prevProcess = order.process || 'IN_PROCESS';
    const patch = this.toOrderPatch(updateOrderDto);

    const processChanged =
      patch.process !== undefined &&
      this.normalizeProcess(patch?.process as string).toUpperCase() !==
        this.normalizeProcess(prevProcess).toUpperCase();

    if (
      patch.rank !== undefined &&
      patch.rank !== null &&
      patch.rank !== order.rank &&
      !processChanged
    ) {
      await this.updateRank(id, patch.rank as number);
      delete patch.rank;
    }

    const nextProcess = (patch.process as string) ?? prevProcess;
    const nextStatus = (patch.order_status as string) ?? prevStatus;
    const wasOnBoard = !this.isOffBoard(prevProcess, prevStatus);
    const willBeOnBoard = !this.isOffBoard(nextProcess, nextStatus);

    await this.dataSource.transaction(async (manager) => {
      if (wasOnBoard && !willBeOnBoard) {
        // Dispatch / close: drop this order and compact remaining to 1, 2, 3, 4...
        await this.assignSequentialBoardRanks(manager, id);
        patch.rank = 0;
      } else if ((!wasOnBoard && willBeOnBoard) || (willBeOnBoard && processChanged)) {
        // Return to Process / Ready to Dispatch: newest goes to rank 1
        await this.insertAtFrontOfBoard(manager, id);
        patch.rank = 1;
      }

      if (Object.keys(patch).length > 0) {
        await manager.update(Order, id, patch);
      }
    });

    return this.findOne(id);
  }

  /** Map DTO (including snake_case aliases) to a TypeORM column patch. */
  private toOrderPatch(
    dto: UpdateOrderDto,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = { ...dto };
    delete patch.company_id;
    delete patch.product_id;

    if (dto.companyId === undefined && dto.company_id !== undefined) {
      patch.companyId = dto.company_id;
    }
    if (dto.productId === undefined && dto.product_id !== undefined) {
      patch.productId = dto.product_id;
    }

    return Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
  }

  private normalizeProcess(process?: string | null): string {
    return (process || 'IN_PROCESS').trim();
  }

  /** Orders still shown on the register: OPEN and not DISPATCHED. */
  private isOffBoard(process?: string | null, status?: string | null): boolean {
    const p = this.normalizeProcess(process).toUpperCase();
    const s = (status || 'OPEN').toUpperCase();
    return p === 'DISPATCHED' || s === 'CLOSE' || s === 'DELETED';
  }

  private boardWhere(alias = 'order'): string {
    const processCol = `${alias}.process`;
    const statusCol = `${alias}.order_status`;
    return `(UPPER(COALESCE(${processCol}, '')) != 'DISPATCHED' AND (${statusCol} = 'OPEN' OR ${statusCol} IS NULL))`;
  }

  private async listBoardOrders(
    manager: EntityManager,
    excludeId?: number,
  ): Promise<Order[]> {
    const qb = manager
      .createQueryBuilder(Order, 'order')
      .where(this.boardWhere('order'))
      .orderBy('order.rank', 'ASC')
      .addOrderBy('order.id', 'ASC');

    if (excludeId) {
      qb.andWhere('order.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }

  private async writeRanks(
    manager: EntityManager,
    orders: Order[],
    startRank: number,
  ): Promise<void> {
    for (let i = 0; i < orders.length; i++) {
      await manager.update(Order, orders[i].id, { rank: -(startRank + i) });
    }
    for (let i = 0; i < orders.length; i++) {
      await manager.update(Order, orders[i].id, { rank: startRank + i });
    }
  }

  /** Remaining board orders become 1, 2, 3, 4... with no gaps. */
  private async assignSequentialBoardRanks(
    manager: EntityManager,
    excludeId?: number,
  ): Promise<void> {
    const orders = await this.listBoardOrders(manager, excludeId);
    await this.writeRanks(manager, orders, 1);
  }

  /** Existing board orders become 2, 3, 4... so this order can take rank 1. */
  private async insertAtFrontOfBoard(
    manager: EntityManager,
    excludeId: number,
  ): Promise<void> {
    const others = await this.listBoardOrders(manager, excludeId);
    await this.writeRanks(manager, others, 2);
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, id, { order_status: 'DELETED', rank: 0 });
      await this.assignSequentialBoardRanks(manager, id);
    });

    return { message: `Order with ID "${id}" removed successfully` };
  }
}
