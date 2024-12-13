import { Injectable, InternalServerErrorException, Logger, NotFoundException ,BadRequestException,HttpException} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { v4 as uuid } from 'uuid';
import { VaultService } from '../utils/vault.service';
import { Identity } from '@prisma/client';
import { RSAKeyPair } from 'crypto-ld';
import { GenerateDidDTO } from './dtos/GenerateDidRequest.dto';
// import { AnchorCordService } from 'src/utils/cord.service';
import { BlockchainAnchorFactory } from './factories/blockchain-anchor.factory';

const { DIDDocument } = require('did-resolver');
type DIDDocument = typeof DIDDocument;
type KeysType = {
  [key: string]: {
    name: string;
    key: any;
  };
};
@Injectable()
export class DidService {
  keys: KeysType = {
  }
  webDidPrefix: string;
  signingAlgorithm: string;
  didResolver: any;
  constructor(private prisma: PrismaService, private vault: VaultService , private blockchainFactory:BlockchainAnchorFactory) {
    let baseUrl: string = process.env.WEB_DID_BASE_URL;
    this.webDidPrefix = this.getDidPrefixForBaseUrl(baseUrl);
    this.signingAlgorithm = process.env.SIGNING_ALGORITHM;
    this.init();
  }

  async init() {
    const {Ed25519VerificationKey2020} = await import('@digitalbazaar/ed25519-verification-key-2020');
    const {Ed25519VerificationKey2018} = await import('@digitalbazaar/ed25519-verification-key-2018');
    this.keys['Ed25519Signature2020'] = {
      name: 'Ed25519VerificationKey2020',
      key: Ed25519VerificationKey2020
    };
    this.keys['Ed25519Signature2018'] = {
      name: 'Ed25519VerificationKey2018',
      key: Ed25519VerificationKey2018
    };
    this.keys['RsaSignature2018'] = {
      name: 'RsaVerificationKey2018',
      key: RSAKeyPair
    };
    const { Resolver } = await import('did-resolver');
    const { getResolver } = await import('web-did-resolver');
    const webResolver = getResolver();
    this.didResolver = new Resolver({
      ...webResolver
        //...you can flatten multiple resolver methods into the Resolver
    });
  }

