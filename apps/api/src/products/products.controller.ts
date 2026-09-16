import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductCategory } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // Catalogue, filtrable par catégorie : CIRE, POMMADE, HUILE_BARBE, SHAMPOING, ACCESSOIRE
  @Get()
  list(@Query('category') category?: ProductCategory) {
    return this.products.list(category);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.products.detail(id);
  }

  // Achat in-app (PRD §9) — crée la commande et l'intention de paiement Stripe
  @UseGuards(AuthGuard('jwt'))
  @Post('orders')
  order(@Request() req: { user: { userId: string } }, @Body() dto: CreateOrderDto) {
    return this.products.createOrder(req.user.userId, dto);
  }
}
