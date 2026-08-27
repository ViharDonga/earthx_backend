import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('increment') // Auto-increments: 1, 2, 3...
  id: number;

  @Column({ unique: true, length: 150 })
  name: string;

  @Column({ unique: true, length: 50, nullable: true })
  contctPerson: string; // e.g. CMP-001

  @Column({ nullable: true })
  email: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  gstNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 20, default: 'OPEN' })
  status: string;

  @OneToMany(() => Product, (product) => product.company)
  products: Product[];

  @OneToMany(() => Order, (order) => order.company)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  addl_attr: object;
}
