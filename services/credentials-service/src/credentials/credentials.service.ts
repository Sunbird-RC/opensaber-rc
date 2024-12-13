import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, VCStatus, VerifiableCredentials } from '@prisma/client';
import { GetCredentialsBySubjectOrIssuer } from './dto/getCredentialsBySubjectOrIssuer.dto';
import { IssueCredentialDTO } from './dto/issue-credential.dto';
import { RENDER_OUTPUT } from './enums/renderOutput.enum';
import { JwtCredentialSubject } from 'src/app.interface';
import { SchemaUtilsSerivce } from './utils/schema.utils.service';
import { IdentityUtilsService } from './utils/identity.utils.service';
import { RenderingUtilsService } from './utils/rendering.utils.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';

import * as jsigs from 'jsonld-signatures';
import * as jsonld from 'jsonld';
import { DOCUMENTS } from './documents';
import { RSAKeyPair } from 'crypto-ld';
const AssertionProofPurpose = jsigs.purposes.AssertionProofPurpose;
import {
  W3CCredential, Verifiable, DIDDocument,
  CredentialPayload, IssuerType, Proof, VerificationMethod
} from 'vc.types';
import { RevocationListDTO } from './dto/revocaiton-list.dto';

@Injectable()
export class CredentialsService {
  map = {
    Ed25519VerificationKey2020: null,
    JsonWebKey2020: null,
    Ed25519Signature2020: null,
    Ed25519VerificationKey2018: null,
    Ed25519Signature2018: null,
    RsaVerificationKey2018: null,
    RsaSignature2018: null,
    vc: null
  };
  documents: object
  constructor(
    private readonly prisma: PrismaClient,
    private readonly identityUtilsService: IdentityUtilsService,
    private readonly renderingUtilsService: RenderingUtilsService,
    private readonly schemaUtilsService: SchemaUtilsSerivce,
    private readonly blockchainFactory: BlockchainAnchorFactory
  ) {
    this.init();
  }

  async init() {
    const vc = await import('@digitalbazaar/vc');
    const { Ed25519VerificationKey2020 } = await import('@digitalbazaar/ed25519-verification-key-2020');
    const { Ed25519Signature2020 } = await import('@digitalbazaar/ed25519-signature-2020');
    const { Ed25519VerificationKey2018 } = await import('@digitalbazaar/ed25519-verification-key-2018');
    const { Ed25519Signature2018 } = await import('@digitalbazaar/ed25519-signature-2018');
    this.map.Ed25519VerificationKey2020 = Ed25519VerificationKey2020;
    this.map.JsonWebKey2020 = Ed25519VerificationKey2020;
    this.map.Ed25519Signature2020 = Ed25519Signature2020;
    this.map.Ed25519VerificationKey2018 = Ed25519VerificationKey2018;
    this.map.Ed25519Signature2018 = Ed25519Signature2018;
    this.map.RsaSignature2018 = jsigs.suites.RsaSignature2018;
    this.map.RsaVerificationKey2018 = RSAKeyPair;
    this.map.vc = vc;
  }

  private logger = new Logger(CredentialsService.name);

