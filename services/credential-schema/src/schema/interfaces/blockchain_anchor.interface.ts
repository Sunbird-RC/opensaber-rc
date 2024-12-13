export interface BlockchainAnchor {
    /**
     * Anchors a Scheam to the blockchain.
     * @param body The request payload for anchoring.
     * @returns The anchored Schema or related data.
     */
    anchorSchema(body: any): Promise<any>;
  }
  