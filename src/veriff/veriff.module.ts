import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; 
import { VeriffService } from './veriff.service'; 

@Module({
  imports: [
    HttpModule, 
  ],
  providers: [VeriffService],
  exports: [VeriffService],
})
export class VeriffModule {}