  getDidPrefixForBaseUrl(baseUrl: string): string {
    if(!baseUrl || typeof baseUrl !== "string") return '';
    baseUrl = baseUrl.split("?")[0]
      .replace("https://", "")
      .replace(/:/g, "%3A")
      .replace(/\//g, ":");
    return `did:web:${baseUrl}:`;
  }

  generateDidUri(method: string, id?: string, webDidBaseUrl?: string): string {
    if(id) return id;
    if (method === 'web') {
      return this.getWebDidIdForId(uuid(), webDidBaseUrl);
    }
    return `did:${(method && method.trim() !== '') ? method.trim() : 'rcw'}:${uuid()}`;
  }

  getWebDidIdForId(id: string, webDidBaseUrl?: string): string {
    if(!this.webDidPrefix && !webDidBaseUrl) throw new NotFoundException("Web did base url not found");
    if(webDidBaseUrl) {
      const webDidBasePrefix = this.getDidPrefixForBaseUrl(webDidBaseUrl);
      return `${webDidBasePrefix}${id}`;
    }
    return `${this.webDidPrefix}${id}`;
  }

  async getVerificationKey(signingAlgorithm?: string): Promise<any> {
    if(!this.keys[signingAlgorithm]) {
      await this.init();
    }
    if(!this.keys[signingAlgorithm]) {
      throw new NotFoundException("Signature algorithm not found")
    }
    return this.keys[signingAlgorithm];
  }

  async getVerificationKeyByName(name?: string) {
    let verificationKey = Object.values(this.keys).find((d: {name: string, key: any}) => d.name === name);
    if(!verificationKey) {
      await this.init();
      verificationKey = Object.values(this.keys).find((d: {name: string, key: any}) => d.name === name);
    }
    if(name && !verificationKey) throw new NotFoundException("Verification Key '" + name + "' not found");
    return verificationKey;
  }
  async generateDID(doc: GenerateDidDTO): Promise<DIDDocument> {
    let didUri: string;
    let document: DIDDocument;
    let privateKeys: object;
    let blockchainStatus: boolean = false;

     // Check if anchoring to blockchain is enabled and get the method
     const method = this.shouldAnchorToBlockchain();

     if (method) {
      try {
      // Get the appropriate service from the factory
      const anchorService = this.blockchainFactory.getAnchorService(method);
      // Use the service to anchor the DID
      const response = await anchorService.anchorDid(doc);

      didUri = response.document.uri;
      document = response.document;
       
      // store mnemonic and delegate keys in to vault
      privateKeys = {
          "mnemonic":response.mnemonic,
          "delegateKeys":response.delegateKeys
        };  
        blockchainStatus = true;
      } catch (err) {
        if (err instanceof HttpException) {
          throw err;
        }
        Logger.error(`Error anchoring to Cord: ${err}`);
        throw new InternalServerErrorException('Failed to anchor DID to Cord blockchain');
      }
    } else {
      
      didUri = this.generateDidUri(doc?.method, doc?.id, doc?.webDidBaseUrl);
  
      let authnKeys;
      let verificationKey = await this.getVerificationKeyByName(doc?.keyPairType);
      if (!verificationKey) verificationKey = await this.getVerificationKey(this.signingAlgorithm);
  
      try {
        const keyPair = await (verificationKey as any)?.key.generate({
          id: `${didUri}#key-0`,
          controller: didUri
        });
        const exportedKey = await keyPair.export({
          publicKey: true, privateKey: true, includeContext: true
        });
  
        let privateKey = {};
        if (verificationKey?.name === "Ed25519VerificationKey2020") {
          const { privateKeyMultibase, ...rest } = exportedKey;
          authnKeys = rest;
          privateKey = { privateKeyMultibase };
        } else if (verificationKey?.name === "Ed25519VerificationKey2018") {
          const { privateKeyBase58, ...rest } = exportedKey;
          authnKeys = rest;
          privateKey = { privateKeyBase58 };
        } else if (verificationKey?.name === "RsaVerificationKey2018") {
          const { privateKeyPem, ...rest } = exportedKey;
          authnKeys = { ...rest };
          privateKey = { privateKeyPem };
        } else {
          throw new NotFoundException("VerificationKey type not found");
        }
  
        privateKeys = {
          [authnKeys.id]: privateKey
        };
  
        const keyId = authnKeys?.id;
  
        document = {
          '@context': [
            "https://www.w3.org/ns/did/v1"
          ],
          id: didUri,
          alsoKnownAs: doc.alsoKnownAs,
          service: doc.services,
          verificationMethod: [
            authnKeys,
          ],
          authentication: [keyId],
          assertionMethod: [keyId]
        };
  
      } catch (err: any) {
        Logger.error(`Error generating key pair: ${err}`);
        throw new InternalServerErrorException('Error generating key pair: ' + err.message);
      }
    }
  
    try {
      await this.prisma.identity.create({
        data: {
          id: didUri,
          didDoc: JSON.stringify(document),
          blockchainStatus: blockchainStatus, 
        },
      });
    } catch (err) {
      Logger.error(`Error writing DID to database: ${err}`);
      throw new InternalServerErrorException('Error writing DID to database');
    }
  
    try {
      await this.vault.writePvtKey(privateKeys, didUri);
    } catch (err) {
      Logger.error(`Error writing private key to vault: ${err}`);
      throw new InternalServerErrorException('Error writing private key to vault');
    }
  
    return document;
  }
  

  async resolveDID(id: string): Promise<DIDDocument> {
    let artifact: Identity;
    try {
      artifact = await this.prisma.identity.findUnique({
        where: { id: id?.split("#")[0] },
      });
    } catch (err) {
      Logger.error(`Error fetching DID: ${id} from db, ${err}`);
      throw new InternalServerErrorException(`Error fetching DID: ${id} from db`);
    }

    if(!artifact && id?.startsWith("did:web") && !id?.startsWith(this.webDidPrefix)) {
      try {
        let doc = (await this.didResolver.resolve(id)).didDocument;
        if(!doc) throw new Error("DID document is null");
        return doc;
      } catch (err) {
        Logger.error(`Error fetching DID: ${id} from web, ${err}`);
        throw new InternalServerErrorException(`Error fetching DID: ${id} from web`);
      }
    }

    if (artifact) {
      return JSON.parse(artifact.didDoc as string) as DIDDocument;
    } else {
      throw new NotFoundException(`DID: ${id} not found`);
    }
  }

  async resolveWebDID(id: string): Promise<DIDDocument> {
    const webDidId = this.getWebDidIdForId(id);
    return this.resolveDID(webDidId);
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

  
}

