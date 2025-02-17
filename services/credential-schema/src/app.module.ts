import { CacheModule, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SchemaService } from './schema/schema.service';
import { SchemaModule } from './schema/schema.module';
import { ConfigModule } from '@nestjs/config';
import { RenderingTemplatesModule } from './rendering-templates/rendering-templates.module';
import { HttpModule } from '@nestjs/axios';
import { UtilsService } from './utils/utils.service';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './utils/prisma.health';
import { PrismaClient } from '@prisma/client';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { AnchorCordService } from './schema/implementations/anchor-cord.service';
import { BlockchainAnchorFactory } from './schema/factories/blockchain-anchor.factory';

@Module({
  imports: [
    SchemaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      max: 1000,
    }), // using in memory cache for now
    RenderingTemplatesModule,
    HttpModule,
    TerminusModule,
  ],
  controllers: [AppController],
  providers: [
    SchemaService,
    UtilsService,
    PrismaHealthIndicator,
    PrismaClient,
    AnchorCordService,
    BlockchainAnchorFactory,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
