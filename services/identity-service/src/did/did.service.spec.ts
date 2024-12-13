import { Test, TestingModule } from '@nestjs/testing';
import { DidService } from './did.service';
import { PrismaService } from '../utils/prisma.service';
import { VaultService } from '../utils/vault.service';
// import { AnchorCordService } from 'src/utils/cord.service';
import { GenerateDidDTO, VerificationKeyType } from './dtos/GenerateDidRequest.dto';
import { ConfigService } from '@nestjs/config';

describe('DidService', () => {
  let service: DidService;
  let doc: GenerateDidDTO;
  const defaultDoc: GenerateDidDTO =
  {
    "alsoKnownAs": [
      "C4GT",
      "https://www.codeforgovtech.in/"
    ],
    "services": [
      {
        "id": "C4GT",
        "type": "IdentityHub",
        "serviceEndpoint": {
          "@context": "schema.c4gt.acknowledgment",
          "@type": "UserServiceEndpoint",
          "instance": [
            "https://www.codeforgovtech.in"
          ]
        }
      }
    ],
    "method": "C4GT"
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // providers: [DidService, PrismaService, VaultService, ConfigService,AnchorCordService],
      providers: [DidService, PrismaService, VaultService, ConfigService],
    }).compile();

    service = module.get<DidService>(DidService);
  });

  beforeEach(async () => {
    doc = JSON.parse(JSON.stringify(defaultDoc));
    jest.restoreAllMocks();
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a DID with a custom method', async () => {
    const result = await service.generateDID(doc);
    expect(result).toBeDefined();
    expect(result.verificationMethod).toBeDefined();
    expect(
      result.verificationMethod[0].publicKeyMultibase
      ).toBeDefined();
    expect(result.id.split(':')[1]).toEqual('C4GT');
  });

  it('should generate a DID with a default method', async () => {
    delete doc.method;
    const result = await service.generateDID(doc);
    expect(result).toBeDefined();
    expect(result.verificationMethod).toBeDefined();
    expect(result.verificationMethod[0].publicKeyMultibase).toBeDefined();
    expect(result.id.split(':')[1]).toEqual('rcw');
  });

  it('should generate a web DID with a given base url and verification key', async () => {
    doc.method = "web";
    doc.webDidBaseUrl = "https://registry.dev.example.com/identity";
    doc.keyPairType = VerificationKeyType.Ed25519VerificationKey2018;
    const result = await service.generateDID(doc);
    expect(result).toBeDefined();
    expect(result.id).toMatch(/did:web:registry.dev.example.com:*/i)
    expect(result.verificationMethod).toBeDefined();
    expect(result.verificationMethod[0].type).toStrictEqual(VerificationKeyType.Ed25519VerificationKey2018.toString());
  });

  it('should generate a web DID with RsaVerificationKey2018 verification key', async () => {
    doc.method = "abc";
    doc.keyPairType = VerificationKeyType.RsaVerificationKey2018;
    const result = await service.generateDID(doc);
    expect(result).toBeDefined();
    expect(result.verificationMethod).toBeDefined();
    expect(result.verificationMethod[0].type).toStrictEqual(VerificationKeyType.RsaVerificationKey2018.toString());
  });

  it('should generate a DID with a given ID', async () => {
    doc.method = "web";
    doc.id = "did:web:abc.com:given:1234"
    const result = await service.generateDID(doc);
    expect(result).toBeDefined();
    expect(result.id).toMatch("did:web:abc.com:given:1234")
  });

  it('resolve a DID', async () => {
    const result = await service.generateDID(doc);
    const didToResolve = result.id;
    const resolvedDid = await service.resolveDID(didToResolve);
    expect(resolvedDid).toBeDefined();
    expect(resolvedDid.id).toEqual(didToResolve);
    expect(resolvedDid).toEqual(result);
    await expect(service.resolveDID("did:abc:efg:hij")).rejects
      .toThrow("DID: did:abc:efg:hij not found");
  });

  it('resolve a web DID for given id', async () => {
    service.webDidPrefix = "did:web:abc.com:resolveweb:";
    doc.method = "web";
    const result = await service.generateDID(doc);
    const didToResolve = result.id;
    const resolvedDid = await service.resolveWebDID(didToResolve.split(service.webDidPrefix)[1]);
    expect(resolvedDid).toBeDefined();
    expect(resolvedDid.id).toEqual(didToResolve);
    expect(resolvedDid).toEqual(result);
  });

  it("generate web did id test", () => {
    service.webDidPrefix = "did:web:example.com:identity:";
    const didId = service.generateDidUri("web");
    expect(didId).toBeDefined();
    expect(didId).toContain("did:web:example.com:identity");
  });
  it("get web did id for id test", () => {
    service.webDidPrefix = "did:web:example.com:identity:";
    const didId = service.getWebDidIdForId("abc");
    expect(didId).toBeDefined();
    expect(didId).toEqual("did:web:example.com:identity:abc");
  });

  it('should generate a DID with a web method', async () => {
    service.webDidPrefix = "did:web:example.com:identity:";
    const result = await service.generateDID({
      alsoKnownAs: [],
      services: [],
      method: "web"
    });
    expect(result).toBeDefined();
    expect(result.verificationMethod).toBeDefined();
    expect(result.id.split(':')[1]).toEqual('web');
    expect(result.id).toContain("did:web:example.com:identity");
  });

  it("throw exception when web did base url is not set", () => {
    service.webDidPrefix = undefined;
    expect(() => service.getWebDidIdForId("abc"))
    .toThrow("Web did base url not found");
  });

  // it("throw exception when signature algorithm is not found", () => {
  //   service.signingAlgorithm = "EdDsa";
  //   expect(() => service.generateDID(doc))
  //     .toThrow("Signature algorithm not found");
  // });

});
