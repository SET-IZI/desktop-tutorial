import { Controller, Get } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // Prestations actives : Coupe Homme, Coupe + Barbe, Barbe seule,
  // Coupe enfant, Hair Design, Premium Package…
  @Get()
  list() {
    return this.services.list();
  }
}
