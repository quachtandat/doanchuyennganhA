import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { WalletTransactionsService } from './wallet_transactions.service';
import { CreateWalletTransactionDto } from './dto/create-wallet_transaction.dto';
import { UpdateWalletTransactionDto } from './dto/update-wallet_transaction.dto';

@Controller('wallet-transactions')
export class WalletTransactionsController {
  constructor(private readonly service: WalletTransactionsService) {}

  @Post()
  create(@Body() dto: CreateWalletTransactionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWalletTransactionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
