import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Product } from '../../products/entities/product.entity';



@Entity('orders')
@Index(['companyId', 'process', 'rank'])
export class Order {
  @PrimaryGeneratedColumn('increment') // Auto-increments: 1, 2, 3...
  id: number;

  @Column({ unique: true, length: 50 })
  orderNumber: string;

  // Company Relationship & Foreign Key
  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.orders, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true, // Automatically loads company info
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // Product Relationship & Foreign Key
  @Column({ nullable: true })
  productId: number;

  @ManyToOne(() => Product, (product) => product.orders, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true, // Automatically loads product info
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ length: 100, default: 'IN_PROCESS' })
  process: string;

  @Column({ length: 20, default: 'OPEN' })
  order_status: string;

  @Column({ type: 'int', default: 1 })
  rank: number;

  @Column({ length: 50, default: 'NORMAL' })
  priority: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true })
  addl_attr: object

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}
