import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  ClientResponseDto,
  ClientListResponseDto,
  ClientProfileResponseDto,
} from './dto/client-response.dto';

export function ApiCreateClientDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a client',
      description: 'Registers a new client in the system.',
    }),
    ApiBody({ type: CreateClientDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Client created successfully.',
      type: ClientResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'ID number already exists.',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid input data.',
    }),
  );
}

export function ApiFindAllClientsDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'List clients',
      description:
        'Returns all non-deleted clients for the authenticated user, with the number of active loans.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Client list with payment status.',
      type: ClientListResponseDto,
      isArray: true,
    }),
  );
}

export function ApiFindOneClientDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get client profile',
      description:
        'Returns full client profile with personal info, active loans, completed loans (finished, defaulted or refinanced) and guarantees. Loan installments are NOT included: fetch GET /api/loans/:id to get the full schedule.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Client profile.',
      type: ClientProfileResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Client not found.',
    }),
  );
}

export function ApiUpdateClientDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update client',
      description: 'Updates one or more fields of a client.',
    }),
    ApiBody({ type: UpdateClientDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Client updated successfully.',
      type: ClientResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Client not found.',
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'ID number already exists.',
    }),
  );
}

export function ApiRemoveClientDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete client (soft)',
      description: 'Soft-deletes a client by setting the deletedAt timestamp.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Client deleted successfully.',
      schema: {
        properties: {
          data: { type: 'null' },
          message: { type: 'string', example: 'Client deleted successfully' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Client not found.',
    }),
  );
}
