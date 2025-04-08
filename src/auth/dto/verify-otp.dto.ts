import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyOtpDto {
    @IsString()
    @IsNotEmpty()
    mobileNumber: string;

    @IsString()
    @IsNotEmpty()
    code: string;
}