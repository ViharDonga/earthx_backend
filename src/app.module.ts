import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { CompaniesModule } from './companies/companies.module';
import { ProductsModule } from './products/products.module';
import { User } from './users/entities/user.entity';
import { Order } from './orders/entities/order.entity';
import { Company } from './companies/entities/company.entity';
import { Product } from './products/entities/product.entity';

@Module({
  imports: [
    // Global environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MySQL TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', '89.116.133.75'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'u830702894_earthx_user'),
        password: configService.get<string>('DB_PASSWORD', 'Earthx@2026'),
        database: configService.get<string>('DB_DATABASE', 'u830702894_earthx_db'),
        entities: [User, Company, Product, Order],
        synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true),
        logging: false,
      }),
    }),

    // Feature modules
    UsersModule,
    AuthModule,
    CompaniesModule,
    ProductsModule,
    OrdersModule,
  ],
})
export class AppModule {}
