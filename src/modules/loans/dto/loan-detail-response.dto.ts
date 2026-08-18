import { ApiProperty } from '@nestjs/swagger';

export class LoanHeaderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  clientName: string;

  @ApiProperty()
  clientIdNumber: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  mode: string;

  @ApiProperty()
  capitalAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  interestRate: number;

  @ApiProperty()
  periodType: string;

  @ApiProperty()
  totalInstallments: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  totalPaid: number;

  @ApiProperty()
  outstandingBalance: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  startDate: string;

  @ApiProperty()
  firstDueDate: string;

  @ApiProperty()
  notes?: string;

  @ApiProperty()
  createdAt: Date;
}

export class LoanDetailResponseDto {
  @ApiProperty({ type: LoanHeaderDto })
  loan: LoanHeaderDto;

  @ApiProperty({ type: Array })
  installments: any[];

  @ApiProperty({ type: Array })
  guarantees: any[];

  @ApiProperty({ type: Array })
  payments: any[];
}
