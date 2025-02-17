import { Test, TestingModule } from '@nestjs/testing';
import { SchemaService } from './schema.service';
import { UtilsService } from '../utils/utils.service';
import { PrismaClient, SchemaStatus } from '@prisma/client';
import { HttpModule } from '@nestjs/axios';
import {
  generateCredentialSchemaTestBody,
  generateTestDIDBody, testSchemaRespose1, testSchemaRespose2
} from './schema.fixtures';
import { BadRequestException, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { GetCredentialSchemaDTO } from './dto/getCredentialSchema.dto';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';
import { AnchorCordService } from './implementations/anchor-cord.service';
describe('SchemaService', () => {
  let service: SchemaService;
  let prisma: PrismaClient;
  let utilsService: UtilsService;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [SchemaService, UtilsService, PrismaClient,BlockchainAnchorFactory,AnchorCordService],
    }).compile();
    service = module.get<SchemaService>(SchemaService);
    prisma = module.get<PrismaClient>(PrismaClient);
    utilsService = module.get<UtilsService>(UtilsService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(utilsService).toBeDefined();
  });

  it('should try creating a new schema', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const vcCredSchema = await service.createCredentialSchema(
      credSchemaPayload,
    );
    expect(vcCredSchema).toBeDefined();
    // expect(vcCredSchema.schema.proof).toBeTruthy();
    const getVCCredSchema: GetCredentialSchemaDTO = await service.getCredentialSchemaByIdAndVersion({
      id_version: {
        id: vcCredSchema.schema.id,
        version: '1.0.0',
      },
    });
    expect(getVCCredSchema).toBeTruthy();
    expect(getVCCredSchema.schema.version).toBe(vcCredSchema.schema.version);
  });

  it('should try adding a schema without a version', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    delete credSchemaPayload.schema.version;
    credSchemaPayload.schema.author = did.id;
    const vcCredSchema = await service.createCredentialSchema(
      credSchemaPayload,
    );
    expect(vcCredSchema).toBeDefined();
    // expect(vcCredSchema.schema.proof).toBeTruthy();
    const getVCCredSchema = await service.getCredentialSchemaByIdAndVersion({
      id_version: {
        id: vcCredSchema.schema.id,
        version: '0.0.0',
      },
    });
    expect(getVCCredSchema).toBeTruthy();
    expect(getVCCredSchema.schema.version).toBe(vcCredSchema.schema.version);
  });
  it('should try adding a schema with a version that does not follow semver', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.version = '1.0';
    credSchemaPayload.schema.author = did.id;
    expect(
      service.createCredentialSchema(credSchemaPayload),
    ).rejects.toThrowError();
  });

  it('should try to update ONLY metadata of a DRAFT schema', async () => {
    // create new schema
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await service.createCredentialSchema(credSchemaPayload);
    const updateSchemaPayload = {
      schema: null,
      status: null,
      tags: ['test1', 'test2'],
    };
    const updatedSchema = await service.updateCredentialSchema(
      {
        id_version: { id: schema.schema.id, version: schema.schema.version },
      },
      updateSchemaPayload,
    );
    expect(updatedSchema).toBeDefined();
    expect(updatedSchema.tags).toEqual(['test1', 'test2']);
    expect(updatedSchema.schema.version).toBe('1.0.1');
  });
  it('should try to update ONLY metadata of a PUBLISHED schema', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await service.createCredentialSchema(credSchemaPayload);

    const pschema = await service.updateCredentialSchema(
      { id_version: { id: schema.schema.id, version: schema.schema.version } },
      { schema: null, tags: null, status: 'PUBLISHED' },
    );
    expect(pschema).toBeDefined();
    expect(pschema.status).toBe('PUBLISHED');

    const updateSchemaPayload = {
      schema: null,
      status: null,
      tags: ['test1', 'test2'],
    };
    const updatedSchema = await service.updateCredentialSchema(
      {
        id_version: { id: pschema.schema.id, version: pschema.schema.version },
      },
      updateSchemaPayload,
    );
    expect(updatedSchema).toBeDefined();
    expect(updatedSchema.tags).toEqual(['test1', 'test2']);
    expect(updatedSchema.schema.version).toBe('1.1.0');
    expect(updatedSchema.status).toBe('PUBLISHED');
  });
  it('should try updating the schema fields of a DRAFT Schema', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await service.createCredentialSchema(credSchemaPayload);

    const updatedCredSchemaPayload = generateCredentialSchemaTestBody();
    updatedCredSchemaPayload.schema.author = schema.schema.id;
    const updatedSchema = await service.updateCredentialSchema(
      {
        id_version: { id: schema.schema.id, version: schema.schema.version },
      },
      { schema: updatedCredSchemaPayload.schema, status: null, tags: null },
    );

    expect(updatedSchema).toBeDefined();
    expect(updatedSchema.schema.version).toBe('1.1.0');
    expect(updatedSchema.schema.author).toBe(schema.schema.id);
  });
  it('should try updating the schema fields of a PUBLISHED Schema', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await service.createCredentialSchema(credSchemaPayload);

    const pschema = await service.updateCredentialSchema(
      { id_version: { id: schema.schema.id, version: schema.schema.version } },
      { schema: null, tags: null, status: 'PUBLISHED' },
    );
    expect(pschema).toBeDefined();
    expect(pschema.status).toBe('PUBLISHED');

    const updatedCredSchemaPayload = generateCredentialSchemaTestBody();
    updatedCredSchemaPayload.schema.author = pschema.schema.id;

    const updatedSchema = await service.updateCredentialSchema(
      {
        id_version: { id: pschema.schema.id, version: pschema.schema.version },
      },
      { schema: updatedCredSchemaPayload.schema, status: null, tags: null },
    );

    expect(updatedSchema).toBeDefined();
    expect(updatedSchema.schema.version).toBe('2.0.0');
    expect(updatedSchema.status).toBe('PUBLISHED');
    expect(updatedSchema.schema.author).toBe(pschema.schema.id);
  });
  describe('should try to update state of a schema', () => {
    // create new schema
    let didBody;
    let did;
    let credSchemaPayload;
    const updateSchemaState = async (state: string, schema) => {
      const updateSchemaPayload = {
        schema: null,
        status: state,
        tags: ['test1', 'test2'],
      };
      return await service.updateCredentialSchema(
        {
          id_version: { id: schema.schema.id, version: schema.schema.version },
        },
        updateSchemaPayload,
      );
    }
    const testCases = [
      { input: 'DRAFT', expected: 'DRAFT' },
      { input: 'DEPRECATED', expected: 'DEPRECATED' },
      { input: 'PUBLISHED', expected: 'PUBLISHED' },
      { input: 'REVOKED', expected: 'REVOKED' },
    ];

    beforeAll(async () => {
      didBody = generateTestDIDBody();
      did = await utilsService.generateDID(didBody);
      credSchemaPayload = generateCredentialSchemaTestBody();
      credSchemaPayload.schema.author = did.id;
    })

    test.each(testCases)("Update to a $expected schema", async ({ input, expected }) => {
      const schema = await service.createCredentialSchema(credSchemaPayload);
      const updatedSchema = await updateSchemaState(input, schema);
      expect(updatedSchema).toBeDefined();
      expect(updatedSchema.status).toEqual(expected);
      expect(updatedSchema.schema.version).toBe('1.0.1');
    });

    it(`Update REVOKED schema status`, async () => {
      const schema= await service.createCredentialSchema(credSchemaPayload);
      const revokedSchema = await updateSchemaState('REVOKED', schema);
      (['DRAFT', 'DEPRECATED', 'REVOKED', 'PUBLISHED'].forEach(state => {
        expect(() => {
          return updateSchemaState(state, revokedSchema);
        }).rejects.toThrow(
          `Schema with id: ${revokedSchema.schema.id} and version: ${revokedSchema.schema.version} is already revoked`,
        );
      }));
    });

    it('Update schema with invalid id', async () => {
      await expect(() => updateSchemaState('UNKNOWN', { schema: {id: undefined, version: "1.0.0"} })).rejects
        .toThrow('Error fetching schema for update from db');
      await expect(() => service.updateSchemaStatus({
        id_version: { id: undefined, version: '123' },
      }, 'PUBLISHED')).rejects
        .toThrow('Error fetching schema for update from db');
    });

    it('Update schema with not existing id', async () => {
      await expect(() => updateSchemaState('UNKNOWN', { schema: {id: '123', version: "1.0.0"} })).rejects
        .toThrow(NotFoundException);
    });

    it('Update to a UNKNOWN schema', async () => {
      const schema = await service.createCredentialSchema(credSchemaPayload);
      await expect(() => updateSchemaState('UNKNOWN', schema)).rejects
        .toThrow(InternalServerErrorException);
    });
  });

  describe('getAllSchemasById', () => {
    it('should return formatted schemas', async () => {

      const id = 'schema-id';
      const mockSchemas = [
        testSchemaRespose1,
        testSchemaRespose2,
      ];
      jest.spyOn(prisma.verifiableCredentialSchema, 'findMany').mockResolvedValue(mockSchemas);

      const result = await service.getAllSchemasById(id);

      expect(prisma.verifiableCredentialSchema.findMany).toHaveBeenCalledWith({ where: { id } });
      expect(result).toHaveLength(2);
      expect(result[0].schema.id).toEqual(id);
      expect(result[1].schema.id).toEqual(id);
    });

    it('should throw an InternalServerErrorException if there is an error', async () => {
      const id = 'some-id';
      jest.spyOn(prisma.verifiableCredentialSchema, 'findMany').mockRejectedValue(new Error());

      await expect(service.getAllSchemasById(id)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getSchemaByTags', () => {
    it('should return formatted schemas with pagination', async () => {
      const tags = ['tag1', 'tag2'];
      const page = 1;
      const limit = 10;
      const mockSchemas = [
        testSchemaRespose1,
        testSchemaRespose2,
      ];
      jest.spyOn(prisma.verifiableCredentialSchema, 'findMany').mockResolvedValue(mockSchemas);

      const result = await service.getSchemaByTags(tags, page, limit);

      expect(prisma.verifiableCredentialSchema.findMany).toHaveBeenCalledWith({
        where: { tags: { hasSome: tags } },
        skip: (page - 1) * limit,
        take: limit,
      });
      expect(result).toEqual(mockSchemas.map((schema) => ({
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
        blockchainStatus:schema.blockchainStatus,
      })));
    });

    it('should throw an InternalServerErrorException if there is an error', async () => {
      const tags = ['tag1', 'tag2'];
      jest.spyOn(prisma.verifiableCredentialSchema, 'findMany').mockRejectedValue(new Error());

      await expect(service.getSchemaByTags(tags)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
