import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductCategory } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  list(category?: ProductCategory) {
    return this.prisma.product.findMany({
      where: { active: true, ...(category ? { category } : {}) },
    });
  }

  async detail(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async createOrder(clientId: string, dto: CreateOrderDto) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });

    let totalCents = 0;
    const items = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new NotFoundException(`Produit ${item.productId} introuvable`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
      }
      totalCents += product.priceCents * item.quantity;
      return { productId: product.id, quantity: item.quantity, unitPriceCents: product.priceCents };
    });

    const order = await this.prisma.order.create({
      data: { clientId, totalCents, items: { create: items } },
      include: { items: { include: { product: true } } },
    });

    const paymentIntent = await this.payments.createPaymentIntent(totalCents, {
      orderId: order.id,
    });
    return { order, paymentIntent };
  }
}
