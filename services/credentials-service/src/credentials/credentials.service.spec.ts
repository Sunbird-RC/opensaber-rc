import { Test, TestingModule } from '@nestjs/testing';
import { CredentialsService } from './credentials.service';
import Ajv2019 from 'ajv/dist/2019';
import { UnsignedVCValidator, VCValidator } from './types/validators';
import { SchemaUtilsSerivce } from './utils/schema.utils.service';
import { IdentityUtilsService } from './utils/identity.utils.service';
import { RenderingUtilsService } from './utils/rendering.utils.service';
import { AnchorCordUtilsServices } from './utils/cord.utils.service';
import { PrismaClient } from '@prisma/client';
import {
  generateCredentialRequestPayload,
  generateCredentialSchemaTestBody,
  getCredentialByIdSchema,
  issueCredentialReturnTypeSchema,
  generateRenderingTemplatePayload,
} from './credentials.fixtures';
import { RENDER_OUTPUT } from './enums/renderOutput.enum';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule, HttpService } from '@nestjs/axios';

// setup ajv
const ajv = new Ajv2019({ strictTuples: false });
ajv.addFormat('date-time', function isValidDateTime(dateTimeString) {
    // Regular expression for ISO 8601 date-time format
    const iso8601Regex = /^(\d{4}-[01]\d-[0-3]\d[T\s](?:[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?|23:59:60)(?:Z|[+-][0-2]\d:[0-5]\d)?)$/;

    // Check if the string matches the ISO 8601 format
    if (!iso8601Regex.test(dateTimeString)) {
      return false;
    }

    // Check if the string can be parsed into a valid date
    const date = new Date(dateTimeString);
    return !isNaN(date.getTime());
  }
);

describe('CredentialsService', () => {
  let service: CredentialsService;
  let httpSerivce: HttpService;
  let identityUtilsService: IdentityUtilsService;

  const validate = ajv.compile(issueCredentialReturnTypeSchema);
  const getCredReqValidate = ajv.compile(getCredentialByIdSchema);

  let issuerDID;
  let subjectDID;
  let credentialSchemaID;
  let sampleCredReqPayload;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule, HttpModule],
      providers: [
        CredentialsService,
        PrismaClient,
        RenderingUtilsService,
        SchemaUtilsSerivce,
        IdentityUtilsService,
        AnchorCordUtilsServices,
      ],
    }).compile();

    service = module.get<CredentialsService>(CredentialsService);
    httpSerivce = module.get<HttpService>(HttpService);
    identityUtilsService =
      module.get<IdentityUtilsService>(IdentityUtilsService);

    issuerDID = await identityUtilsService.generateDID([
      'VerifiableCredentialTESTINGIssuer',
    ]);
    issuerDID = issuerDID[0].id;

    subjectDID = await identityUtilsService.generateDID([
      'VerifiableCredentialTESTINGIssuer',
    ]);
    subjectDID = subjectDID[0].id;

    const schemaPayload = generateCredentialSchemaTestBody();
    schemaPayload.schema.author = issuerDID;
    const schema = await httpSerivce.axiosRef.post(
      `${process.env.SCHEMA_BASE_URL}/credential-schema`,
      schemaPayload
    );
    credentialSchemaID = schema.data.schema.id;
    sampleCredReqPayload = generateCredentialRequestPayload(
      issuerDID,
      subjectDID,
      credentialSchemaID,
      schema.data.schema.version
    );
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
  })

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should issue a credential', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    VCValidator.parse(newCred.credential);
    expect(validate(newCred)).toBe(true);
  });

  describe("getCredentialById", () => {
    let newCred: any;
    beforeAll(async () => {
      newCred = await service.issueCredential(sampleCredReqPayload);
    })

    it('should get a credential in JSON', async () => {
      const cred = await service.getCredentialById(newCred.credential?.id);
      UnsignedVCValidator.parse(cred);
      expect(getCredReqValidate(cred)).toBe(true);
    });

    it('should get a credential in QR', async () => {
      const dataURL = await service.getCredentialById(newCred.credential?.id, null, null, RENDER_OUTPUT.QR);
      expect(dataURL).toBeDefined(); // Assert that the dataURL is defined
      expect(dataURL).toContain('data:image/png;base64,');
    });

    it('should get a credential in HTML', async () => {
      const templatePayload = generateRenderingTemplatePayload(newCred.credentialSchemaId, "1.0.0")
      const template = await httpSerivce.axiosRef.post(`${process.env.SCHEMA_BASE_URL}/template`, templatePayload);
      const cred = await service.getCredentialById(newCred.credential?.id, template.data.template.templateId, null, RENDER_OUTPUT.HTML);
      expect(cred).toContain('</html>')
      expect(cred).toContain('IIIT Sonepat, NIT Kurukshetra')
      expect(cred).toBeDefined()
    });

    it('should get a credential in PDF', async () => {
      const templatePayload = generateRenderingTemplatePayload(newCred.credentialSchemaId, "1.0.0")
      const template = await httpSerivce.axiosRef.post(`${process.env.SCHEMA_BASE_URL}/template`, templatePayload);
      const cred = await service.getCredentialById(newCred.credential?.id, template.data.template.templateId, null, RENDER_OUTPUT.PDF);
      expect(cred).toBeDefined()
    });

    it('should get a credential in STRING', async () => {
      const cred = await service.getCredentialById(newCred.credential?.id, null, null, RENDER_OUTPUT.STRING);
      expect(cred).toBeDefined()
    });

    it('should throw because no credential is present to be searched by ID', async () => {
      await expect(service.getCredentialById('did:ulp:123')).rejects.toThrow();
    });
  })

  it('should throw because credential not present to be verified', async () => {
    await expect(service.verifyCredentialById('did:ulp:123')).rejects.toThrow();
  });

  it('should verify an issued credential', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    const res = {checks: [{expired: "NOK", proof: "OK", revoked: "OK"}], status: "ISSUED"}
    const verifyRes = await service.verifyCredentialById((newCred.credential as any)['id']);
    expect(verifyRes.status).toEqual("ISSUED");
    expect(verifyRes.checks[0].expired).toEqual("NOK");
    expect(verifyRes.checks[0].proof).toEqual("NOK");
    expect(verifyRes.checks[0].revoked).toEqual("OK");
  });

  it('should return an empty revocation list', async () => {
    let res = []
    expect(
      await service.getRevocationList(undefined)
    ).toEqual(res);
  });

  it('should say revoked', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    expect(
      await service.deleteCredential((newCred.credential as any).id)
    ).toHaveProperty('status', 'REVOKED');
  });

  it('should throw while delete because credential not present', async () => {
    await expect(service.deleteCredential('did:ulp:123')).rejects.toThrow();
  });

  it('should throw', async () => {
    await expect(
      service.getCredentialsBySubjectOrIssuer({
        subject: { id: 'did:ulp:123' },
      })
    ).rejects.toThrow();
  });

  it('should return array of creds based on issuer', async () => {
      const newCred = await service.issueCredential(sampleCredReqPayload);
      expect(
        await service.getCredentialsBySubjectOrIssuer({
          issuer: {
            id: (newCred.credential as any)?.issuer,
          },
        })
      ).toBeInstanceOf(Array);
  });


  it('should return array of creds based on issuer', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    expect(
      await service.getCredentials(['tag1'])
    ).toBeInstanceOf(Array);
      const res = await service.getCredentials(['tag1'], 2, 1000)
      expect(res.length).toEqual(0)
  });



  it('should give revockedList by issuerId', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    expect((newCred.credential as any).id).toBeDefined();
    const revockedCred  = await service.deleteCredential((newCred.credential as any).id)
    expect(
      await service.getRevocationList(
       (revockedCred as any)?.issuer,
      )
    ).toBeInstanceOf(Array);
  });

  it('should give revockedList of all creds', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    expect((newCred.credential as any).id).toBeDefined();
    const revockedCred  = await service.deleteCredential((newCred.credential as any).id)
    expect(
      await service.getRevocationList(undefined)
    ).toBeInstanceOf(Array);
  });


  it('should throw error by saying enter a valid issuer Id', async () => {
    const newCred = await service.issueCredential(sampleCredReqPayload);
    expect((newCred.credential as any).id).toBeDefined();
    const revockedCred  = await service.deleteCredential((newCred.credential as any).id)
    await expect(
      service.getRevocationList("")
    ).rejects.toThrow();
  });

});
