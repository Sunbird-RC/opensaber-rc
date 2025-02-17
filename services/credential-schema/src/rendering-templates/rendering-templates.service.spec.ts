import { Test, TestingModule } from '@nestjs/testing';
import { RenderingTemplatesService } from './rendering-templates.service';
import { ValidateTemplateService } from './validate-template.service';
import { SchemaService } from '../schema/schema.service';
import { PrismaClient } from '@prisma/client';
import { UtilsService } from '../utils/utils.service';
import { HttpModule } from '@nestjs/axios';
import { templatePayloadGenerator } from './rendering-templates.fixtures';
import {
  generateCredentialSchemaTestBody,
  generateTestDIDBody,
} from '../schema/schema.fixtures';

import { BlockchainAnchorFactory } from '../schema/factories/blockchain-anchor.factory';
import { AnchorCordService } from '../schema/implementations/anchor-cord.service';
describe('RenderingTemplatesService', () => {
  let service: RenderingTemplatesService;
  let schemaService: SchemaService;
  let utilsService: UtilsService;
 
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        RenderingTemplatesService,
        PrismaClient,
        ValidateTemplateService,
        SchemaService,
        UtilsService,
        BlockchainAnchorFactory,
        AnchorCordService
      ],
    }).compile();

    service = module.get<RenderingTemplatesService>(RenderingTemplatesService);
    schemaService = module.get<SchemaService>(SchemaService);
    utilsService = module.get<UtilsService>(UtilsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a template and get it by templateID', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await schemaService.createCredentialSchema(
      credSchemaPayload,
    );
    const templatePayload = templatePayloadGenerator(
      schema.schema.id,
      schema.schema.version,
    );
    const template = await service.addTemplate(templatePayload);
    expect(template).toBeDefined();
    const getTemplate = await service.getTemplateById(
      template.template.templateId,
    );
    expect(getTemplate.schemaId).toEqual(template.template.schemaId);
    expect(getTemplate.template).toEqual(template.template.template);
  });

  it('should create a template with wrong schemaID', async () => {
    const templatePayload = templatePayloadGenerator('randomID', '1.0.0');
    await expect(service.addTemplate(templatePayload)).rejects.toThrowError();
  });

  it('should get a template by schemaID', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await schemaService.createCredentialSchema(
      credSchemaPayload,
    );
    const templatePayload = templatePayloadGenerator(
      schema.schema.id,
      schema.schema.version,
    );
    const template = await service.addTemplate(templatePayload);
    expect(template).toBeDefined();

    const getTemplate = await service.getTemplateBySchemaID(
      templatePayload.schemaId,
    );
    expect(getTemplate).toBeDefined();
    expect(getTemplate[0].template).toEqual(template.template.template);
  });

  it('should update the template by templateID', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await schemaService.createCredentialSchema(
      credSchemaPayload,
    );
    const templatePayload = templatePayloadGenerator(
      schema.schema.id,
      schema.schema.version,
    );
    const template = await service.addTemplate(templatePayload);
    expect(template).toBeDefined();

    const newTemplatePayload = templatePayloadGenerator(
      schema.schema.id,
      schema.schema.version,
    );
    newTemplatePayload.template = 'TEST';

    const ntemplate = await service.updateTemplate(
      template.template.templateId,
      newTemplatePayload,
    );
    expect(ntemplate.template).toEqual(newTemplatePayload.template);
  });

  it('should delete the template by templateID', async () => {
    const didBody = generateTestDIDBody();
    const did = await utilsService.generateDID(didBody);
    const credSchemaPayload = generateCredentialSchemaTestBody();
    credSchemaPayload.schema.author = did.id;
    const schema = await schemaService.createCredentialSchema(
      credSchemaPayload,
    );
    const templatePayload = templatePayloadGenerator(
      schema.schema.id,
      schema.schema.version,
    );
    const template = await service.addTemplate(templatePayload);
    expect(template).toBeDefined();

    await service.deleteTemplate(template.template.templateId);
    await expect(
      service.getTemplateById(template.template.templateId),
    ).rejects.toThrowError();
  });
});
