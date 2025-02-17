export interface BlockchainAnchor {
    /**
     * Anchors a DID document to the blockchain.
     * @param body The request payload for anchoring.
     * @returns The anchored DID document or related data.
     */
    anchorDid(body: any): Promise<any>;
  }
  