  async getCredentials(
    tags: ReadonlyArray<string>,
    page = 1,
    limit = 20
  ): Promise<ReadonlyArray<W3CCredential>> {
    const credentials = await this.prisma.verifiableCredentials.findMany({
      where: {
        tags: {
          hasSome: [...tags],
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        issuanceDate: 'desc',
      },
    });

    if (!credentials) {
      this.logger.error('Error fetching credentials');
      throw new InternalServerErrorException('Error fetching credentials');
    }
    return credentials.map((cred: VerifiableCredentials) => {
      const res = cred.signed;
      delete res['options'];
      res['id'] = cred.id;
      return res as W3CCredential;
    }) as ReadonlyArray<W3CCredential>;
  }

  async getCredentialById(
    id: string,
    templateId: string = null,
    externalTemplate: string = null,
    output: string = 'json' // : Promise<W3CCredential>
  ) {
    const credential = await this.prisma.verifiableCredentials.findUnique({
      where: { id: id },
      select: {
        signed: true,
      },
    });
    if (!credential) {
      this.logger.error('Credential not found');
      throw new NotFoundException('Credential for the given id not found');
    }
    // formatting the response as per the spec
    const res = credential.signed;
    delete res['options'];
    res['id'] = id;
    let template = null;

    switch (output.toUpperCase()) {
      case RENDER_OUTPUT.QR:
        const QRData = await this.renderingUtilsService.generateQR(
          res as W3CCredential
        );
        return QRData as string;
      case RENDER_OUTPUT.PDF:
        // fetch the template
        // TODO: Add type here
        template = externalTemplate || (await this.schemaUtilsService.getTemplateById(templateId))?.template;
        return this.renderingUtilsService.renderAsPDF(
          res as W3CCredential,
          template
        );
      case RENDER_OUTPUT.HTML:
        template = externalTemplate || (await this.schemaUtilsService.getTemplateById(templateId))?.template;
        return await this.renderingUtilsService.compileHBSTemplate(
          res as W3CCredential,
          template
        );
      case RENDER_OUTPUT.STRING:
        return JSON.stringify(res);
      case RENDER_OUTPUT.JSON:
        return res as W3CCredential;
      default:
        this.logger.error('Output type not supported');
        throw new BadRequestException('Output type not supported');
    }
  }

  async verifyCredential(credToVerify: Verifiable<W3CCredential>, status?: VCStatus) {
    try {
      // Check if anchoring to blockchain is enabled and get the method
      const method = this.shouldAnchorToBlockchain();
  
      if (method) {
        // Get the appropriate service from the factory
        const anchorService = this.blockchainFactory.getAnchorService(method);
        // delegate verification to appropriate service
        return await anchorService.verifyCredential(credToVerify);
      }
      // calling identity service to verify the issuer DID
      const issuerId = (credToVerify.issuer?.id || credToVerify.issuer) as string;
      const did: DIDDocument = await this.identityUtilsService.resolveDID(
        issuerId
      );
      const credVerificationMethod = (credToVerify?.proof || {})[Object.keys(credToVerify?.proof || {})
        .find(d => d.indexOf("verificationMethod") > -1)]

      // VERIFYING THE JWS
      const vm = did.verificationMethod?.find(d => (d.id === credVerificationMethod || d.id === credVerificationMethod?.id));
      const suite = await this.getSuite(vm, credToVerify?.proof?.type);
      let results;
      if (credToVerify?.proof?.type === "RsaSignature2018") {
        this.map.vc._checkCredential({
          credential: credToVerify
        })
        results = await jsigs.verify(credToVerify, {
          purpose: new AssertionProofPurpose(),
          suite: [suite],
          documentLoader: this.getDocumentLoader(did),
          addSuiteContext: true,
          compactProof: false
        });
      } else {
        results = await this.map.vc.verifyCredential({
          credential: credToVerify,
          purpose: new AssertionProofPurpose(),
          suite: [suite],
          documentLoader: this.getDocumentLoader(did)
        });
      }
      if (!results?.verified) {
        this.logger.error('Error in verifying credentials: ', results);
      }
      return {
        status: status,
        checks: [
          {
            ...(status && { revoked: status === VCStatus.REVOKED ? 'NOK' : 'OK' }), // NOK represents revoked
            expired:
              new Date(credToVerify.expirationDate).getTime() < Date.now()
                ? 'NOK'
                : 'OK', // NOK represents expired
            proof: !!results?.verified ? 'OK' : 'NOK',
          },
        ],
      };
    } catch (e) {
      this.logger.error('Error in verifying credentials: ', e);
      return {
        errors: [e],
      };
    }
  }

  async verifyCredentialById(credId: string) {
    // getting the credential from the db
    const stored =
      (await this.prisma.verifiableCredentials.findUnique({
        where: {
          id: credId,
        },
        select: {
          signed: true,
          status: true,
        },
      }));
    const { signed: credToVerify, status } = (stored || {}) as { signed: Verifiable<W3CCredential>; status: VCStatus };

    this.logger.debug('Fetched credntial from db to verify');

    // invalid request in case credential is not found
    if (!credToVerify) {
      this.logger.error('Credential not found');
      throw new NotFoundException({ errors: ['Credential not found'] });
    }
    return this.verifyCredential(credToVerify, status);
  }

  async getSuite(verificationMethod: VerificationMethod, signatureType: string) {
    const supportedSignatures = {
      "Ed25519Signature2020": ["Ed25519VerificationKey2020", "JsonWebKey2020", "Ed25519VerificationKey2018"],
      "Ed25519Signature2018": ["Ed25519VerificationKey2018"],
      "RsaSignature2018": ["RsaVerificationKey2018"],
    };
    if (!(signatureType in supportedSignatures)) {
      throw new NotFoundException("Suite for signature type not found");
    }
    if (!supportedSignatures[signatureType].includes(verificationMethod?.type)) {
      throw new NotFoundException("Suite for verification type not found");
    }
    if (!this.map[verificationMethod?.type]) await this.init();
    if (!this.map[verificationMethod?.type]) throw new NotFoundException("Library not loaded");
    let keyPair = await this.map[verificationMethod?.type].from(verificationMethod);
    return new this.map[signatureType]({ key: keyPair });
  }

  getDocumentLoader(didDoc: DIDDocument) {
    return jsigs.extendContextLoader(async url => {
      if (url === didDoc?.id) {
        return {
          contextUrl: null,
          documentUrl: url,
          document: didDoc
        };
      }
      if (DOCUMENTS[url]) {
        return {
          contextUrl: null,
          documentUrl: url,
          document: DOCUMENTS[url]
        }
      }
      return await jsonld.documentLoaders.node()(url);
    })
  }


  async issueCredential(issueRequest: IssueCredentialDTO) {
    this.logger.debug(`Received issue credential request`);
    const credInReq = issueRequest.credential;

    let response: any = null;

    // Check if anchoring to blockchain is enabled and get the method
    const method = this.shouldAnchorToBlockchain();

    // Check if ANCHOR_TO_CORD is true
    if (method) {
      // Get the appropriate service from the factory
      const anchorService = this.blockchainFactory.getAnchorService(method);
      const anchoredCredentialData = await anchorService.anchorCredential(issueRequest);
      response = this.saveCredentialToDatabase(anchoredCredentialData)
    } else {
      // Check for issuance date
      if (!credInReq.issuanceDate) {
        credInReq.issuanceDate = new Date(Date.now()).toISOString();
      }

      // Get the credential schema ID
      const schema = await this.schemaUtilsService.getCredentialSchema(
        issueRequest.credentialSchemaId,
        issueRequest.credentialSchemaVersion
      );

      this.logger.debug('fetched schema', schema);

      const { valid, errors } = await this.schemaUtilsService.verifyCredentialSubject(
        credInReq,
        schema.schema
      );

      if (!valid) {
        this.logger.error('Invalid credential schema', errors);
        throw new BadRequestException(errors);
      }

      // Generate the DID for the credential
      const credDID: ReadonlyArray<DIDDocument> = await this.identityUtilsService.generateDID([], issueRequest.method);

      try {
        credInReq.id = credDID[0].id;
      } catch (err) {
        this.logger.error('Invalid response from generate DID', err);
        throw new InternalServerErrorException('Problem creating DID');
      }

      this.logger.debug('Generated DID and validated schema');
      response = await this.signAndStoreCredential(credInReq, issueRequest);
    }

    return response;
  }



  /**
 * Determines if anchoring to a blockchain is enabled based on environment variables.
 * Checks for specific blockchain configurations and returns the appropriate method.
 * @returns The blockchain method (e.g., 'cord', 'solana') if anchoring is enabled; otherwise, null.
 */
  private shouldAnchorToBlockchain(): string | null {
    // Check if the environment variable ANCHOR_TO_CORD is set to 'true' for the CORD blockchain
    if (
      process.env.ANCHOR_TO_CORD &&
      process.env.ANCHOR_TO_CORD.toLowerCase().trim() === 'true'
    ) {
      return 'cord'; // Return 'cord' as the service method if CORD anchoring is enabled
    }

    // Add additional checks here for other blockchains, e.g.,Solana, Ethereum, Polkadot
    /*
    if (
      process.env.ANCHOR_TO_SOLANA &&
      process.env.ANCHOR_TO_SOLANA.toLowerCase().trim() === 'true'
    ) {
      return 'solana'; // Return 'solana' if solana anchoring is enabled
    }
    */

    return null; // Return null if no blockchain anchoring is required
  }


  /**
   * Signs the credential locally and saves it to the database
   */
  private async signAndStoreCredential(credInReq: any, issueRequest: IssueCredentialDTO) {
    let signedCredential: W3CCredential = {};

    try {
      signedCredential = await this.identityUtilsService.signVC(
        credInReq as CredentialPayload,
        credInReq.issuer
      );
    } catch (err) {
      this.logger.error('Error signing the credential');
      throw new InternalServerErrorException('Problem signing the credential');
    }

    this.logger.debug('Signed credential');

    const newCredData = {
      id: signedCredential.id,
      type: signedCredential.type,
      issuer: signedCredential.issuer as IssuerType as string,
      issuanceDate: signedCredential.issuanceDate,
      expirationDate: signedCredential.expirationDate,
      subject: signedCredential.credentialSubject as JwtCredentialSubject,
      subjectId: (signedCredential.credentialSubject as JwtCredentialSubject).id,
      proof: signedCredential.proof as Proof,
      credential_schema: issueRequest.credentialSchemaId,
      signed: signedCredential as object,
      tags: issueRequest.tags,
    };

    return this.saveCredentialToDatabase(newCredData);
  }

  /**
   * Saves the credential to the database and returns the response
   */
  private async saveCredentialToDatabase(credentialData: any) {
    const newCred = await this.prisma.verifiableCredentials.create({
      data: credentialData,
    });

    if (!newCred) {
      this.logger.error('Problem saving credential to db');
      throw new InternalServerErrorException('Problem saving credential to db');
    }

    this.logger.debug('saved credential to db');

    const res = newCred.signed;

    delete res['options'];

    return {
      credential: res,
      credentialSchemaId: newCred.credential_schema,
      createdAt: newCred.updated_at.toISOString(),
      updatedAt: newCred.updated_at.toISOString(),
      createdBy: '',
      updatedBy: '',
      tags: newCred.tags,
    };
  }

  async deleteCredential(id: string) {
    try {
      const credential = await this.prisma.verifiableCredentials.update({
        where: { id: id },
        data: {
          status: 'REVOKED',
        },
      });
      return credential;
    } catch (err) {
      this.logger.error('Error revoking/soft deleting the credential: ', err);
      throw new InternalServerErrorException('Error deleting the credential.');
    }
  }

  async getCredentialsBySubjectOrIssuer(
    getCreds: GetCredentialsBySubjectOrIssuer,
    page = 1,
    limit = 5
  ) {
    const filteringSubject = getCreds.subject;
    const credentials = await this.prisma.verifiableCredentials.findMany({
      where: {
        issuer: getCreds.issuer?.id,
        AND: filteringSubject
          ? Object.keys(filteringSubject).map((key: string) => ({
            subject: {
              path: [key.toString()],
              equals: filteringSubject[key],
            },
          }))
          : [],
      },
      select: {
        id: true,
        signed: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        issuanceDate: 'desc',
      },
    });

    if (!credentials.length) {
      this.logger.error('Error fetching credentials');
      throw new InternalServerErrorException('Error fetching credentials');
    }

    return credentials.map((cred) => {
      const signed: W3CCredential = cred.signed as W3CCredential;
      // formatting the output as per the spec
      delete signed['id'];
      delete signed['options'];
      return { id: cred.id, ...signed };
    });
  }

  async getRevocationList(
    issuerId: string,
    page = 1,
    limit = 1000,
  ) {
    let revocationList: RevocationListDTO[]

    if (issuerId === "") {
      throw new InternalServerErrorException('Please provide a valid issuer ID');
    }

    try {
      revocationList = await this.prisma.verifiableCredentials.findMany({
        where: {
          issuer: issuerId,
          status: VCStatus.REVOKED,
        },
        select: {
          id: true,
          tags: true,
          issuer: true,
          issuanceDate: true
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          issuanceDate: 'desc',
        },
      });
    } catch (error) {
      this.logger.error('Error fetching RevocationList');
      throw new InternalServerErrorException('Error fetching revocationList');
    }
    return revocationList
  }
}
