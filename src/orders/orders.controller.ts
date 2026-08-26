import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateRankDto } from './dto/update-rank.dto';
import { Order, OrderStatus } from './entities/order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return await this.ordersService.create(createOrderDto);
  }

  @Get()
  async findAll(
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('process') process?: string,
    @Query('status') status?: OrderStatus,
  ): Promise<Order[]> {
    const parsedCompanyId = companyId ? parseInt(companyId, 10) : undefined;
    const parsedProductId = productId ? parseInt(productId, 10) : undefined;
    return await this.ordersService.findAll(
      parsedCompanyId,
      parsedProductId,
      process,
      status,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Order> {
    return await this.ordersService.findOne(id);
  }

  @Patch(':id/rank')
  async updateRank(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRankDto: UpdateRankDto,
  ): Promise<Order[]> {
    return await this.ordersService.updateRank(id, updateRankDto.newRank);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    return await this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return await this.ordersService.remove(id);
  }
}
