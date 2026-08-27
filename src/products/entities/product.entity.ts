import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('increment') // Auto-increments: 1, 2, 3...
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ unique: true, length: 50, nullable: true })
  sku: string; // Product Code / SKU

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  price: number;

  @Column({ type: 'int', default: 0 })
  unit: number;

  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @OneToMany(() => Order, (order) => order.product)
  orders: Order[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 20, default: 'OPEN' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  addl_attr: object
}
