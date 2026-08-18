import { PartialType } from '@nestjs/swagger';
import { CreateGuaranteeDto } from './create-guarantee.dto';

export class UpdateGuaranteeDto extends PartialType(CreateGuaranteeDto) {}
