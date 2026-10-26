import { Module } from '@nestjs/common';
import { KtpModule } from './ktp/ktp.module';
@Module({imports:[KtpModule]}) export class AppModule {}
