import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma, VerifiableCredentialSchema ,BlockchainStatus} from '@prisma/client';

// represents the schema stored in Prisma
export class VCItem implements VerifiableCredentialSchema {
  @ApiProperty({ type: String, description: 'id' })
  id: string;
  @ApiProperty({ type: String, description: 'name' })
  name: string;
  @ApiProperty({ type: String, description: 'description' })
  description: string;
  @ApiProperty({ type: Number, description: 'version of the schema' })
  version: string;
  @ApiProperty({ type: String, description: 'type' })
  type: string;
  @ApiProperty({ type: String, description: 'did of author' })
  author: string;
  @ApiProperty({ type: Date, description: 'authored' })
  authored: Date;
  @ApiProperty({ type: JSON, description: 'schema ' })
  schema: Prisma.JsonValue;
  @ApiPropertyOptional({ type: JSON, description: 'proof' })
  proof: Prisma.JsonValue;
  @ApiProperty({ type: Date, description: 'createdAt' })
  createdAt: Date;
  @ApiProperty({ type: Date, description: 'updatedAt' })
  updatedAt: Date;
  @ApiProperty({ type: Date, description: 'deletedAt' })
  deletedAt: Date | null;
  @ApiProperty({ type: [String], description: 'tags' })
  tags: string[];
  @ApiProperty({ type: String, description: 'status' })
  status: any;
  createdBy: string;
  updatedBy: string;
  deprecatedId: string;
  @ApiProperty({ enum: BlockchainStatus, description: 'Blockchain status' })
  blockchainStatus: BlockchainStatus | null; 
}
