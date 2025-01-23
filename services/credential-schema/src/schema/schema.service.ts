import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  SchemaStatus,
  VerifiableCredentialSchema,
} from '@prisma/client';
import { validate } from '../utils/schema.validator';
import { DefinedError } from 'ajv';
import { CreateCredentialDTO } from './dto/create-credentials.dto';
import { UtilsService } from '../utils/utils.service';
import { GetCredentialSchemaDTO } from './dto/getCredentialSchema.dto';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';

@Injectable()
export class SchemaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly utilService: UtilsService,
    private readonly blockchainFactory: BlockchainAnchorFactory
  ) { }
  private logger = new Logger(SchemaService.name);
  private semanticVersionRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  async getCredentialSchemaByIdAndVersion(
    userWhereUniqueInput: Prisma.VerifiableCredentialSchemaWhereUniqueInput, //
  ): Promise<GetCredentialSchemaDTO> {
    let schema: VerifiableCredentialSchema;
    try {
      schema = await this.prisma.verifiableCredentialSchema.findUnique({
        where: userWhereUniqueInput,
      });
    } catch (err) {
      this.logger.error('Error fetching schema from db', err);
      throw new InternalServerErrorException('Error fetching schema from db');
    }

    if (schema) {
      return {
        schema: {
          type: schema.type,
          id: schema.id,
          version: schema.version,
          name: schema.name,
          author: schema.author,
          authored: schema.authored,
          schema: schema.schema,
          proof: schema.proof,
        },
        tags: schema.tags,
        status: schema.status,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
        createdBy: schema.createdBy,
        updatedBy: schema.updatedBy,
        deprecatedId: schema.deprecatedId,
        blockchainStatus: schema.blockchainStatus,
      } as GetCredentialSchemaDTO;
    } else {
      this.logger.error('schema not found for userInput', userWhereUniqueInput);
      throw new NotFoundException('Schema not found');
    }
  }

  async getAllSchemasById(id: string) {
    try {
      const schemas = await this.prisma.verifiableCredentialSchema.findMany({
        where: {
          id,
        },
      });

      return schemas.map((schema) => this.formatResponse(schema));
    } catch (err) {
      this.logger.error('Error fetching schemas from db', err);
      throw new InternalServerErrorException('Error fetching schemas from db');
    }
  }

  async getSchemaByTags(tags: string[], page = 1, limit = 10) {
    this.logger.debug('Tags received to find schema', tags);

    let schemas: ReadonlyArray<VerifiableCredentialSchema>;
    try {
      schemas = await this.prisma.verifiableCredentialSchema.findMany({
        where: {
          tags: {
            hasSome: [...tags],
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      });
    } catch (err) {
      this.logger.error('Error fetching credential schema from db:', err);
      throw new InternalServerErrorException('Error fetching schema from db');
    }

    return schemas.map((schema) => {
      return {
        schema: {
          type: schema.type,
          id: schema.id,
          version: schema.version,
          name: schema.name,
          author: schema.author,
          authored: schema.authored,
          schema: schema.schema,
          proof: schema.proof,
        },
        tags: schema.tags,
        status: schema.status,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
        createdBy: schema.createdBy,
        updatedBy: schema.updatedBy,
        deprecatedId: schema.deprecatedId,
        blockchainStatus: schema.blockchainStatus,
      };
    });
  }


  /**
 * Determines if anchoring to a blockchain is enabled based on environment variables.
 * Returns the blockchain type in lowercase if anchoring is enabled; otherwise, null.
 * @returns The blockchain type (e.g., 'cord', 'solana') in lowercase if anchoring is enabled; otherwise, null.
 */
private shouldAnchorToBlockchain(): string | null {
  // Check if anchoring is enabled
  if (
    process.env.ANCHOR_TO_BLOCKCHAIN &&
    process.env.ANCHOR_TO_BLOCKCHAIN.toLowerCase().trim() === 'true'
  ) {
    // Return the value of BLOCKCHAIN_TYPE in lowercase (default to null if undefined)
    return process.env.BLOCKCHAIN_TYPE?.toLowerCase().trim() || null;
  }

  return null; // Return null if blockchain anchoring is not enabled
}


  async createCredentialSchema(
    createCredentialDto: CreateCredentialDTO,
    generateDID = true,
    deprecatedId: string = undefined,
  ) {
    const data = createCredentialDto.schema;
    const tags = createCredentialDto.tags;
    let blockchainSchemaId: string | null = null;
    let did: string | null = null;

    // Validate the credential schema
    if (!validate(data)) {
      this.logger.log('Schema validation failed', validate.errors.join('\n'));
      for (const err of validate.errors as DefinedError[]) {
        this.logger.error(err, err.message);
      }
      throw new BadRequestException(
        `Schema validation failed with the following errors: ${validate.errors.join('\n')}`,
      );
    }
    // Check if anchoring to blockchain is enabled and get the method
    const method = this.shouldAnchorToBlockchain();

    if (method) {
      // Get the appropriate service from the factory
      const anchorService = this.blockchainFactory.getAnchorService(method);
      const response = await anchorService.anchorSchema(data);

      blockchainSchemaId = response.schemaId;
      did = blockchainSchemaId;
    } else if (generateDID) {
      // Generate a DID if anchoring is not enabled and generateDID is true
      const didBody = {
        content: [
          {
            alsoKnownAs: [data.author, data.schema.$id],
            services: [
              {
                id: 'CredentialSchemaService',
                type: 'CredentialSchema',
              },
            ],
            method: 'schema',
          },
        ],
      };

      // Generate DID
      const generatedDidResponse = await this.utilService.generateDID(didBody);
      this.logger.debug('DID received from identity service', generatedDidResponse);
      did = generatedDidResponse?.id || null;

    }


    const credSchema = {
      schema: {
        type: data.type,
        id: did ? did : data.id,
        version: data.version ? data.version : '0.0.0',
        name: data.name,
        author: data.author,
        authored: data.authored,
        schema: data.schema,
        proof: data.proof,
      },
      tags: tags,
      status: createCredentialDto.status,
      deprecatedId: createCredentialDto.deprecatedId,
      blockchainStatus: blockchainSchemaId ? 'ANCHORED' : 'PENDING',
    };

    //     // sign the credential schema (only the schema part of the credSchema object above since it is the actual schema)
    //     // const proof = await this.utilService.sign(
    //     //   credSchema.schema.author,
    //     //   credSchema.schema,
    //     // );
    //     // credSchema.schema.proof = proof;

    // Save the credential schema to the database
    try {
      const resp = await this.prisma.verifiableCredentialSchema.create({
        data: {
          id: credSchema.schema.id,
          type: credSchema.schema.type as string,
          version: credSchema.schema.version,
          name: credSchema.schema.name as string,
          author: credSchema.schema.author as string,
          authored: credSchema.schema.authored,
          schema: credSchema.schema.schema as Prisma.JsonValue,
          status: credSchema.status as SchemaStatus,
          proof: credSchema.schema.proof as Prisma.JsonValue || undefined,
          tags: credSchema.tags as string[],
          deprecatedId: deprecatedId,
          blockchainStatus: blockchainSchemaId ? 'ANCHORED' : 'PENDING',
        },
      });


      credSchema['createdAt'] = resp.createdAt;
      credSchema['updatedAt'] = resp.updatedAt;
      credSchema['deletedAt'] = resp.deletedAt;
      credSchema['createdBy'] = resp.createdBy;
      credSchema['updatedBy'] = resp.updatedBy;

      return credSchema;
    } catch (err) {
      this.logger.error('Error saving schema to db', err);
      throw new InternalServerErrorException('Error saving schema to db');
    }
  }


  private formatResponse(schema: VerifiableCredentialSchema) {
    return JSON.parse(
      JSON.stringify({
        schema: {
          type: schema?.type,
          id: schema?.id,
          version: schema?.version,
          name: schema?.name,
          author: schema?.author,
          authored: schema?.authored,
          schema: schema?.schema,
          proof: schema?.proof,
        },
        tags: schema?.tags,
        status: schema?.status,
        createdAt: schema?.createdAt,
        updatedAt: schema?.updatedAt,
        createdBy: schema?.createdBy,
        updatedBy: schema?.updatedBy,
        deprecatedId: schema?.deprecatedId,
        blockchainStatus: schema?.blockchainStatus,
      }),
    );
  }

  async updateSchemaStatus(
    where: Prisma.VerifiableCredentialSchemaWhereUniqueInput,
    status: string,
  ) {
    let statusToUpdate: SchemaStatus;
    switch (status.toUpperCase().trim()) {
      case 'PUBLISHED':
        statusToUpdate = SchemaStatus.PUBLISHED;
        break;
      case 'DEPRECATED':
        statusToUpdate = SchemaStatus.DEPRECATED;
        break;
      case 'REVOKED':
        statusToUpdate = SchemaStatus.REVOKED;
        break;
      default:
        statusToUpdate = SchemaStatus.DRAFT;
    }

    try {
      const updatedSchema = await this.prisma.verifiableCredentialSchema.update(
        {
          where,
          data: {
            status: statusToUpdate,
          },
        },
      );

      return this.formatResponse(updatedSchema);
    } catch (err) {
      this.logger.error(`Error fetching schema for update from db`, err);
      throw new InternalServerErrorException(
        'Error fetching schema for update from db',
      );
    }
  }
  async updateCredentialSchema(
    where: Prisma.VerifiableCredentialSchemaWhereUniqueInput,
    data: CreateCredentialDTO,
  ) {
    // TODO: Deprecate the schema and create a new one
    this.logger.debug(
      'Request to update the schema where ',
      where,
      'with ',
      data,
    );

    let currentSchema: VerifiableCredentialSchema;
    try {
      currentSchema = await this.prisma.verifiableCredentialSchema.findUnique({
        where,
      });
    } catch (err) {
      this.logger.error(`Error fetching schema for update from db`, err);
      throw new InternalServerErrorException(
        'Error fetching schema for update from db',
      );
    }

    if (!currentSchema)
      throw new NotFoundException(
        `No schema found with the given id: ${where.id_version.id} ad version: ${where.id_version.version}`,
      );

    if (currentSchema.status === SchemaStatus.REVOKED) {
      this.logger.debug(
        `Schema with id: ${where.id_version.id} and version: ${where.id_version.version} is already revoked`,
      );
      throw new BadRequestException(
        `Schema with id: ${where.id_version.id} and version: ${where.id_version.version} is already revoked`,
      );
    }

    if (
      (!data.schema && !data.tags && data.status) ||
      (data.schema &&
        !data.tags &&
        data.status &&
        Object.keys(data.schema).length === 0)
    ) {
      return await this.updateSchemaStatus(where, data.status);
    }

    // if (validate(data.schema)) {
    const prevVer = currentSchema.version.trim().split('.');

    switch (currentSchema.status) {
      case SchemaStatus.DRAFT:
      case SchemaStatus.DEPRECATED:
        /*
          in case of draft we never update the major version
          we only capture the minor and patch version
          minor when the core schema is changed and path when the tags are changed
          we deprecate the current schema and use create a new schema with the new version but same did
        */
        if (data.schema && Object.keys(data.schema).length > 0) {
          prevVer[1] = (parseInt(prevVer[1]) + 1).toString();
          prevVer[2] = '0';
          data.schema.version = prevVer.join('.');
        } else {
          prevVer[2] = (parseInt(prevVer[2]) + 1).toString();
          data.schema = this.formatResponse(currentSchema).schema as any;
          data.schema.version = prevVer.join('.');
        }
        data.schema.id = currentSchema.id;
        break;
      case SchemaStatus.PUBLISHED:
        /*
          in case of published we never update the patch version
          we only capture the minor and patch version
          minor when the core schema is changed and path when the tags are changed
          we deprecate the current schema and use create a new schema with the new version but same did
        */
        if (data.schema) {
          prevVer[0] = (parseInt(prevVer[0]) + 1).toString();
          prevVer[1] = '0';
          prevVer[2] = '0';
          data.schema.version = prevVer.join('.');
        } else {
          prevVer[1] = (parseInt(prevVer[1]) + 1).toString();
          prevVer[2] = '0';
          data.schema = this.formatResponse(currentSchema).schema as any;
          data.schema.version = prevVer.join('.');
        }
        data.schema.id = currentSchema.id;
        break;
    }

    // create the new schema with the new version
    let newSchema;
    try {
      let newStatus: SchemaStatus;
      if (data.status) {
        switch (data.status.toUpperCase().trim()) {
          case 'PUBLISHED':
            newStatus = SchemaStatus.PUBLISHED;
            break;
          case 'DEPRECATED':
            newStatus = SchemaStatus.DEPRECATED;
            break;
          case 'REVOKED':
            newStatus = SchemaStatus.REVOKED;
            break;
          case 'DRAFT':
            newStatus = SchemaStatus.DRAFT;
            break;
          default:
            throw new BadRequestException(
              'Invalid status value. Supported values are: 1. DRAFT 2. DEPRECATED 3. REVOKED 4. PUBLISHED',
            );
        }
      }
      const newSchemaPayload = {
        schema: {
          ...data.schema,
        },
        status: newStatus !== undefined ? newStatus : currentSchema.status,
        tags: data.tags ? data.tags : currentSchema.tags,
        deprecatedId: currentSchema.version,
      };

      newSchemaPayload.schema.authored = new Date(
        newSchemaPayload.schema.authored,
      ).toISOString();
      newSchema = await this.createCredentialSchema(newSchemaPayload, false);
    } catch (err) {
      this.logger.error(`Error updating the schema in db: ${err.message}`, err);
      throw new InternalServerErrorException('Error updating the schema in db');
    }

    // deprecate the current schema
    try {
      const deprecatedSchema = await this.updateSchemaStatus(
        where,
        'DEPRECATED',
      );
    } catch (err) {
      this.logger.error('Error marking the current schema as deprecated', err);
      throw new InternalServerErrorException(
        'Error marking the current schema as deprecated',
      );
    }

    return newSchema;
  }
}
