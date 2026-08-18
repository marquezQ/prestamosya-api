import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanResponseDto } from './dto/loan-response.dto';
import { SimulateLoanDto } from './dto/simulate-loan.dto';
import { LinkGuaranteeDto } from './dto/link-guarantee.dto';

export function ApiCreateLoanDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear un nuevo préstamo',
      description:
        'Genera un préstamo en modo automático (calcula cuotas flat rate) o manual. Persiste préstamo y cuotas en una sola transacción atómica.',
    }),
    ApiBody({
      type: CreateLoanDto,
      examples: {
        automatic: {
          summary: 'Préstamo Automático',
          description:
            'El backend calcula las cuotas automáticamente. NO enviar manualInstallments.',
          value: {
            clientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            mode: 'automatic',
            capitalAmount: 1000,
            currency: 'BOB',
            interestRate: 10,
            periodType: 'monthly',
            totalInstallments: 3,
            startDate: '2026-08-15',
            notes: 'Préstamo personal para mercadería',
          },
        },
        manual: {
          summary: 'Préstamo Manual',
          description:
            'Se envían las cuotas pre-calculadas o modificadas a mano. Obligatorio el modo manual y la lista.',
          value: {
            clientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            mode: 'manual',
            capitalAmount: 1000,
            currency: 'BOB',
            interestRate: 10,
            periodType: 'monthly',
            totalInstallments: 3,
            startDate: '2026-08-15',
            notes: 'Préstamo manual',
            manualInstallments: [
              {
                installmentNumber: 1,
                dueDate: '2026-09-15',
                capitalAmount: 333.33,
                interestAmount: 100,
                totalAmount: 433.33,
              },
              {
                installmentNumber: 2,
                dueDate: '2026-10-15',
                capitalAmount: 333.33,
                interestAmount: 100,
                totalAmount: 433.33,
              },
              {
                installmentNumber: 3,
                dueDate: '2026-11-15',
                capitalAmount: 333.34,
                interestAmount: 100,
                totalAmount: 433.34,
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Préstamo creado exitosamente con sus cuotas.',
      type: LoanResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Datos de entrada inválidos o error en cuotas manuales.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description:
        'Cliente no encontrado o no pertenece al usuario autenticado.',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'No autorizado. Requiere Bearer Token JWT.',
    }),
  );
}

export function ApiSimulateLoanDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Simular cronograma de pagos',
      description:
        'Genera y devuelve el cronograma de pagos calculado sin guardar nada en base de datos. Ideal para vista previa antes de crear el préstamo.',
    }),
    ApiBody({ type: SimulateLoanDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Simulación exitosa',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Datos de entrada inválidos.',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'No autorizado. Requiere Bearer Token JWT.',
    }),
  );
}

export function ApiLinkGuaranteeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Vincular una garantía a un préstamo',
      description:
        'Vincular una garantía disponible del cliente a un préstamo activo.',
    }),
    ApiBody({
      type: LinkGuaranteeDto,
      examples: {
        ejemplo: {
          summary: 'Vincular Garantía por ID',
          value: {
            guaranteeId: '72ab723b-682c-4221-85f8-2d57db00b364',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Garantía vinculada exitosamente.',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'La garantía ya está en uso (IN_USE) o no pertenece al cliente.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Préstamo o garantía no encontrada.',
    }),
  );
}

export function ApiUnlinkGuaranteeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Desvincular una garantía de un préstamo',
      description:
        'Desvincula la garantía y la vuelve a marcar como disponible (AVAILABLE).',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Garantía desvinculada exitosamente.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Vinculación activa no encontrada.',
    }),
  );
}

export function ApiGetLoanDetailDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener el detalle completo de un préstamo',
      description:
        'Devuelve la cabecera del préstamo, cuotas, garantías vinculadas y pagos.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Detalle del préstamo.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Préstamo no encontrado.',
    }),
  );
}

export function ApiGetLoanInstallmentsDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener únicamente las cuotas de un préstamo',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Lista de cuotas activas.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Préstamo no encontrado.',
    }),
  );
}
