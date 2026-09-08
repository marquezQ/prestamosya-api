import { ApiProperty } from '@nestjs/swagger';
import { CurrencyAmountDto } from './monthly-stats-response.dto';

export class MonthlyHistoryItemDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 9, description: 'Mes (1-12)' })
  month: number;

  @ApiProperty({
    example: 'Sep 2026',
    description: 'Etiqueta corta para gráficas',
  })
  label: string;

  @ApiProperty({
    type: CurrencyAmountDto,
    description: 'Interés cobrado en el mes (ganancia bruta)',
  })
  interestCollected: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description: 'Ganancia neta del mes: interestCollected - discountsGiven',
  })
  netProfit: CurrencyAmountDto;

  @ApiProperty({
    example: 83.33,
    description: 'Porcentaje de cuotas cobradas del mes',
  })
  collectionRate: number;

  @ApiProperty({
    example: 3,
    description: 'Nuevos préstamos otorgados en el mes',
  })
  newLoansCount: number;
}
