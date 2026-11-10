import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum LoanFilterScope {
  ACTIVE = 'active',
  UP_TO_DATE = 'up_to_date',
  OVERDUE = 'overdue',
  COMPLETED = 'completed',
}

export class ListLoansQueryDto {
  @ApiPropertyOptional({
    enum: LoanFilterScope,
    default: LoanFilterScope.ACTIVE,
    description:
      'Filtro por estado de cartera: active (todos activos), up_to_date (al día), overdue (en mora), completed (finalizados)',
  })
  @IsOptional()
  @IsEnum(LoanFilterScope)
  filter?: LoanFilterScope = LoanFilterScope.ACTIVE;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre o carnet (CI) del cliente',
    example: 'Quispe',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
