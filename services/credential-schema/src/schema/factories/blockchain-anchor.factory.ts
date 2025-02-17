import { Injectable, BadRequestException } from '@nestjs/common';
import { AnchorCordService } from '../implementations/anchor-cord.service';
import { BlockchainAnchor } from '../interfaces/blockchain_anchor.interface';

/**
 * Factory class to dynamically resolve the appropriate BlockchainAnchor service.
 * It uses the specified method to determine which implementation to return.
 */
@Injectable()
export class BlockchainAnchorFactory {
  /**
   * Constructor for the BlockchainAnchorFactory.
   * @param cordService - An instance of AnchorCordService, which handles CORD-specific anchoring logic.
   */
  constructor(private readonly cordService: AnchorCordService) {}

  /**
   * Resolves the appropriate BlockchainAnchor service based on the provided method.
   * @param method - The blockchain method (e.g., 'cord').
   * @returns The service instance corresponding to the specified method or null if no method is provided.
   * @throws 
   */
  getAnchorService(method?: string): BlockchainAnchor | null {
    // If no method is specified, return null to indicate no anchoring is required
    if (!method) {
      return null; 
    }

    // Determine the appropriate service implementation based on the method
    switch (method) {
      case 'cord':
        // Return the CORD-specific implementation
        return this.cordService;
      default:
        throw new BadRequestException(`Unsupported blockchain method: ${method}`);
    }
  }
}
